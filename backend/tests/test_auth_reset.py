"""Backend tests for Jan-2026 auth hardening:
- Login error distinctions (404 unknown / 401 wrong / 200 success)
- Durable JWT (/auth/me accepts the login token)
- Forgot-password + reset-password (OTP) end-to-end
"""
import os
import uuid
import hmac
import hashlib
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "").rstrip("/")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL must be set"
API = f"{BASE_URL}/api"
OTP_PEPPER = os.environ.get("OTP_PEPPER", "shf_otp_pepper_change_in_prod_2026").encode("utf-8")


def _otp_hash(otp: str) -> str:
    return hmac.new(OTP_PEPPER, otp.encode("utf-8"), hashlib.sha256).hexdigest()


def _find_otp_by_hash(target_hash: str) -> str | None:
    for n in range(1_000_000):
        if hmac.compare_digest(_otp_hash(f"{n:06d}"), target_hash):
            return f"{n:06d}"
    return None


# --------- Fixtures ----------
@pytest.fixture(scope="module")
def fresh_user():
    email = f"TEST_reset_{uuid.uuid4().hex[:10]}@example.com"
    password = "OrigPass123"
    r = requests.post(f"{API}/auth/register",
                      json={"email": email, "password": password, "name": "ResetQA"},
                      timeout=30)
    assert r.status_code == 200, r.text
    return {"email": email, "password": password, "token": r.json()["token"]}


# --------- Login error distinctions ----------
class TestLoginErrors:
    def test_unknown_email_returns_404(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": f"ghost{uuid.uuid4().hex[:8]}@nowhere.example.com",
                                "password": "whatever"}, timeout=30)
        assert r.status_code == 404
        assert "belum terdaftar" in r.json().get("detail", "").lower()

    def test_wrong_password_returns_401_with_kata_sandi(self, fresh_user):
        r = requests.post(f"{API}/auth/login",
                          json={"email": fresh_user["email"], "password": "WRONG_PASS"},
                          timeout=30)
        assert r.status_code == 401
        assert "kata sandi salah" in r.json().get("detail", "").lower()

    def test_correct_credentials_returns_token(self, fresh_user):
        r = requests.post(f"{API}/auth/login",
                          json={"email": fresh_user["email"],
                                "password": fresh_user["password"]}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "token" in d and d["user"]["email"].lower() == fresh_user["email"].lower()


# --------- Original bug repro: register then login succeeds ----------
class TestExistingUsersNotLockedOut:
    def test_register_then_login(self):
        email = f"TEST_bcrypt_{uuid.uuid4().hex[:8]}@example.com"
        password = "Secret123"
        r1 = requests.post(f"{API}/auth/register",
                           json={"email": email, "password": password, "name": "BcryptQA"},
                           timeout=30)
        assert r1.status_code == 200, r1.text
        r2 = requests.post(f"{API}/auth/login",
                           json={"email": email, "password": password}, timeout=30)
        assert r2.status_code == 200, r2.text
        assert r2.json()["user"]["email"].lower() == email.lower()


# --------- JWT durability via /auth/me ----------
class TestJwtMe:
    def test_me_accepts_login_token(self, fresh_user):
        r = requests.post(f"{API}/auth/login",
                          json={"email": fresh_user["email"],
                                "password": fresh_user["password"]}, timeout=30)
        assert r.status_code == 200
        token = r.json()["token"]
        me = requests.get(f"{API}/auth/me",
                          headers={"Authorization": f"Bearer {token}"}, timeout=30)
        assert me.status_code == 200
        assert me.json()["email"].lower() == fresh_user["email"].lower()


# --------- Forgot password ----------
class TestForgotPassword:
    def test_unknown_email_404(self):
        r = requests.post(f"{API}/auth/forgot-password",
                          json={"email": f"ghost{uuid.uuid4().hex[:8]}@nowhere.example.com"},
                          timeout=30)
        assert r.status_code == 404
        assert "tidak terdaftar" in r.json().get("detail", "").lower()

    def test_registered_user_200_ok_true(self, fresh_user):
        r = requests.post(f"{API}/auth/forgot-password",
                          json={"email": fresh_user["email"]}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True


# --------- Reset password full flow ----------
class TestResetPasswordFlow:
    """Requires MongoDB access to recover the OTP (test-only backdoor)."""

    @pytest.fixture(scope="class")
    def mongo_db(self):
        try:
            from pymongo import MongoClient
        except ImportError:
            pytest.skip("pymongo not available")
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "smart_home_finance")
        return MongoClient(mongo_url)[db_name]

    @pytest.fixture(scope="class")
    def reset_user(self):
        email = f"TEST_reset_e2e_{uuid.uuid4().hex[:10]}@example.com"
        password = "OldPassw0rd"
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": password, "name": "ResetE2E"},
                          timeout=30)
        assert r.status_code == 200, r.text
        # trigger forgot-password to generate a reset doc
        f = requests.post(f"{API}/auth/forgot-password",
                          json={"email": email}, timeout=30)
        assert f.status_code == 200, f.text
        return {"email": email, "old_password": password, "new_password": "BrandNew456"}

    def _latest_otp(self, mongo_db, email: str) -> str:
        doc = mongo_db.password_resets.find_one(
            {"email": email.lower(), "used": False},
            sort=[("created_at", -1)],
        )
        assert doc is not None, "no password_resets doc found"
        otp = _find_otp_by_hash(doc["otp_hash"])
        assert otp, "could not recover OTP by brute-force"
        return otp

    def test_wrong_otp_returns_400(self, reset_user):
        r = requests.post(f"{API}/auth/reset-password", json={
            "email": reset_user["email"], "otp": "000000",
            "new_password": reset_user["new_password"],
        }, timeout=30)
        # Could be 400 due to invalid code; the backend returns 400 "Kode tidak valid..."
        assert r.status_code == 400
        assert "tidak valid" in r.json().get("detail", "").lower()

    def test_correct_otp_returns_token_and_old_pw_fails(self, reset_user, mongo_db):
        otp = self._latest_otp(mongo_db, reset_user["email"])
        r = requests.post(f"{API}/auth/reset-password", json={
            "email": reset_user["email"], "otp": otp,
            "new_password": reset_user["new_password"],
        }, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "token" in d and d["user"]["email"].lower() == reset_user["email"].lower()

        # old password should fail now
        r_old = requests.post(f"{API}/auth/login", json={
            "email": reset_user["email"], "password": reset_user["old_password"],
        }, timeout=30)
        assert r_old.status_code == 401

        # new password should succeed
        r_new = requests.post(f"{API}/auth/login", json={
            "email": reset_user["email"], "password": reset_user["new_password"],
        }, timeout=30)
        assert r_new.status_code == 200
        assert "token" in r_new.json()

        # reusing the same OTP should fail (single-use)
        r_reuse = requests.post(f"{API}/auth/reset-password", json={
            "email": reset_user["email"], "otp": otp,
            "new_password": "YetAnother9",
        }, timeout=30)
        assert r_reuse.status_code == 400
        assert "tidak valid" in r_reuse.json().get("detail", "").lower()
