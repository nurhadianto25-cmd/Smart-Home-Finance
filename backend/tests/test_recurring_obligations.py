"""Tests for recurring bills, recurring education, and dashboard obligations.

Review iteration focus (Jan 2026):
- Bills are recurring: created once with due_day (1-31), repeat monthly.
  Status 'lunas' only in the month an expense is allocated to it.
- Education items recurring the same way; realized reflects only linked tx that month.
- GET /api/dashboard/summary returns 'obligations' { tagihan, pendidikan, belanja,
  total_commitment }.
"""
import os
import uuid
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "").rstrip("/")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL env var required"
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def auth():
    email = f"TEST_rec_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register",
                      json={"email": email, "password": "pass1234", "name": "RecUser"},
                      timeout=30)
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    return {"headers": {"Authorization": f"Bearer {tok}"}, "email": email}


class TestBillRecurring:
    def test_create_with_due_day_only(self, auth):
        h = auth["headers"]
        # No due_date field; only due_day
        r = requests.post(f"{API}/bills", headers=h, json={
            "name": "Listrik PLN", "kind": "rutin", "category": "Listrik",
            "amount": 350_000, "due_day": 25, "status": "belum"
        }, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["due_day"] == 25
        assert d["due_date"].endswith("-25")
        pytest.bill_id = d["bill_id"]

    def test_bill_appears_in_multiple_months(self, auth):
        h = auth["headers"]
        for m in ["2027-01", "2027-02", "2027-03"]:
            r = requests.get(f"{API}/bills?month={m}", headers=h, timeout=30)
            assert r.status_code == 200
            bills = r.json()
            ids = [b["bill_id"] for b in bills]
            assert pytest.bill_id in ids, f"bill missing in {m}"
            b = next(x for x in bills if x["bill_id"] == pytest.bill_id)
            assert b["due_date"].startswith(m)
            assert b["status"] != "lunas"

    def test_bill_lunas_only_in_paid_month(self, auth):
        h = auth["headers"]
        # Create expense tx in 2027-02 linked to the bill
        tx = requests.post(f"{API}/transactions", headers=h, json={
            "type": "expense", "amount": 350_000, "category": "Listrik",
            "title": "Bayar PLN Feb", "date": "2027-02-25T10:00:00",
            "link_type": "bill", "link_id": pytest.bill_id,
        }, timeout=30)
        assert tx.status_code == 200, tx.text

        # Feb: lunas
        feb = requests.get(f"{API}/bills?month=2027-02", headers=h, timeout=30).json()
        b_feb = next(x for x in feb if x["bill_id"] == pytest.bill_id)
        assert b_feb["status"] == "lunas"
        assert b_feb["auto_paid"] is True
        assert b_feb["paid_amount"] >= 350_000

        # Jan (prior) & Mar (next): still pending (not lunas)
        for m in ("2027-01", "2027-03"):
            lst = requests.get(f"{API}/bills?month={m}", headers=h, timeout=30).json()
            b = next(x for x in lst if x["bill_id"] == pytest.bill_id)
            assert b["status"] != "lunas", f"bill wrongly lunas in {m}"
            assert b.get("paid_amount", 0) == 0


class TestEducationRecurring:
    def test_create_edu_item_and_recurs_monthly(self, auth):
        h = auth["headers"]
        c = requests.post(f"{API}/education/children", headers=h, json={
            "name": "Budi", "school": "SMP 1", "grade": "7"
        }, timeout=30)
        assert c.status_code == 200
        child_id = c.json()["child_id"]
        pytest.child_id = child_id

        it = requests.post(f"{API}/education/items", headers=h, json={
            "child_id": child_id, "name": "SPP", "category": "Sekolah",
            "budget": 400_000, "realized": 0, "frequency": "Bulanan",
            "month": "2027-01", "status": "belum"
        }, timeout=30)
        assert it.status_code == 200, it.text
        pytest.edu_item_id = it.json()["item_id"]

        # Item should appear in Jan, Feb, Mar (recurring)
        for m in ["2027-01", "2027-02", "2027-03"]:
            r = requests.get(f"{API}/education/items?month={m}", headers=h, timeout=30)
            assert r.status_code == 200
            ids = [x["item_id"] for x in r.json()]
            assert pytest.edu_item_id in ids, f"edu item missing in {m}"

    def test_edu_realized_only_in_linked_month(self, auth):
        h = auth["headers"]
        # Link an expense in 2027-02
        tx = requests.post(f"{API}/transactions", headers=h, json={
            "type": "expense", "amount": 400_000, "category": "Pendidikan",
            "title": "SPP Feb", "date": "2027-02-10T10:00:00",
            "link_type": "education", "link_id": pytest.edu_item_id,
        }, timeout=30)
        assert tx.status_code == 200

        feb = requests.get(f"{API}/education/items?month=2027-02",
                           headers=h, timeout=30).json()
        item_feb = next(x for x in feb if x["item_id"] == pytest.edu_item_id)
        assert item_feb["realized"] >= 400_000
        assert item_feb["status"] == "lunas"

        jan = requests.get(f"{API}/education/items?month=2027-01",
                           headers=h, timeout=30).json()
        item_jan = next(x for x in jan if x["item_id"] == pytest.edu_item_id)
        assert item_jan["realized"] == 0
        assert item_jan["status"] != "lunas"


class TestDashboardObligations:
    def test_summary_has_obligations_shape(self, auth):
        h = auth["headers"]
        # Also create a shopping item so belanja > 0
        requests.post(f"{API}/shopping", headers=h, json={
            "name": "Beras", "category": "Pokok", "budget": 120_000,
            "realized": 0, "status": "belum", "frequency": "Rutin",
            "month": "2027-02"
        }, timeout=30)
        r = requests.get(f"{API}/dashboard/summary?month=2027-02",
                         headers=h, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "obligations" in d, "missing obligations key"
        ob = d["obligations"]
        for k in ("tagihan", "pendidikan", "belanja", "total_commitment"):
            assert k in ob, f"missing obligations.{k}"
        for k in ("tagihan", "pendidikan", "belanja"):
            assert "total" in ob[k] and "count" in ob[k]
        # total_commitment must equal sum of 3 totals
        s = ob["tagihan"]["total"] + ob["pendidikan"]["total"] + ob["belanja"]["total"]
        assert abs(ob["total_commitment"] - s) < 1
        # must include our seeded data
        assert ob["tagihan"]["count"] >= 1
        assert ob["pendidikan"]["count"] >= 1
        assert ob["belanja"]["count"] >= 1
        assert ob["tagihan"]["total"] >= 350_000
        assert ob["pendidikan"]["total"] >= 400_000
        assert ob["belanja"]["total"] >= 120_000


class TestReportsSaldoAwalAkhir:
    def test_report_text_contains_saldo(self, auth):
        h = auth["headers"]
        r = requests.get(f"{API}/report/text?month=2027-02",
                         headers=h, timeout=30)
        assert r.status_code == 200
        text = r.json().get("text", "") if r.headers.get("content-type","").startswith("application/json") else r.text
        assert "Saldo Awal" in text, text[:300]
        assert "Saldo Akhir" in text, text[:300]
