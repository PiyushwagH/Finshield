import pytest
import uuid
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, get_db
from app.models.user import User
from app.models.assessment import Assessment
from app.models.scheme import Scheme, SchemeEligibilityRule, UserSchemeStatus
from app.core.security import create_access_token
from app.services.plan_rules import generate_plan
from app.services.scheme_matching import normalize_benefit, get_assessment_schemes
from app.services.i18n import t
from app.schemas.scheme import SchemeCreate

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
def setup_tables():
    User.__table__.create(bind=engine, checkfirst=True)
    Assessment.__table__.create(bind=engine, checkfirst=True)
    Scheme.__table__.create(bind=engine, checkfirst=True)
    SchemeEligibilityRule.__table__.create(bind=engine, checkfirst=True)
    UserSchemeStatus.__table__.create(bind=engine, checkfirst=True)
    yield
    UserSchemeStatus.__table__.drop(bind=engine, checkfirst=True)
    SchemeEligibilityRule.__table__.drop(bind=engine, checkfirst=True)
    Scheme.__table__.drop(bind=engine, checkfirst=True)
    Assessment.__table__.drop(bind=engine, checkfirst=True)
    User.__table__.drop(bind=engine, checkfirst=True)

@pytest.fixture
def test_users_and_assessment():
    db = TestingSessionLocal()
    u1_id = uuid.uuid4()
    u2_id = uuid.uuid4()

    u1 = User(id=u1_id, email=f"user1_{u1_id.hex[:6]}@example.com", full_name="User One", password_hash="hash")
    u2 = User(id=u2_id, email=f"user2_{u2_id.hex[:6]}@example.com", full_name="User Two", password_hash="hash")
    db.add(u1)
    db.add(u2)

    sample_input = {
        "age": 32, "gender": "male", "education": "bachelors",
        "marital_status": "married", "dependents": 2,
        "employment_status": "salaried_private", "years_employed": 5,
        "annual_income": 600000,
        "monthly_emi": 15000, "existing_total_debt": 500000,
        "asset_value": 1200000, "monthly_expenditure": 25000, "savings": 40000,
        "owns_vehicle": True, "owns_property": False,
        "has_prior_credit": True, "has_defaulted": False,
        "payment_history": "good",
        "n_prior_credits": 2, "n_active_credits": 1, "years_credit_history": 5,
    }

    assessment = Assessment(
        id=uuid.uuid4(),
        user_id=u1_id,
        input_data=sample_input,
        default_probability=0.082,
        risk_band="Moderate",
        risk_score=640,
        population_percentile=60.0,
        affordability={
            "grade": "Stretched",
            "monthly_surplus": 10000.0,
            "surplus_ratio": 0.20,
            "emi_to_income_ratio": 0.30,
            "emergency_fund_months": 1.0,
            "flags": ["Emergency fund covers under 3 months of outflow"]
        },
        factors={"positive": ["Stable employment"], "negative": []},
        model_version="1.0"
    )
    db.add(assessment)

    scheme_slug = f"test-scheme-{uuid.uuid4().hex[:8]}"
    scheme = Scheme(
        id=uuid.uuid4(),
        name="Test Welfare Scheme",
        slug=scheme_slug,
        short_description="A verified test welfare scheme",
        full_description="Full verified description of test scheme",
        ministry="Ministry of Finance",
        level="central",
        benefit_type="cash",
        benefit_amount=6000,
        benefit_amount_inr=6000,
        benefit_period="yearly",
        driver_tags=["income", "savings"],
        documents=["Aadhaar Card", "Income Certificate"],
        apply_steps=["Step 1: Visit website", "Step 2: Submit form"],
        official_url="https://welfare.gov.in/test",
        status="active",
        last_verified_at=datetime.now(timezone.utc)
    )
    db.add(scheme)

    db.commit()

    token1 = create_access_token(data={"sub": str(u1_id)})
    token2 = create_access_token(data={"sub": str(u2_id)})

    aid = assessment.id
    sid = scheme.id
    db.close()

    return {
        "u1_token": token1,
        "u2_token": token2,
        "assessment_id": aid,
        "scheme_id": sid,
        "sample_input": sample_input
    }

def test_plan_determinism(test_users_and_assessment):
    fixture = test_users_and_assessment
    assessment_data = {
        "id": fixture["assessment_id"],
        "input_data": fixture["sample_input"],
        "risk_score": 640,
        "risk_band": "Moderate",
        "affordability": {"monthly_surplus": 10000.0, "emi_to_income_ratio": 0.30, "emergency_fund_months": 1.0}
    }
    plan1 = generate_plan(assessment_data, lang="en")
    plan2 = generate_plan(assessment_data, lang="en")

    assert plan1["score"] == plan2["score"]
    assert len(plan1["priorities"]) == len(plan2["priorities"])
    for p1, p2 in zip(plan1["priorities"], plan2["priorities"]):
        assert p1["key"] == p2["key"]
        assert p1["rank"] == p2["rank"]
        assert p1["est_score_gain"] == p2["est_score_gain"]

