from pydantic import BaseModel, Field
from typing import Optional, List, Union, Any, Dict
from uuid import UUID

class WhatIfChanges(BaseModel):
    monthly_emi: Optional[float] = Field(None, ge=0, le=5_000_000, description="Monthly EMI in INR")
    savings: Optional[float] = Field(None, ge=0, le=100_000_000, description="Liquid savings in INR")
    monthly_expenditure: Optional[float] = Field(None, ge=0, le=5_000_000, description="Monthly living expenditure in INR")
    annual_income: Optional[float] = Field(None, gt=0, le=500_000_000, description="Annual income in INR")

class WhatIfRequest(BaseModel):
    assessment_id: Union[UUID, str]
    changes: WhatIfChanges = Field(default_factory=WhatIfChanges)
    scheme_ids: Optional[List[Union[str, int, UUID]]] = Field(default_factory=list)

class ModelScoreSummary(BaseModel):
    score: int
    band: str
    default_probability: float

class AffordabilitySummary(BaseModel):
    grade: str
    monthly_surplus: float
    surplus_ratio: float
    emi_to_income_ratio: float
    emergency_fund_months: Optional[float] = None
    flags: List[str] = []

class WhatIfResponse(BaseModel):
    base: ModelScoreSummary
    scenario: ModelScoreSummary
    score_delta: int
    affordability_base: AffordabilitySummary
    affordability_scenario: AffordabilitySummary
    scheme_benefit_monthly_inr: float
    disclaimer: str
