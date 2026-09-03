import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import uuid
import time
from datetime import timedelta

from app.main import app
from app.database import Base, get_db
from app.core.security import create_access_token

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

from app.models.user import User, RefreshToken

User.__table__.create(bind=engine, checkfirst=True)
RefreshToken.__table__.create(bind=engine, checkfirst=True)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
app.state.limiter.enabled = False

client = TestClient(app)

@pytest.fixture(autouse=True)
def run_around_tests():
    User.__table__.drop(bind=engine, checkfirst=True)
    RefreshToken.__table__.drop(bind=engine, checkfirst=True)
    User.__table__.create(bind=engine, checkfirst=True)
    RefreshToken.__table__.create(bind=engine, checkfirst=True)
    yield
    User.__table__.drop(bind=engine, checkfirst=True)
    RefreshToken.__table__.drop(bind=engine, checkfirst=True)

def test_register_and_login():
    response = client.post(
        "/api/auth/register",
        json={"email": "test@example.com", "password": "Password123", "full_name": "Test User"}
    )
    assert response.status_code == 200
    assert response.json()["email"] == "test@example.com"

    response = client.post(
        "/api/auth/login",
        data={"username": "test@example.com", "password": "Password123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in response.cookies

def test_register_duplicate_email():
    client.post("/api/auth/register", json={"email": "test2@example.com", "password": "Password123"})
    response = client.post("/api/auth/register", json={"email": "test2@example.com", "password": "Password123"})
    assert response.status_code == 400

def test_login_wrong_password():
    client.post("/api/auth/register", json={"email": "test3@example.com", "password": "Password123"})
    response = client.post(
        "/api/auth/login",
        data={"username": "test3@example.com", "password": "WrongPassword123"}
    )
    assert response.status_code == 401

def test_password_validation():
    response = client.post(
        "/api/auth/register",
        json={"email": "test4@example.com", "password": "short"}
    )
    assert response.status_code == 422 # Pydantic validation error

def test_expired_token():
    # Create an expired token manually
    expired_token = create_access_token(data={"sub": str(uuid.uuid4())}, expires_delta=timedelta(seconds=-1))
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert response.status_code == 401

def test_refresh_token_rotation_and_revocation():
    client.post("/api/auth/register", json={"email": "test5@example.com", "password": "Password123"})
    login_response = client.post("/api/auth/login", data={"username": "test5@example.com", "password": "Password123"})

    # Refresh successfully
    refresh_response = client.post("/api/auth/refresh", cookies=login_response.cookies)
    assert refresh_response.status_code == 200
    assert "refresh_token" in refresh_response.cookies
    
    # Attempt to use the old revoked token
    revoked_response = client.post("/api/auth/refresh", cookies=login_response.cookies)
    assert revoked_response.status_code == 401

def test_admin_route_access():
    client.post("/api/auth/register", json={"email": "test6@example.com", "password": "Password123"})
    login_response = client.post("/api/auth/login", data={"username": "test6@example.com", "password": "Password123"})
    access_token = login_response.json()["access_token"]

    # By default users have role='user', so it should fail
    response = client.get("/api/auth/admin-only", headers={"Authorization": f"Bearer {access_token}"})
    assert response.status_code == 403


def _make_admin(email: str, password: str = "Password123"):
    """Register an account and promote it to admin directly in the test DB."""
    client.post("/api/auth/register", json={"email": email, "password": password})
    db = TestingSessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        user.role = "admin"
        db.commit()
    finally:
        db.close()


# --- Role-scoped login endpoints ---

def test_login_user_endpoint():
    client.post("/api/auth/register", json={"email": "portal-user@example.com", "password": "Password123"})
    response = client.post(
        "/api/auth/login/user",
        data={"username": "portal-user@example.com", "password": "Password123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["role"] == "user"
    assert data["user"]["email"] == "portal-user@example.com"
    assert "refresh_token" in response.cookies


def test_login_user_endpoint_accepts_admin():
    """An admin is also a user, so the customer portal must not lock them out."""
    _make_admin("dual-role@example.com")
    response = client.post(
        "/api/auth/login/user",
        data={"username": "dual-role@example.com", "password": "Password123"}
    )
    assert response.status_code == 200
    assert response.json()["role"] == "admin"


def test_login_user_endpoint_wrong_password():
    client.post("/api/auth/register", json={"email": "portal-user2@example.com", "password": "Password123"})
    response = client.post(
        "/api/auth/login/user",
        data={"username": "portal-user2@example.com", "password": "WrongPassword123"}
    )
    assert response.status_code == 401


def test_login_admin_endpoint():
    _make_admin("real-admin@example.com")
    response = client.post(
        "/api/auth/login/admin",
        data={"username": "real-admin@example.com", "password": "Password123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "admin"
    assert data["user"]["role"] == "admin"

    # The issued token must actually open the admin surface.
    admin_only = client.get(
        "/api/auth/admin-only",
        headers={"Authorization": f"Bearer {data['access_token']}"}
    )
    assert admin_only.status_code == 200


def test_login_admin_endpoint_rejects_non_admin():
    client.post("/api/auth/register", json={"email": "not-admin@example.com", "password": "Password123"})
    response = client.post(
        "/api/auth/login/admin",
        data={"username": "not-admin@example.com", "password": "Password123"}
    )
    assert response.status_code == 403
    # No session may be established for a rejected role.
    assert "refresh_token" not in response.cookies


def test_login_admin_endpoint_checks_password_before_role():
    """A wrong password on a non-admin account must read as 401, not 403.

    Otherwise the 403 would confirm that the password was correct.
    """
    client.post("/api/auth/register", json={"email": "not-admin2@example.com", "password": "Password123"})
    response = client.post(
        "/api/auth/login/admin",
        data={"username": "not-admin2@example.com", "password": "WrongPassword123"}
    )
    assert response.status_code == 401


def test_login_endpoints_reject_unknown_email():
    for path in ("/api/auth/login/user", "/api/auth/login/admin"):
        response = client.post(path, data={"username": "nobody@example.com", "password": "Password123"})
        assert response.status_code == 401, path


def test_login_endpoints_reject_inactive_user():
    client.post("/api/auth/register", json={"email": "inactive@example.com", "password": "Password123"})
    db = TestingSessionLocal()
    try:
        user = db.query(User).filter(User.email == "inactive@example.com").first()
        user.is_active = False
        db.commit()
    finally:
        db.close()

    response = client.post(
        "/api/auth/login/user",
        data={"username": "inactive@example.com", "password": "Password123"}
    )
    assert response.status_code == 400
