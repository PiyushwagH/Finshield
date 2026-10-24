from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import uuid

from app.database import get_db
from app.models.scheme import Scheme, UserScheme
from app.models.user import User
from app.schemas.scheme import UserSchemeCreate, UserSchemeUpdate, UserSchemeResponse, SchemeResponse
from app.core.deps import get_current_user

router = APIRouter(prefix="/api/user-schemes", tags=["user_schemes"])

@router.get("", response_model=List[UserSchemeResponse])
def get_user_schemes(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user_schemes = db.query(UserScheme).filter(UserScheme.user_id == current_user.id).all()
    
    # Eagerly load or manually attach the active scheme object for each
    results = []
    for us in user_schemes:
        scheme = db.query(Scheme).filter(Scheme.id == us.scheme_id, Scheme.status == 'active').first()
        if scheme:
            us_resp = UserSchemeResponse.model_validate(us)
            us_resp.scheme = SchemeResponse.model_validate(scheme)
            results.append(us_resp)
        
    return results

@router.post("", response_model=UserSchemeResponse)
def save_user_scheme(data: UserSchemeCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    scheme = db.query(Scheme).filter(Scheme.id == data.scheme_id, Scheme.status == 'active').first()
    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found or is inactive")

    # Check if already exists
    existing = db.query(UserScheme).filter(
        UserScheme.user_id == current_user.id, 
        UserScheme.scheme_id == data.scheme_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Scheme already saved")
        
    us = UserScheme(
        user_id=current_user.id,
        scheme_id=data.scheme_id,
        status="saved"
    )
    db.add(us)
    db.commit()
    db.refresh(us)
    
    us_resp = UserSchemeResponse.model_validate(us)
    us_resp.scheme = SchemeResponse.model_validate(scheme)
    return us_resp

@router.patch("/{id}", response_model=UserSchemeResponse)
def update_user_scheme(id: uuid.UUID, data: UserSchemeUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    us = db.query(UserScheme).filter(UserScheme.id == id, UserScheme.user_id == current_user.id).first()
    if not us:
        raise HTTPException(status_code=404, detail="User scheme tracking not found")
        
    us.status = data.status
    if data.notes is not None:
        us.notes = data.notes
    if data.application_number is not None:
        us.application_number = data.application_number
        
    db.commit()
    db.refresh(us)
    
    us_resp = UserSchemeResponse.model_validate(us)
    scheme = db.query(Scheme).filter(Scheme.id == us.scheme_id).first()
    if scheme:
        us_resp.scheme = SchemeResponse.model_validate(scheme)
    return us_resp
