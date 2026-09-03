"""
FinShield backend.

    pip install fastapi uvicorn lightgbm pandas scikit-learn pydantic
    uvicorn api:app --reload --port 8000

    POST /api/assess   -> risk assessment
    GET  /api/health   -> liveness + model metadata
    GET  /api/schema   -> the exact option values the frontend must send
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal

from finshield_predictor import (
    FinShieldPredictor, EDUCATION_MAP, MARITAL_MAP,
    EMPLOYMENT_MAP, PAYMENT_HISTORY_MAP, GENDER_MAP,
)

app = FastAPI(title="FinShield API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

predictor = FinShieldPredictor("finshield_model.pkl")


class AssessmentRequest(BaseModel):
    # Section 1 - Personal
    age: int = Field(..., ge=18, le=100)
    gender: Literal["male", "female", "other", "prefer_not_to_say"]
    education: Literal["below_10th", "secondary", "higher_secondary",
                       "diploma", "bachelors", "masters", "doctorate"]
    marital_status: Literal["single", "married", "live_in",
                            "separated", "divorced", "widowed"]
    dependents: int = Field(0, ge=0, le=15)

    # Section 2 - Employment & income
    employment_status: Literal["salaried_private", "salaried_government",
                               "self_employed", "business_owner", "student",
                               "retired", "unemployed", "homemaker"]
    years_employed: float = Field(0, ge=0, le=60)
    annual_income: float = Field(..., gt=0)

    # Section 3 - Existing financial situation
    monthly_emi: float = Field(0, ge=0)
    existing_total_debt: float = Field(0, ge=0)
    asset_value: float = Field(0, ge=0)
    monthly_expenditure: float = Field(0, ge=0)
    savings: float = Field(0, ge=0)
    owns_vehicle: bool = False
    owns_property: bool = False

    # Section 4 - Credit & payment history
    has_prior_credit: bool = False
    has_defaulted: bool = False
    payment_history: Literal["excellent", "good", "fair", "poor", "no_history"] = "no_history"
    n_prior_credits: int = Field(0, ge=0, le=50)
    n_active_credits: int = Field(0, ge=0, le=50)
    years_credit_history: float = Field(0, ge=0, le=60)

    @field_validator("years_employed")
    @classmethod
    def employment_fits_age(cls, v, info):
        age = info.data.get("age")
        if age and v > age - 14:
            raise ValueError("years_employed is not consistent with age")
        return v


@app.get("/api/health")
def health():
    return {"status": "ok", "model": predictor.metrics}


@app.get("/api/schema")
def schema():
    """Dropdown values the frontend must send, so the two never drift apart."""
    return {
        "gender": list(GENDER_MAP),
        "education": list(EDUCATION_MAP),
        "marital_status": list(MARITAL_MAP),
        "employment_status": list(EMPLOYMENT_MAP),
        "payment_history": list(PAYMENT_HISTORY_MAP),
    }


@app.post("/api/assess")
def assess(req: AssessmentRequest):
    try:
        result = predictor.predict(req.model_dump())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"scoring failed: {e}")

    result["disclaimer"] = (
        "Indicative risk estimate produced by a statistical model trained on "
        "the public Home Credit Default Risk dataset. Not a credit decision "
        "and not a substitute for a licensed lender's underwriting."
    )
    return result
