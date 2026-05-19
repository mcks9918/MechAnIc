"""GearMind backend regression tests.
Covers: health, auth (register/login/me + 401), vehicles CRUD (user-scoped),
AI chat (Claude, multi-turn), parts search (eBay -> AI fallback), history.
"""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://parts-price-doctor.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

SEED_EMAIL = "demo@gearmind.com"
SEED_PASSWORD = "Test1234"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth_token(session):
    # Try login with seeded user first; if missing, register it.
    r = session.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": SEED_PASSWORD}, timeout=20)
    if r.status_code != 200:
        rr = session.post(
            f"{API}/auth/register",
            json={"email": SEED_EMAIL, "password": SEED_PASSWORD, "full_name": "Demo"},
            timeout=20,
        )
        assert rr.status_code == 200, f"Register failed: {rr.status_code} {rr.text}"
        token = rr.json()["token"]
    else:
        token = r.json()["token"]
    assert token
    return token


@pytest.fixture(scope="session")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# ---------- Health ----------
def test_health(session):
    r = session.get(f"{API}/", timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body.get("service") == "GearMind API"
    assert body.get("ok") is True


# ---------- Auth ----------
class TestAuth:
    def test_register_new_user(self, session):
        email = f"test_{uuid.uuid4().hex[:8]}@gearmind.com"
        r = session.post(
            f"{API}/auth/register",
            json={"email": email, "password": "Pass1234", "full_name": "T User"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "token" in body and isinstance(body["token"], str) and len(body["token"]) > 20
        assert body["user"]["email"] == email
        assert body["user"]["full_name"] == "T User"

    def test_register_duplicate_rejected(self, session, auth_token):
        r = session.post(
            f"{API}/auth/register",
            json={"email": SEED_EMAIL, "password": SEED_PASSWORD},
            timeout=15,
        )
        assert r.status_code == 400

    def test_login_seed_user(self, session):
        r = session.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": SEED_PASSWORD}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "token" in body
        assert body["user"]["email"] == SEED_EMAIL

    def test_login_invalid_password(self, session):
        r = session.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": "wrongpass"}, timeout=15)
        assert r.status_code == 401

    def test_me_with_token(self, session, auth_headers):
        r = session.get(f"{API}/auth/me", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == SEED_EMAIL
        assert "id" in body

    def test_me_missing_token(self, session):
        r = session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_me_invalid_token(self, session):
        r = session.get(
            f"{API}/auth/me",
            headers={"Authorization": "Bearer not.a.valid.token"},
            timeout=15,
        )
        assert r.status_code == 401


# ---------- Vehicles ----------
class TestVehicles:
    created_id = None

    def test_add_vehicle(self, session, auth_headers):
        r = session.post(
            f"{API}/vehicles",
            headers=auth_headers,
            json={"make": "TEST_Toyota", "model": "Camry", "year": 2019, "nickname": "Daily"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["make"] == "TEST_Toyota"
        assert body["model"] == "Camry"
        assert body["year"] == 2019
        assert "id" in body and "user_id" in body
        TestVehicles.created_id = body["id"]

    def test_list_vehicles_contains_created(self, session, auth_headers):
        assert TestVehicles.created_id, "previous test must have created vehicle"
        r = session.get(f"{API}/vehicles", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert any(v["id"] == TestVehicles.created_id for v in items)

    def test_vehicles_require_auth(self, session):
        r = session.get(f"{API}/vehicles", timeout=15)
        assert r.status_code == 401

    def test_other_user_cannot_see_or_delete(self, session):
        # Register a brand new user; ensure they don't see seeded vehicle
        email = f"other_{uuid.uuid4().hex[:8]}@gearmind.com"
        rr = session.post(
            f"{API}/auth/register",
            json={"email": email, "password": "Pass1234"},
            timeout=15,
        )
        assert rr.status_code == 200
        other_token = rr.json()["token"]
        h = {"Authorization": f"Bearer {other_token}", "Content-Type": "application/json"}
        r = session.get(f"{API}/vehicles", headers=h, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert all(v["id"] != TestVehicles.created_id for v in items)
        # And cannot delete other user's vehicle (returns 404)
        if TestVehicles.created_id:
            rd = session.delete(f"{API}/vehicles/{TestVehicles.created_id}", headers=h, timeout=15)
            assert rd.status_code == 404

    def test_delete_vehicle(self, session, auth_headers):
        assert TestVehicles.created_id
        r = session.delete(f"{API}/vehicles/{TestVehicles.created_id}", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        # Verify gone
        r2 = session.get(f"{API}/vehicles", headers=auth_headers, timeout=15)
        assert all(v["id"] != TestVehicles.created_id for v in r2.json())


# ---------- AI Chat ----------
class TestAIChat:
    session_id = f"test-session-{uuid.uuid4().hex[:8]}"

    def test_chat_single_turn(self, session, auth_headers):
        r = session.post(
            f"{API}/ai/chat",
            headers=auth_headers,
            json={
                "session_id": TestAIChat.session_id,
                "message": "My 2019 Toyota Camry makes a grinding noise when I brake. What's wrong?",
                "vehicle": {"make": "Toyota", "model": "Camry", "year": 2019},
            },
            timeout=90,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["session_id"] == TestAIChat.session_id
        assert isinstance(body["reply"], str)
        assert len(body["reply"]) > 10

    def test_chat_multi_turn_retains_context(self, session, auth_headers):
        # Send second message in same session
        r = session.post(
            f"{API}/ai/chat",
            headers=auth_headers,
            json={
                "session_id": TestAIChat.session_id,
                "message": "Only when going below 25 mph. Pads have ~40k miles on them.",
            },
            timeout=90,
        )
        assert r.status_code == 200, r.text
        reply = r.json()["reply"]
        assert isinstance(reply, str) and len(reply) > 10

    def test_chat_requires_auth(self, session):
        r = session.post(
            f"{API}/ai/chat",
            json={"session_id": "x", "message": "hi"},
            timeout=15,
        )
        assert r.status_code == 401


# ---------- Parts Search ----------
class TestPartsSearch:
    results = []

    def test_search_brake_pads(self, session, auth_headers):
        r = session.post(
            f"{API}/parts/search",
            headers=auth_headers,
            json={"part_name": "brake pads", "make": "Toyota", "model": "Camry", "year": 2019},
            timeout=120,
        )
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 1, "Expected at least 1 part result"
        # Validate fields and sort
        prices = [p["price"] for p in items]
        assert prices == sorted(prices), f"Results not sorted asc: {prices}"
        first = items[0]
        for k in ("title", "price", "currency", "url", "source"):
            assert k in first
        assert first["price"] > 0
        assert first["url"].startswith("http")
        TestPartsSearch.results = items

    def test_search_requires_auth(self, session):
        r = session.post(f"{API}/parts/search", json={"part_name": "oil filter"}, timeout=15)
        assert r.status_code == 401


# ---------- History ----------
class TestHistory:
    diag_id = None

    def test_save_and_list_diagnosis(self, session, auth_headers):
        r = session.post(
            f"{API}/history/diagnoses",
            headers=auth_headers,
            json={
                "session_id": "diag-test-1",
                "title": "TEST_Brake noise",
                "summary": "Likely worn brake pads.",
                "vehicle": {"make": "Toyota", "model": "Camry", "year": 2019},
            },
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        TestHistory.diag_id = body.get("id")
        # List
        r2 = session.get(f"{API}/history/diagnoses", headers=auth_headers, timeout=15)
        assert r2.status_code == 200
        items = r2.json()
        assert any(d.get("title") == "TEST_Brake noise" for d in items)

    def test_save_and_list_shopping(self, session, auth_headers):
        items_payload = [
            {"title": "TEST_Bosch Brake Pads", "price": 45.99, "currency": "USD", "url": "https://ebay.com/x", "source": "AI Catalog"},
            {"title": "TEST_ACDelco Brake Pads", "price": 39.50, "currency": "USD", "url": "https://ebay.com/x", "source": "AI Catalog"},
        ]
        r = session.post(
            f"{API}/history/shopping",
            headers=auth_headers,
            json={"title": "TEST_Shopping", "items": items_payload},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True
        r2 = session.get(f"{API}/history/shopping", headers=auth_headers, timeout=15)
        assert r2.status_code == 200
        lists = r2.json()
        assert any(l.get("title") == "TEST_Shopping" for l in lists)

    def test_history_user_scoped(self, session):
        email = f"hist_{uuid.uuid4().hex[:8]}@gearmind.com"
        rr = session.post(f"{API}/auth/register", json={"email": email, "password": "Pass1234"}, timeout=15)
        assert rr.status_code == 200
        h = {"Authorization": f"Bearer {rr.json()['token']}", "Content-Type": "application/json"}
        rd = session.get(f"{API}/history/diagnoses", headers=h, timeout=15)
        assert rd.status_code == 200
        # New user should have no TEST_ items
        assert all(d.get("title") != "TEST_Brake noise" for d in rd.json())
        rs = session.get(f"{API}/history/shopping", headers=h, timeout=15)
        assert rs.status_code == 200
        assert all(l.get("title") != "TEST_Shopping" for l in rs.json())
