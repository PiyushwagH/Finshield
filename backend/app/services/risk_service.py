import sys
import os
import uuid
from pathlib import Path
from sqlalchemy.orm import Session
import logging

from app.models.assessment import Assessment

# Append ml directory to sys.path so we can import FinShieldPredictor
ml_path = Path(__file__).resolve().parent.parent.parent.parent / "ml"
if str(ml_path) not in sys.path:
    sys.path.append(str(ml_path))

from finshield_predictor import FinShieldPredictor

logger = logging.getLogger(__name__)

# Global predictor instance
# The model path is relative to the current working directory, so we should make it absolute
model_path = ml_path / "finshield_model.pkl"
predictor = FinShieldPredictor(str(model_path))


def startup_check():
    """
    Runs the known sample input from finshield_predictor.py's __main__ block.
    If the result is not ~0.0232 (default_probability), it logs a loud error.
    """
    logger.info("Running ML startup check...")
    sample = {
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
    
    try:
        res = predictor.predict(sample)
        prob = res.get("default_probability")
        if prob is None or abs(prob - 0.0232) > 0.0001:
            logger.error(f"CRITICAL: Startup check failed! Expected 0.0232, got {prob}. Dependency drift detected.")
        else:
            logger.info(f"Startup check passed. default_probability: {prob}")
    except Exception as e:
        logger.error(f"CRITICAL: Startup check failed to run! {e}")
        

def assess(db: Session, form_data: dict, user_id: uuid.UUID) -> Assessment:
    """
    Calls predictor.predict(), persists the result to the assessments table,
    and returns the saved model.
    """
    prediction = predictor.predict(form_data)
    
    # Extract values for the DB
    default_prob = prediction.get("default_probability")
    risk_band = prediction.get("risk_band")
    risk_score = prediction.get("risk_score")
    population_percentile = prediction.get("population_percentile")
    affordability = prediction.get("affordability")
    factors = prediction.get("factors")
    model_meta = prediction.get("model_meta", {})
    
    # Save to assessments table
    assessment = Assessment(
        user_id=user_id,
        input_data=form_data,
        default_probability=default_prob,
        risk_band=risk_band,
        risk_score=risk_score,
        population_percentile=population_percentile,
        affordability=affordability,
        factors=factors,
        model_version=str(model_meta.get("auc", "1.0"))  # using AUC as version identifier since there's no explicit version
    )
    
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    
    return assessment
