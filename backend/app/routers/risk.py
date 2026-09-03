from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import uuid
from typing import List

from app.database import get_db
from app.models.user import User
from app.core.deps import get_current_user
from app.schemas.risk import AssessmentRequest, AssessmentResponse, AdviceItem
from app.services import risk_service, advice_service
from app.models.assessment import Assessment
import sys
from pathlib import Path

# Needed to import maps from finshield_predictor
ml_path = Path(__file__).resolve().parent.parent.parent.parent / "ml"
if str(ml_path) not in sys.path:
    sys.path.append(str(ml_path))

from finshield_predictor import EDUCATION_MAP, MARITAL_MAP, EMPLOYMENT_MAP, PAYMENT_HISTORY_MAP, GENDER_MAP

router = APIRouter(prefix="/api/risk", tags=["Risk"])

@router.post("/assess", response_model=AssessmentResponse)
def assess_risk(
    req: AssessmentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        # Generate prediction and persist
        assessment = risk_service.assess(db, req.model_dump(), current_user.id)
        
        # Format prediction output for advice engine
        prediction_output = {
            "risk_band": assessment.risk_band,
            "affordability": assessment.affordability
        }
        
        # Generate advice
        advice = advice_service.generate_advice(prediction_output)
        
        # Get static model meta
        metrics = risk_service.predictor.metrics
        model_meta = {
            "auc": round(metrics["auc"], 4),
            "trained_on": metrics["n_train"],
            "population_default_rate": round(metrics["base_rate"], 4)
        }
        
        # Build response
        return AssessmentResponse(
            id=assessment.id,
            user_id=assessment.user_id,
            created_at=assessment.created_at,
            input_data=assessment.input_data,
            default_probability=assessment.default_probability,
            risk_band=assessment.risk_band,
            risk_score=assessment.risk_score,
            population_percentile=assessment.population_percentile,
            affordability=assessment.affordability,
            factors=assessment.factors,
            model_version=assessment.model_version,
            model_meta=model_meta,
            advice=advice
        )
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
    
    metrics = risk_service.predictor.metrics
    model_meta = {
        "auc": round(metrics["auc"], 4),
        "trained_on": metrics["n_train"],
        "population_default_rate": round(metrics["base_rate"], 4)
    }
    
    responses = []
    for a in assessments:
        prediction_output = {"risk_band": a.risk_band, "affordability": a.affordability}
        advice = advice_service.generate_advice(prediction_output)
        responses.append(
            AssessmentResponse(
                id=a.id,
                user_id=a.user_id,
                created_at=a.created_at,
                input_data=a.input_data,
                default_probability=a.default_probability,
                risk_band=a.risk_band,
                risk_score=a.risk_score,
                population_percentile=a.population_percentile,
                affordability=a.affordability,
                factors=a.factors,
                model_version=a.model_version,
                model_meta=model_meta,
                advice=advice
            )
        )
    return responses

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
        
    metrics = risk_service.predictor.metrics
    model_meta = {
        "auc": round(metrics["auc"], 4),
        "trained_on": metrics["n_train"],
        "population_default_rate": round(metrics["base_rate"], 4)
    }

    responses = []
    for a in assessments:
        prediction_output = {"risk_band": a.risk_band, "affordability": a.affordability}
        advice = advice_service.generate_advice(prediction_output)
        responses.append(
            AssessmentResponse(
                id=a.id, user_id=a.user_id, created_at=a.created_at, input_data=a.input_data,
                default_probability=a.default_probability, risk_band=a.risk_band,
                risk_score=a.risk_score, population_percentile=a.population_percentile,
                affordability=a.affordability, factors=a.factors, model_version=a.model_version,
                model_meta=model_meta, advice=advice
            )
        )
    return responses

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
        
    prediction_output = {"risk_band": a.risk_band, "affordability": a.affordability}
    advice = advice_service.generate_advice(prediction_output)
    
    metrics = risk_service.predictor.metrics
    model_meta = {
        "auc": round(metrics["auc"], 4),
        "trained_on": metrics["n_train"],
        "population_default_rate": round(metrics["base_rate"], 4)
    }

    return AssessmentResponse(
        id=a.id, user_id=a.user_id, created_at=a.created_at, input_data=a.input_data,
        default_probability=a.default_probability, risk_band=a.risk_band,
        risk_score=a.risk_score, population_percentile=a.population_percentile,
        affordability=a.affordability, factors=a.factors, model_version=a.model_version,
        model_meta=model_meta, advice=advice
    )
