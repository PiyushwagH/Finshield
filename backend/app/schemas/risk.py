from pydantic import BaseModel, Field, field_validator
from typing import Literal, Optional, List, Dict, Any
import uuid
from datetime import datetime

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

class AdviceItem(BaseModel):
    title: str
    body: str
    priority: str
    category: str

class AssessmentResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    input_data: Dict[str, Any]
    default_probability: float
    risk_band: str
    risk_score: int
    population_percentile: float
    affordability: Dict[str, Any]
    factors: Dict[str, Any]
    model_version: str
    model_meta: Dict[str, Any] = {}
    advice: List[AdviceItem] = []
    # risk_band above is the model's own band (unchanged, stored). final_band
    # adds the rule-based safety floor - see services/risk_rules.py.
    final_band: str = ""
    band_adjustment: Dict[str, Any] = {}

    class Config:
        from_attributes = True
