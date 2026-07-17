import os
from pathlib import Path

TEST_DB_PATH = Path(__file__).parent / "test.db"
if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()

# Must be set before `app.config.settings` is instantiated (happens on import
# below), so these override anything in backend/.env for the test run.
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ.setdefault("JWT_SECRET", "test-secret-do-not-use-in-production-32bytes")
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("GROQ_API_KEY", "test-groq-key")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "test")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "test")
os.environ.setdefault("AWS_S3_BUCKET", "test-bucket")
os.environ.setdefault("ALLOWED_ORIGINS", "http://localhost:5173")
os.environ["TURNSTILE_SECRET_KEY"] = ""  # empty -> verify_turnstile_token short-circuits to True

import pytest
from fastapi.testclient import TestClient

from app.limiter import limiter
from app.main import app

limiter.enabled = False  # per-route rate limits would fail unrelated tests sharing the same process


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_headers(client):
    email = f"{os.urandom(4).hex()}@example.com"
    resp = client.post("/auth/register", json={"email": email, "password": "hunter22"})
    assert resp.status_code == 201, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
