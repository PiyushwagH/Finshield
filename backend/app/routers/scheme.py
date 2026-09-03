from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
import uuid

from app.database import get_db
from app.models.scheme import Scheme, SchemeEligibilityRule
from app.schemas.scheme import SchemeResponse, SchemeDetailResponse, MatchProfile, QuickMatchProfile
from app.services.eligibility_service import evaluate_scheme, rank_schemes
from app.core.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/schemes", tags=["schemes"])

@router.get("", response_model=List[SchemeResponse])
def get_schemes(
    category: Optional[str] = None,
    level: Optional[str] = None,
    state: Optional[str] = None,
    benefit_type: Optional[str] = None,
    q: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    query = db.query(Scheme).filter(Scheme.status == 'active')
    
    if category:
        query = query.filter(Scheme.category == category)
    if level:
        query = query.filter(Scheme.level == level)
    if state:
        query = query.filter(Scheme.state == state)
    if benefit_type:
        query = query.filter(Scheme.benefit_type == benefit_type)
    if q:
        query = query.filter(or_(Scheme.name.ilike(f"%{q}%"), Scheme.short_description.ilike(f"%{q}%")))
        
    schemes = query.offset(skip).limit(limit).all()
    return schemes

@router.get("/{slug}", response_model=SchemeDetailResponse)
def get_scheme_detail(slug: str, db: Session = Depends(get_db)):
    scheme = db.query(Scheme).filter(Scheme.slug == slug).first()
    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found")
        
    rules = db.query(SchemeEligibilityRule).filter(SchemeEligibilityRule.scheme_id == scheme.id).all()
    
    # We construct the response manually to inject rules
    response_data = SchemeDetailResponse.model_validate(scheme)
    response_data.rules = rules
    return response_data

@router.post("/match")
def match_schemes(profile: MatchProfile, db: Session = Depends(get_db)):
    schemes = db.query(Scheme).filter(Scheme.status == 'active').all()
    scheme_rules = []
    for s in schemes:
        rules = db.query(SchemeEligibilityRule).filter(SchemeEligibilityRule.scheme_id == s.id).all()
        scheme_rules.append((s, rules))
        
    ranked = rank_schemes(profile.model_dump(), scheme_rules)
    
    # Return matched format
    return [
        {
            "scheme": SchemeResponse.model_validate(item["scheme"]),
            "eligibility": item["eligibility"],
            "matched_criteria_count": item["matched_criteria_count"],
            "total_criteria_count": item["total_criteria_count"]
        }
        for item in ranked
    ]

@router.post("/quick-match")
def quick_match_schemes(profile: QuickMatchProfile, db: Session = Depends(get_db)):
    schemes = db.query(Scheme).filter(Scheme.status == 'active').all()
    scheme_rules = []
    for s in schemes:
        rules = db.query(SchemeEligibilityRule).filter(SchemeEligibilityRule.scheme_id == s.id).all()
        scheme_rules.append((s, rules))
        
    ranked = rank_schemes(profile.model_dump(exclude_none=True), scheme_rules)
    
    return [
        {
            "scheme": SchemeResponse.model_validate(item["scheme"]),
            "eligibility": item["eligibility"],
            "matched_criteria_count": item["matched_criteria_count"],
            "total_criteria_count": item["total_criteria_count"]
        }
        for item in ranked
    ]

@router.get("/{id}/eligibility")
def get_user_eligibility(id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    scheme = db.query(Scheme).filter(Scheme.id == id).first()
    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found")
        
    rules = db.query(SchemeEligibilityRule).filter(SchemeEligibilityRule.scheme_id == scheme.id).all()
    
    # In a real app we'd fetch the user's latest assessment profile from DB.
    # For now, we look up the latest Assessment
    from app.models.assessment import Assessment
    assessment = db.query(Assessment).filter(Assessment.user_id == current_user.id).order_by(Assessment.created_at.desc()).first()
    
    if not assessment:
        return {"error": "No assessment profile found for user"}
        
    profile_data = assessment.input_data
    eligibility = evaluate_scheme(profile_data, rules)
    
    return eligibility
