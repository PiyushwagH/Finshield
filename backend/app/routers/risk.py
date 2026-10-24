from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import uuid
from typing import List

from app.database import get_db
from app.models.user import User
from app.core.deps import get_current_user
from app.schemas.risk import AssessmentRequest, AssessmentResponse, AdviceItem
from app.services import risk_service, advice_service
from app.services.risk_rules import apply_safety_rules
from app.models.assessment import Assessment
import sys
from pathlib import Path

# Needed to import maps from finshield_predictor
ml_path = Path(__file__).resolve().parent.parent.parent.parent / "ml"
if str(ml_path) not in sys.path:
    sys.path.append(str(ml_path))

from finshield_predictor import EDUCATION_MAP, MARITAL_MAP, EMPLOYMENT_MAP, PAYMENT_HISTORY_MAP, GENDER_MAP

router = APIRouter(prefix="/api/risk", tags=["Risk"])


def _model_meta() -> dict:
    metrics = risk_service.predictor.metrics
    return {
        "auc": round(metrics["auc"], 4),
        "trained_on": metrics["n_train"],
        "population_default_rate": round(metrics["base_rate"], 4),
    }


def to_response(a: Assessment, model_meta: dict) -> AssessmentResponse:
    """Build the API response for a stored assessment.

    The model's own outputs are returned unchanged; final_band layers the
    rule-based safety floor on top, and advice follows the final band so a
    user with a past default isn't told their profile is "excellent".
    """
    adjustment = apply_safety_rules(a.input_data, a.affordability, a.risk_band)
    advice = advice_service.generate_advice(
        {"risk_band": adjustment["final_band"], "affordability": a.affordability}
    )
    return AssessmentResponse(
        id=a.id, user_id=a.user_id, created_at=a.created_at, input_data=a.input_data,
        default_probability=a.default_probability, risk_band=a.risk_band,
        risk_score=a.risk_score, population_percentile=a.population_percentile,
        affordability=a.affordability, factors=a.factors, model_version=a.model_version,
        model_meta=model_meta, advice=advice,
        final_band=adjustment["final_band"], band_adjustment=adjustment,
    )


@router.post("/assess", response_model=AssessmentResponse)
def assess_risk(
    req: AssessmentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        assessment = risk_service.assess(db, req.model_dump(), current_user.id)
        return to_response(assessment, _model_meta())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/schema")
def get_schema():
    return {
        "gender": list(GENDER_MAP),
        "education": list(EDUCATION_MAP),
        "marital_status": list(MARITAL_MAP),
        "employment_status": list(EMPLOYMENT_MAP),
        "payment_history": list(PAYMENT_HISTORY_MAP),
    }

@router.get("/assessments", response_model=List[AssessmentResponse])
def list_assessments(
    skip: int = 0, limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    assessments = db.query(Assessment).filter(
        Assessment.user_id == current_user.id
    ).order_by(Assessment.created_at.desc()).offset(skip).limit(limit).all()
    meta = _model_meta()
    return [to_response(a, meta) for a in assessments]

@router.get("/assessments/compare", response_model=List[AssessmentResponse])
def compare_assessments(
    ids: str = Query(..., description="Comma separated list of assessment UUIDs to compare"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    id_list = [uuid.UUID(i.strip()) for i in ids.split(",") if i.strip()]
    assessments = db.query(Assessment).filter(
        Assessment.id.in_(id_list),
        Assessment.user_id == current_user.id
    ).all()

    if len(assessments) != len(id_list):
        raise HTTPException(status_code=404, detail="One or more assessments not found")

    meta = _model_meta()
    return [to_response(a, meta) for a in assessments]

@router.get("/assessments/{assessment_id}", response_model=AssessmentResponse)
def get_assessment(
    assessment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    a = db.query(Assessment).filter(
        Assessment.id == assessment_id,
        Assessment.user_id == current_user.id
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return to_response(a, _model_meta())
