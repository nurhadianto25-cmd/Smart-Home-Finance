"""Backend API tests for Smart Home Finance app.

Covers: auth (register/login/me), transactions, bills, savings, shopping,
education (children+items with cascade), dashboard summary, and AI insights.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://fintech-mobile-app-21.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def unique_email():
    return f"TEST_{uuid.uuid4().hex[:10]}@example.com"


@pytest.fixture(scope="session")
def auth(unique_email):
    """Register a fresh user and return {token, user, headers}."""
    payload = {"email": unique_email, "password": "pass1234", "name": "TEST User"}
    r = requests.post(f"{API}/auth/register", json=payload, timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    return {
        "token": data["token"],
        "user": data["user"],
        "headers": {"Authorization": f"Bearer {data['token']}"},
        "email": unique_email,
    }


# ---------- AUTH ----------
class TestAuth:
    def test_register_duplicate_returns_400(self, auth):
        r = requests.post(f"{API}/auth/register", json={
            "email": auth["email"], "password": "pass1234", "name": "dup"
        }, timeout=30)
        assert r.status_code == 400

    def test_login_wrong_password_401(self, auth):
        r = requests.post(f"{API}/auth/login", json={
            "email": auth["email"], "password": "wrong-password"
        }, timeout=30)
        assert r.status_code == 401

    def test_login_success_returns_token(self, auth):
        r = requests.post(f"{API}/auth/login", json={
            "email": auth["email"], "password": "pass1234"
        }, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "token" in d and d["user"]["email"].lower() == auth["email"].lower()

    def test_me_with_token(self, auth):
        r = requests.get(f"{API}/auth/me", headers=auth["headers"], timeout=30)
        assert r.status_code == 200
        assert r.json()["email"].lower() == auth["email"].lower()

    def test_me_without_token_401(self):
        r = requests.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 401


# ---------- Transactions ----------
class TestTransactions:
    def test_create_income_and_expense(self, auth):
        h = auth["headers"]
        r1 = requests.post(f"{API}/transactions", headers=h, json={
            "type": "income", "amount": 5000000, "category": "Gaji", "title": "Gaji Jan"
        }, timeout=30)
        assert r1.status_code == 200, r1.text
        assert r1.json()["type"] == "income"

        r2 = requests.post(f"{API}/transactions", headers=h, json={
            "type": "expense", "amount": 100000, "category": "Makanan", "title": "Warteg"
        }, timeout=30)
        assert r2.status_code == 200
        assert r2.json()["amount"] == 100000

    def test_list_and_filter_by_type(self, auth):
        h = auth["headers"]
        r = requests.get(f"{API}/transactions", headers=h, timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list) and len(r.json()) >= 2

        r_inc = requests.get(f"{API}/transactions?type=income", headers=h, timeout=30)
        assert r_inc.status_code == 200
        assert all(t["type"] == "income" for t in r_inc.json())

    def test_delete_transaction(self, auth):
        h = auth["headers"]
        cr = requests.post(f"{API}/transactions", headers=h, json={
            "type": "expense", "amount": 12345, "category": "Test", "title": "todelete"
        }, timeout=30)
        tx_id = cr.json()["tx_id"]
        dr = requests.delete(f"{API}/transactions/{tx_id}", headers=h, timeout=30)
        assert dr.status_code == 200
        # verify gone
        listing = requests.get(f"{API}/transactions", headers=h, timeout=30).json()
        assert all(t["tx_id"] != tx_id for t in listing)


# ---------- Bills ----------
class TestBills:
    def test_create_toggle_delete(self, auth):
        h = auth["headers"]
        c = requests.post(f"{API}/bills", headers=h, json={
            "name": "PLN", "kind": "rutin", "category": "Listrik",
            "amount": 250000, "due_date": "2026-02-15", "status": "belum"
        }, timeout=30)
        assert c.status_code == 200, c.text
        bill_id = c.json()["bill_id"]

        # toggle to lunas
        u = requests.put(f"{API}/bills/{bill_id}", headers=h, json={
            "name": "PLN", "kind": "rutin", "category": "Listrik",
            "amount": 250000, "due_date": "2026-02-15", "status": "lunas"
        }, timeout=30)
        assert u.status_code == 200
        assert u.json()["status"] == "lunas"

        d = requests.delete(f"{API}/bills/{bill_id}", headers=h, timeout=30)
        assert d.status_code == 200


# ---------- Savings ----------
class TestSavings:
    def test_create_update_delete(self, auth):
        h = auth["headers"]
        c = requests.post(f"{API}/savings", headers=h, json={
            "name": "Dana Darurat", "target": 10000000, "saved": 100000
        }, timeout=30)
        assert c.status_code == 200
        goal_id = c.json()["goal_id"]

        u = requests.put(f"{API}/savings/{goal_id}", headers=h, json={
            "name": "Dana Darurat", "target": 10000000, "saved": 500000
        }, timeout=30)
        assert u.status_code == 200
        assert u.json()["saved"] == 500000

        d = requests.delete(f"{API}/savings/{goal_id}", headers=h, timeout=30)
        assert d.status_code == 200


# ---------- Shopping ----------
class TestShopping:
    def test_create_and_delete(self, auth):
        h = auth["headers"]
        c = requests.post(f"{API}/shopping", headers=h, json={
            "name": "Beras 5kg", "category": "Kebutuhan Pokok",
            "budget": 75000, "realized": 0, "status": "belum",
            "frequency": "Rutin", "month": "2026-01"
        }, timeout=30)
        assert c.status_code == 200, c.text
        item_id = c.json()["item_id"]
        d = requests.delete(f"{API}/shopping/{item_id}", headers=h, timeout=30)
        assert d.status_code == 200


# ---------- Education (cascade) ----------
class TestEducation:
    def test_child_item_cascade_delete(self, auth):
        h = auth["headers"]
        cr = requests.post(f"{API}/education/children", headers=h, json={
            "name": "Ani", "school": "SD 01", "grade": "3"
        }, timeout=30)
        assert cr.status_code == 200, cr.text
        child_id = cr.json()["child_id"]

        ir = requests.post(f"{API}/education/items", headers=h, json={
            "child_id": child_id, "name": "SPP", "category": "Sekolah",
            "budget": 500000, "realized": 0, "frequency": "Bulanan",
            "month": "2026-01", "status": "belum"
        }, timeout=30)
        assert ir.status_code == 200, ir.text

        # confirm item exists via filter
        lst = requests.get(f"{API}/education/items?child_id={child_id}",
                           headers=h, timeout=30).json()
        assert len(lst) == 1

        # delete child -> should cascade items
        dr = requests.delete(f"{API}/education/children/{child_id}",
                             headers=h, timeout=30)
        assert dr.status_code == 200

        remaining = requests.get(f"{API}/education/items?child_id={child_id}",
                                 headers=h, timeout=30).json()
        assert remaining == []


# ---------- Dashboard ----------
class TestDashboard:
    def test_summary_shape(self, auth):
        h = auth["headers"]
        # seed a couple of transactions inside this class so parallel workers
        # (pytest-xdist load-scope) see them regardless of test ordering
        requests.post(f"{API}/transactions", headers=h, json={
            "type": "income", "amount": 5000000, "category": "Gaji", "title": "Gaji Dash"
        }, timeout=30)
        requests.post(f"{API}/transactions", headers=h, json={
            "type": "expense", "amount": 100000, "category": "Makanan", "title": "Warteg Dash"
        }, timeout=30)
        r = requests.get(f"{API}/dashboard/summary", headers=h, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["income", "expense", "balance", "saving_rate",
                  "health_score", "cashflow", "expense_by_category",
                  "upcoming_bills", "savings"]:
            assert k in d, f"missing key {k}"
        assert isinstance(d["cashflow"], list) and len(d["cashflow"]) == 6
        assert d["income"] >= 5000000
        assert d["expense"] >= 100000
        assert d["balance"] == d["income"] - d["expense"]


# ---------- AI Insight ----------
class TestInsight:
    def test_generate_indonesian_non_empty(self, auth):
        h = auth["headers"]
        r = requests.get(f"{API}/insights/generate", headers=h, timeout=90)
        assert r.status_code == 200, r.text
        text = r.json().get("insight", "")
        assert isinstance(text, str) and len(text) > 20
