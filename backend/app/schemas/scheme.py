from pydantic import BaseModel, model_validator
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from uuid import UUID
from decimal import Decimal

# --- Rules ---
class EligibilityRuleBase(BaseModel):
    field: str
    operator: str
    value: Union[List[Any], Any]
    logic_group: int

class EligibilityRuleResponse(EligibilityRuleBase):
    id: UUID
    scheme_id: UUID

    class Config:
        from_attributes = True

# --- Scheme ---
class SchemeBase(BaseModel):
    name: str
    slug: str
    short_description: Optional[str] = None
    full_description: Optional[str] = None
    ministry: Optional[str] = None
    category: Optional[str] = None
    level: Optional[str] = None
    state: Optional[str] = None
    benefit_type: Optional[str] = None
    benefit_amount: Optional[Decimal] = None
    benefit_description: Optional[str] = None
    
    # Extended fields
    benefit_amount_inr: Optional[Decimal] = None
    benefit_period: Optional[str] = None  # monthly, yearly, one_time
    driver_tags: Optional[List[str]] = []
    documents: Optional[List[str]] = []
    apply_steps: Optional[List[str]] = []
    last_verified_at: Optional[datetime] = None

    official_url: Optional[str] = None
    application_mode: Optional[str] = None
    required_documents: Optional[List[str]] = None
    status: str
    source_url: Optional[str] = None

class SchemeCreate(SchemeBase):
    rules: Optional[List[EligibilityRuleBase]] = []

    @model_validator(mode="after")
    def validate_active_scheme(self):
        if self.status == "active":
            if not self.official_url or not str(self.official_url).strip():
                raise ValueError("Active schemes must have an official_url")
            if not self.documents or len(self.documents) == 0:
                raise ValueError("Active schemes must have verified documents listed")
            if not self.apply_steps or len(self.apply_steps) == 0:
                raise ValueError("Active schemes must have apply_steps listed")
            if self.last_verified_at is None:
                raise ValueError("Active schemes must have a valid last_verified_at timestamp")
        return self

class SchemeUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    short_description: Optional[str] = None
    full_description: Optional[str] = None
    ministry: Optional[str] = None
    category: Optional[str] = None
    level: Optional[str] = None
    state: Optional[str] = None
    benefit_type: Optional[str] = None
    benefit_amount: Optional[Decimal] = None
    benefit_description: Optional[str] = None
    
    # Extended fields
    benefit_amount_inr: Optional[Decimal] = None
    benefit_period: Optional[str] = None
    driver_tags: Optional[List[str]] = None
    documents: Optional[List[str]] = None
    apply_steps: Optional[List[str]] = None
    last_verified_at: Optional[datetime] = None

    official_url: Optional[str] = None
    application_mode: Optional[str] = None
    required_documents: Optional[List[str]] = None
    status: Optional[str] = None
    source_url: Optional[str] = None
    rules: Optional[List[EligibilityRuleBase]] = None

    @model_validator(mode="after")
    def validate_active_update(self):
        if self.status == "active":
            if self.official_url is not None and not str(self.official_url).strip():
                raise ValueError("Active schemes must have an official_url")
            if self.documents is not None and len(self.documents) == 0:
                raise ValueError("Active schemes must have verified documents listed")
            if self.apply_steps is not None and len(self.apply_steps) == 0:
                raise ValueError("Active schemes must have apply_steps listed")
        return self

class SchemeResponse(SchemeBase):
    id: UUID
    last_synced_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class SchemeDetailResponse(SchemeResponse):
    rules: List[EligibilityRuleResponse] = []

    class Config:
        from_attributes = True

# --- Scheme Checklist ---
class SchemeChecklistResponse(BaseModel):
    scheme_id: UUID
    documents: List[str] = []
    steps: List[str] = []
    official_url: Optional[str] = None
    last_verified_at: Optional[datetime] = None

# --- User Scheme Status (Already using / Not using) ---
class SchemeMyStatusRequest(BaseModel):
    status: str

    @model_validator(mode="after")
    def validate_status(self):
        s = (self.status or "").strip().lower()
        if s not in ["using", "not_using"]:
            raise ValueError("status must be either 'using' or 'not_using'")
        self.status = s
        return self

class SchemeMyStatusResponse(BaseModel):
    scheme_id: UUID
    status: str

# --- Match Profiles ---
class QuickMatchProfile(BaseModel):
    age: int
    state: Optional[str] = None
    area_type: Optional[str] = None
    occupation_tags: Optional[List[str]] = None
    annual_income: Optional[float] = None
    gender: Optional[str] = None

class MatchProfile(BaseModel):
    age: int
    gender: str
    education: str
    marital_status: str
    dependents: int
    employment_status: str
    years_employed: float
    annual_income: float
    monthly_emi: float
    existing_total_debt: float
    asset_value: float
    monthly_expenditure: float
    savings: float
    owns_vehicle: bool
    owns_property: bool
    state: Optional[str] = None
    area_type: Optional[str] = None
    occupation_tags: Optional[List[str]] = None

# --- User Scheme (Tracker) ---
class UserSchemeCreate(BaseModel):
    scheme_id: UUID

class UserSchemeUpdate(BaseModel):
    status: str
    notes: Optional[str] = None
    application_number: Optional[str] = None

class UserSchemeResponse(BaseModel):
    id: UUID
    user_id: UUID
    scheme_id: UUID
    status: str
    notes: Optional[str] = None
    application_number: Optional[str] = None
    saved_at: datetime
    updated_at: Optional[datetime] = None
    scheme: Optional[SchemeResponse] = None

    class Config:
        from_attributes = True
