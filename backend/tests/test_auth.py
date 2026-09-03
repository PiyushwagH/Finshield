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