def test_ownership_check(test_users_and_assessment):
    fixture = test_users_and_assessment
    aid = fixture["assessment_id"]
    u2_headers = {"Authorization": f"Bearer {fixture['u2_token']}"}

    # 1. Plan
    res = client.get(f"/api/assessments/{aid}/plan", headers=u2_headers)
    assert res.status_code == 403

    # 2. What-if
    res = client.post("/api/whatif", json={"assessment_id": str(aid), "changes": {"monthly_emi": 10000}}, headers=u2_headers)
    assert res.status_code == 403

    # 3. Schemes
    res = client.get(f"/api/assessments/{aid}/schemes", headers=u2_headers)
    assert res.status_code == 403

    # 4. Report PDF
    res = client.get(f"/api/assessments/{aid}/report.pdf", headers=u2_headers)
    assert res.status_code == 403

def test_whatif_bounds_validation(test_users_and_assessment):
    fixture = test_users_and_assessment
    aid = str(fixture["assessment_id"])
    u1_headers = {"Authorization": f"Bearer {fixture['u1_token']}"}

    # Negative EMI -> 422
    res = client.post("/api/whatif", json={"assessment_id": aid, "changes": {"monthly_emi": -500}}, headers=u1_headers)
    assert res.status_code == 422

    # Zero or negative income -> 422
    res = client.post("/api/whatif", json={"assessment_id": aid, "changes": {"annual_income": 0}}, headers=u1_headers)
    assert res.status_code == 422

    # Negative savings -> 422
    res = client.post("/api/whatif", json={"assessment_id": aid, "changes": {"savings": -100}}, headers=u1_headers)
    assert res.status_code == 422

def test_benefit_normalisation():
    s_monthly = Scheme(benefit_type="cash", benefit_amount_inr=1500, benefit_period="monthly")
    norm_m = normalize_benefit(s_monthly)
    assert norm_m["annual_inr"] == 18000.0
    assert norm_m["monthly_inr"] == 1500.0
    assert norm_m["type"] == "cash"

    s_yearly = Scheme(benefit_type="cash", benefit_amount_inr=6000, benefit_period="yearly")
    norm_y = normalize_benefit(s_yearly)
    assert norm_y["annual_inr"] == 6000.0
    assert norm_y["monthly_inr"] == 500.0

    s_unquant = Scheme(benefit_type="unquantified", benefit_amount_inr=None, benefit_period=None)
    norm_u = normalize_benefit(s_unquant)
    assert norm_u["annual_inr"] is None
    assert norm_u["monthly_inr"] is None
    assert norm_u["type"] == "unquantified"

def test_missed_summary_arithmetic(test_users_and_assessment):
    fixture = test_users_and_assessment
    aid = fixture["assessment_id"]
    u1_headers = {"Authorization": f"Bearer {fixture['u1_token']}"}

    res = client.get(f"/api/assessments/{aid}/schemes", headers=u1_headers)
    assert res.status_code == 200
    data = res.json()
    assert "matched" in data
    assert "missed_summary" in data

    summary = data["missed_summary"]
    assert "count" in summary
    assert "total_annual_inr" in summary
    assert "unquantified_count" in summary
    assert summary["count"] >= 0

def test_localization_fallback():
    # English
    en_title = t("priority.reduce_emi_20.title", "en")
    assert "20%" in en_title

    # Hindi
    hi_title = t("priority.reduce_emi_20.title", "hi")
    assert "20%" in hi_title or "२०%" in hi_title

    # Marathi
    mr_title = t("priority.reduce_emi_20.title", "mr")
    assert "२०%" in mr_title or "20%" in mr_title

    # Missing key fallback
    fallback = t("non_existent_key_12345", "hi", default="Default Value")
    assert fallback == "Default Value"

def test_pdf_report_valid_header(test_users_and_assessment):
    fixture = test_users_and_assessment
    aid = fixture["assessment_id"]
    u1_headers = {"Authorization": f"Bearer {fixture['u1_token']}"}

    res = client.get(f"/api/assessments/{aid}/report.pdf?lang=en", headers=u1_headers)
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF")

def test_active_scheme_validation():
    # Attempting to create an active scheme without official_url should fail validation
    with pytest.raises(ValueError):
        SchemeCreate(
            name="Incomplete Scheme",
            slug="incomplete-scheme",
            status="active",
            official_url=None,
            documents=["Doc A"],
            apply_steps=["Step 1"],
            last_verified_at=datetime.now(timezone.utc)
        )

    # Attempting to create an active scheme without documents should fail
    with pytest.raises(ValueError):
        SchemeCreate(
            name="Incomplete Scheme",
            slug="incomplete-scheme",
            status="active",
            official_url="https://gov.in",
            documents=[],
            apply_steps=["Step 1"],
            last_verified_at=datetime.now(timezone.utc)
        )

def test_scheme_checklist_public_access(test_users_and_assessment):
    fixture = test_users_and_assessment
    sid = fixture["scheme_id"]

    # Public endpoint without Auth headers
    res = client.get(f"/api/schemes/{sid}/checklist")
    assert res.status_code == 200
    data = res.json()
    assert "documents" in data
    assert "steps" in data
    assert len(data["documents"]) > 0
    assert "official_url" in data

def test_put_scheme_my_status(test_users_and_assessment):
    fixture = test_users_and_assessment
    sid = str(fixture["scheme_id"])
    u1_headers = {"Authorization": f"Bearer {fixture['u1_token']}"}

    # Set status to using
    res = client.put(f"/api/schemes/{sid}/my-status", json={"status": "using"}, headers=u1_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "using"

    # Set status to not_using
    res = client.put(f"/api/schemes/{sid}/my-status", json={"status": "not_using"}, headers=u1_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "not_using"
