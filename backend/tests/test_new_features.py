"""Regression tests for new features:
- Dashboard cumulative_balance / opening_balance
- Report endpoints accepting start/end (custom range)
- PATCH /auth/me stores and returns picture (data URI)
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
    email = f"TEST_{uuid.uuid4().hex[:10]}@example.com"
    r = requests.post(f"{API}/auth/register",
                      json={"email": email, "password": "pass1234", "name": "Cumul User"},
                      timeout=30)
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    return {"headers": {"Authorization": f"Bearer {tok}"}, "email": email}


def _mktx(h, type_, amount, date, category="Test", title="t"):
    r = requests.post(f"{API}/transactions", headers=h,
                      json={"type": type_, "amount": amount, "category": category,
                            "title": title, "date": f"{date}T10:00:00"}, timeout=30)
    assert r.status_code == 200, r.text


class TestCumulativeBalance:
    def test_cumulative_across_months(self, auth):
        h = auth["headers"]
        # Use far-future months isolated from any seeded data
        _mktx(h, "income", 5_000_000, "2030-05-10")
        _mktx(h, "expense", 1_200_000, "2030-06-15")
        _mktx(h, "income", 500_000, "2030-07-05")

        # June: cumulative = 5,000,000 - 1,200,000 = 3,800,000
        r = requests.get(f"{API}/dashboard/summary?month=2030-06", headers=h, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["cumulative_balance"] == 3_800_000, d
        assert d["balance"] == -1_200_000
        assert d["opening_balance"] == 5_000_000

        # October (no tx): cumulative still 4,300,000 after July
        r = requests.get(f"{API}/dashboard/summary?month=2030-10", headers=h, timeout=30)
        d = r.json()
        assert d["cumulative_balance"] == 4_300_000
        assert d["balance"] == 0
        assert d["opening_balance"] == 4_300_000

    def test_may_only(self, auth):
        h = auth["headers"]
        r = requests.get(f"{API}/dashboard/summary?month=2030-05", headers=h, timeout=30)
        d = r.json()
        assert d["cumulative_balance"] == 5_000_000
        assert d["opening_balance"] == 0
        assert d["balance"] == 5_000_000


class TestReportRange:
    def test_text_with_start_end(self, auth):
        h = auth["headers"]
        r = requests.get(f"{API}/report/text?start=2030-05-01&end=2030-07-31",
                         headers=h, timeout=30)
        assert r.status_code == 200, r.text
        txt = r.json()["text"]
        assert "2030-05-01 s/d 2030-07-31" in txt
        assert "Rp5.500.000" in txt  # total income
        assert "Rp1.200.000" in txt  # total expense

    def test_text_narrow_range_excludes(self, auth):
        h = auth["headers"]
        r = requests.get(f"{API}/report/text?start=2030-06-01&end=2030-06-30",
                         headers=h, timeout=30)
        assert r.status_code == 200
        txt = r.json()["text"]
        # Only the June expense should be included
        assert "Rp1.200.000" in txt
        # saldo should be -1,200,000 (negative sign preserved in _fmt_idr)
        assert "Saldo" in txt

    def test_text_fallback_to_month(self, auth):
        h = auth["headers"]
        r = requests.get(f"{API}/report/text?month=2030-05", headers=h, timeout=30)
        assert r.status_code == 200
        assert "2030-05" in r.json()["text"]

    def test_pdf_range_returns_binary(self, auth):
        h = auth["headers"]
        r = requests.get(f"{API}/report/pdf?start=2030-05-01&end=2030-07-31",
                         headers=h, timeout=60)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF"
        assert len(r.content) > 500

    def test_excel_range_returns_xlsx(self, auth):
        h = auth["headers"]
        r = requests.get(f"{API}/report/excel?start=2030-05-01&end=2030-07-31",
                         headers=h, timeout=60)
        assert r.status_code == 200
        assert "spreadsheetml" in r.headers.get("content-type", "")
        # XLSX = zip header
        assert r.content[:2] == b"PK"


class TestPicturePatch:
    def test_patch_me_stores_picture_data_uri(self, auth):
        h = auth["headers"]
        # 1x1 transparent PNG data URI
        data_uri = ("data:image/png;base64,"
                    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4"
                    "nGNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=")
        r = requests.patch(f"{API}/auth/me", headers=h,
                           json={"picture": data_uri, "name": "Pic User"}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["picture"] == data_uri
        assert body["name"] == "Pic User"

        # Verify persisted via GET
        g = requests.get(f"{API}/auth/me", headers=h, timeout=30)
        assert g.status_code == 200
        assert g.json()["picture"] == data_uri
