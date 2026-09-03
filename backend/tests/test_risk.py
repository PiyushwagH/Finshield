import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import uuid

from app.main import app
from app.database import Base, get_db
from app.models.user import User, RefreshToken
from app.models.assessment import Assessment
from app.services import risk_service
from app.core.security import create_access_token

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
app.state.limiter.enabled = False
client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_module():
    # Only create necessary tables
    User.__table__.create(bind=engine, checkfirst=True)
    Assessment.__table__.create(bind=engine, checkfirst=True)
    yield
    User.__table__.drop(bind=engine, checkfirst=True)
    Assessment.__table__.drop(bind=engine, checkfirst=True)

@pytest.fixture
def auth_headers():
    db = TestingSessionLocal()
    user_id = uuid.uuid4()
    user = db.query(User).filter_by(email="risk_test@example.com").first()
    if not user:
        user = User(
            id=user_id,
            email="risk_test@example.com",
            full_name="Risk Test User",
            password_hash="dummy"
        )
        db.add(user)
        db.commit()
    else:
        user_id = user.id
    db.close()
    
    token = create_access_token(data={"sub": str(user_id)})
    return {"Authorization": f"Bearer {token}"}

valid_sample = {
    "age": 34, "gender": "male", "education": "bachelors",
    "marital_status": "married", "dependents": 2,
    "employment_status": "salaried_private", "years_employed": 8,
    "annual_income": 900000,
    "monthly_emi": 18000, "existing_total_debt": 850000,
    "asset_value": 2500000, "monthly_expenditure": 35000, "savings": 300000,
    "owns_vehicle": True, "owns_property": True,
    "has_prior_credit": True, "has_defaulted": False,
    "payment_history": "good",
    "n_prior_credits": 4, "n_active_credits": 2, "years_credit_history": 9,
}

def test_startup_check():
    # This shouldn't raise an exception
    risk_service.startup_check()

def test_unauthenticated_assess():
    response = client.post("/api/risk/assess", json=valid_sample)
    assert response.status_code == 401

def test_invalid_schema(auth_headers):
    invalid_sample = valid_sample.copy()
    invalid_sample["education"] = "invalid_enum_value"
    response = client.post("/api/risk/assess", json=invalid_sample, headers=auth_headers)
    assert response.status_code == 422

def test_assess_success(auth_headers):
    response = client.post("/api/risk/assess", json=valid_sample, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "default_probability" in data
    assert "risk_band" in data
    assert "affordability" in data
    assert "advice" in data
    assert len(data["advice"]) > 0

def test_get_assessments(auth_headers):
    response = client.get("/api/risk/assessments", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert "risk_band" in data[0]
