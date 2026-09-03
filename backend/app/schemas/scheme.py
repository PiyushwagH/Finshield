from pydantic import BaseModel
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from uuid import UUID
from decimal import Decimal

# --- Enums ---
# These must match the SQLAlchemy enums from models/scheme.py

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
    official_url: Optional[str] = None
    application_mode: Optional[str] = None
    required_documents: Optional[List[str]] = None
    status: str
    source_url: Optional[str] = None

class SchemeCreate(SchemeBase):
    rules: Optional[List[EligibilityRuleBase]] = []

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
    official_url: Optional[str] = None
    application_mode: Optional[str] = None
    required_documents: Optional[List[str]] = None
    status: Optional[str] = None
    source_url: Optional[str] = None
    rules: Optional[List[EligibilityRuleBase]] = None

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

# --- Match Profiles ---
class QuickMatchProfile(BaseModel):
    age: int
    state: Optional[str] = None
    area_type: Optional[str] = None
    occupation_tags: Optional[List[str]] = None
    annual_income: Optional[float] = None
    gender: Optional[str] = None

class MatchProfile(BaseModel):
    # Used for matching full assessment profiles
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
    
    # Optional nested scheme for list views
    scheme: Optional[SchemeResponse] = None

    class Config:
        from_attributes = True
