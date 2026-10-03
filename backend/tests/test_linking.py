"""Backend tests for the new transaction-linking feature.
Transactions are source of truth. Budget items (bill/shopping/education/savings)
realize ONLY from explicitly linked expense transactions.
"""
import os
import uuid
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "").rstrip("/")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL required"
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def auth():
    email = f"TEST_link_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register",
                      json={"email": email, "password": "pass1234", "name": "Link User"},
                      timeout=30)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


MONTH = "2031-03"
DATE = f"{MONTH}-10T10:00:00"


def _tx(h, type_, amount, title, link_type=None, link_id=None, child_id=None, cat="Umum"):
    body = {"type": type_, "amount": amount, "category": cat,
            "title": title, "date": DATE}
    if link_type:
        body["link_type"] = link_type
        body["link_id"] = link_id
    if child_id:
        body["child_id"] = child_id
    r = requests.post(f"{API}/transactions", headers=h, json=body, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


# ---- Transaction CRUD with link ----
class TestTransactionLink:
    def test_create_and_list_tx_preserves_link(self, auth):
        tx = _tx(auth, "expense", 100_000, "L-tx", link_type="shopping", link_id="shp_fake")
        assert tx["link_type"] == "shopping"
        assert tx["link_id"] == "shp_fake"
        r = requests.get(f"{API}/transactions?month={MONTH}", headers=auth, timeout=30)
        assert r.status_code == 200
        found = [t for t in r.json() if t["tx_id"] == tx["tx_id"]][0]
        assert found["link_type"] == "shopping"
        assert found["link_id"] == "shp_fake"
        # cleanup
        requests.delete(f"{API}/transactions/{tx['tx_id']}", headers=auth, timeout=30)


# ---- Bills auto-lunas via linked tx ----
class TestBillAutoLunas:
    def test_bill_lunas_only_when_linked_expense_matches(self, auth):
        r = requests.post(f"{API}/bills", headers=auth, json={
            "name": "Listrik L", "kind": "rutin", "category": "Utilitas",
            "amount": 500_000, "due_date": f"{MONTH}-20"}, timeout=30)
        assert r.status_code == 200, r.text
        bill_id = r.json()["bill_id"]
        # Before linking: not lunas (should be belum or segera/terlambat)
        r = requests.get(f"{API}/bills", headers=auth, timeout=30)
        bill = [b for b in r.json() if b["bill_id"] == bill_id][0]
        assert bill["status"] != "lunas"
        assert bill["auto_paid"] is False
        # Unlinked expense of same amount must NOT mark it lunas
        _tx(auth, "expense", 500_000, "Random Listrik", cat="Utilitas")
        r = requests.get(f"{API}/bills", headers=auth, timeout=30)
        bill = [b for b in r.json() if b["bill_id"] == bill_id][0]
        assert bill["status"] != "lunas", "Bill must stay unpaid without explicit link"
        # Linked expense → lunas
        _tx(auth, "expense", 500_000, "Bayar Listrik", link_type="bill", link_id=bill_id)
        r = requests.get(f"{API}/bills", headers=auth, timeout=30)
        bill = [b for b in r.json() if b["bill_id"] == bill_id][0]
        assert bill["status"] == "lunas"
        assert bill["auto_paid"] is True


# ---- Shopping realized ----
class TestShoppingLink:
    def test_shopping_realized_from_linked_only(self, auth):
        r = requests.post(f"{API}/shopping", headers=auth, json={
            "name": "Beras", "category": "Pokok",
            "budget": 300_000, "month": MONTH}, timeout=30)
        assert r.status_code == 200
        item = r.json()
        iid = item["item_id"]
        assert item["realized"] == 0
        assert item["status"] == "belum"
        # link a partial expense
        _tx(auth, "expense", 150_000, "Beli Beras 1", link_type="shopping", link_id=iid)
        r = requests.get(f"{API}/shopping?month={MONTH}", headers=auth, timeout=30)
        item = [i for i in r.json() if i["item_id"] == iid][0]
        assert item["realized"] == 150_000
        assert item["status"] == "sebagian"
        # link another to complete
        _tx(auth, "expense", 150_000, "Beli Beras 2", link_type="shopping", link_id=iid)
        r = requests.get(f"{API}/shopping?month={MONTH}", headers=auth, timeout=30)
        item = [i for i in r.json() if i["item_id"] == iid][0]
        assert item["realized"] == 300_000
        assert item["status"] == "selesai"


# ---- Education: ONLY explicit links realize ----
class TestEducationLink:
    def test_edu_item_without_link_stays_belum(self, auth):
        # Create child + item
        r = requests.post(f"{API}/education/children", headers=auth,
                          json={"name": "Anak A", "school": "SD X", "grade": "3"}, timeout=30)
        assert r.status_code == 200
        child_id = r.json()["child_id"]
        r = requests.post(f"{API}/education/items", headers=auth, json={
            "child_id": child_id, "name": "SPP", "category": "Sekolah",
            "budget": 400_000, "month": MONTH}, timeout=30)
        assert r.status_code == 200
        iid = r.json()["item_id"]
        # Add an UNLINKED expense that previously would fuzzy-match (same category SPP/Sekolah)
        _tx(auth, "expense", 400_000, "Bayar SPP", cat="Sekolah", child_id=child_id)
        r = requests.get(f"{API}/education/items?month={MONTH}", headers=auth, timeout=30)
        it = [i for i in r.json() if i["item_id"] == iid][0]
        assert it["realized"] == 0, "No link → must remain 0 (no fuzzy match)"
        assert it["status"] == "belum"
        # Now link
        _tx(auth, "expense", 400_000, "SPP Linked",
            link_type="education", link_id=iid, cat="Sekolah", child_id=child_id)
        r = requests.get(f"{API}/education/items?month={MONTH}", headers=auth, timeout=30)
        it = [i for i in r.json() if i["item_id"] == iid][0]
        assert it["realized"] == 400_000
        assert it["status"] == "lunas"


# ---- Savings linked ----
class TestSavingsLink:
    def test_savings_saved_from_linked(self, auth):
        r = requests.post(f"{API}/savings", headers=auth, json={
            "name": "Dana Darurat L", "target": 1_000_000}, timeout=30)
        assert r.status_code == 200
        gid = r.json()["goal_id"]
        assert r.json()["saved"] == 0
        _tx(auth, "expense", 250_000, "Nabung 1", link_type="savings", link_id=gid)
        _tx(auth, "expense", 250_000, "Nabung 2", link_type="savings", link_id=gid)
        r = requests.get(f"{API}/savings", headers=auth, timeout=30)
        g = [x for x in r.json() if x["goal_id"] == gid][0]
        assert g["saved"] == 500_000
        assert g["auto_saved"] == 500_000


# ---- Dashboard non-alarming when prior income covers current expense ----
class TestDashboardOpeningFlow:
    def test_cumulative_positive_non_alarming(self, auth):
        # Fresh future months isolated from previous tests
        prior = "2032-01"
        curr = "2032-02"
        requests.post(f"{API}/transactions", headers=auth, json={
            "type": "income", "amount": 10_000_000, "category": "Gaji",
            "title": "Gaji Jan", "date": f"{prior}-10T10:00:00"}, timeout=30)
        requests.post(f"{API}/transactions", headers=auth, json={
            "type": "expense", "amount": 2_000_000, "category": "Belanja",
            "title": "Belanja Feb", "date": f"{curr}-05T10:00:00"}, timeout=30)
        r = requests.get(f"{API}/dashboard/summary?month={curr}", headers=auth, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["income"] == 0
        assert d["expense"] == 2_000_000
        assert d["opening_balance"] == 10_000_000
        assert d["cumulative_balance"] == 8_000_000
        assert d["available"] == 10_000_000  # opening + income(0)
        assert d["health_score"] >= 50, f"Health score should not be alarming: {d['health_score']}"

    def test_insight_not_alarming_when_positive(self, auth):
        curr = "2032-02"
        r = requests.get(f"{API}/insights/generate?month={curr}", headers=auth, timeout=60)
        assert r.status_code == 200
        text = r.json()["insight"].lower()
        # Must not call it minus/alarming when cumulative is positive
        assert "minus" not in text, text
        assert "mengkhawatirkan" not in text, text


# ---- Report includes Saldo Awal & Akhir ----
class TestReportSaldo:
    def test_report_text_has_saldo_awal_akhir(self, auth):
        r = requests.get(f"{API}/report/text?month=2032-02", headers=auth, timeout=30)
        assert r.status_code == 200
        txt = r.json()["text"]
        assert "Saldo Awal" in txt
        assert "Saldo Akhir" in txt
        assert "Rp10.000.000" in txt  # opening
        assert "Rp8.000.000" in txt   # ending

    def test_report_pdf_ok(self, auth):
        r = requests.get(f"{API}/report/pdf?month=2032-02", headers=auth, timeout=60)
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"

    def test_report_excel_ok(self, auth):
        r = requests.get(f"{API}/report/excel?month=2032-02", headers=auth, timeout=60)
        assert r.status_code == 200
        assert r.content[:2] == b"PK"
