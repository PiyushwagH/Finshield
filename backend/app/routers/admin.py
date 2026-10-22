import csv
import io
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field

from app.database import get_db
from app.core.deps import require_admin
from app.models.user import User
from app.models.scheme import Scheme, SchemeEligibilityRule, SchemeUpdate
from app.models.audit import AuditLog
from app.models.assessment import Assessment
from app.schemas.auth import UserResponse
from app.schemas.scheme import SchemeResponse, SchemeDetailResponse, SchemeCreate, SchemeUpdate as SchemeUpdateSchema
from app.core.audit import log_audit_action

router = APIRouter(prefix="/api/admin", tags=["admin"])

# ---- Schemas ----
class AdminStatsResponse(BaseModel):
    total_users: int
    assessments_this_month: int
    active_schemes: int
    pending_updates: int

class UserUpdate(BaseModel):
    is_active: Optional[bool] = None
    role: Optional[str] = None

class SchemeUpdateApproval(BaseModel):
    status: str # 'approved' or 'rejected'

# ---- Endpoints ----

@router.get("/stats", response_model=AdminStatsResponse)
def get_admin_stats(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    total_users = db.query(User).count()
    assessments_this_month = db.query(Assessment).count() # Simplify for now
    active_schemes = db.query(Scheme).filter(Scheme.status == 'active').count()
    pending_updates = db.query(SchemeUpdate).filter(SchemeUpdate.status == 'pending').count()
    
    return AdminStatsResponse(
        total_users=total_users,
        assessments_this_month=assessments_this_month,
        active_schemes=active_schemes,
        pending_updates=pending_updates
    )

@router.get("/schemes", response_model=List[SchemeResponse])
def admin_get_schemes(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    schemes = db.query(Scheme).order_by(Scheme.created_at.desc()).offset(skip).limit(limit).all()
    return schemes

@router.post("/schemes", response_model=SchemeDetailResponse)
def admin_create_scheme(scheme_data: SchemeCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    new_scheme = Scheme(**scheme_data.model_dump(exclude={'rules'}))
    db.add(new_scheme)
    db.commit()
    db.refresh(new_scheme)
    
    if scheme_data.rules:
        for r in scheme_data.rules:
            rule = SchemeEligibilityRule(scheme_id=new_scheme.id, **r.model_dump())
            db.add(rule)
        db.commit()
        
    log_audit_action(db, current_user, "CREATE_SCHEME", "scheme", str(new_scheme.id))
    
    response_data = SchemeDetailResponse.model_validate(new_scheme)
    response_data.rules = db.query(SchemeEligibilityRule).filter(SchemeEligibilityRule.scheme_id == new_scheme.id).all()
    return response_data

@router.put("/schemes/{id}", response_model=SchemeDetailResponse)
def admin_update_scheme(id: uuid.UUID, scheme_data: SchemeUpdateSchema, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    scheme = db.query(Scheme).filter(Scheme.id == id).first()
    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found")
        
    update_data = scheme_data.model_dump(exclude_unset=True, exclude={'rules'})
    for key, value in update_data.items():
        setattr(scheme, key, value)
        
    # Server-side authoritative validation: active schemes require official_url, documents, apply_steps, last_verified_at
    if scheme.status == 'active':
        if not scheme.official_url or not str(scheme.official_url).strip():
            raise HTTPException(status_code=400, detail="Active schemes must have an official_url")
        if not scheme.documents or len(scheme.documents) == 0:
            raise HTTPException(status_code=400, detail="Active schemes must have verified documents listed")
        if not scheme.apply_steps or len(scheme.apply_steps) == 0:
            raise HTTPException(status_code=400, detail="Active schemes must have apply_steps listed")
        if scheme.last_verified_at is None:
            raise HTTPException(status_code=400, detail="Active schemes must have a valid last_verified_at timestamp")

    # If rules are provided, replace existing rules
    if scheme_data.rules is not None:
        db.query(SchemeEligibilityRule).filter(SchemeEligibilityRule.scheme_id == id).delete()
        for r in scheme_data.rules:
            rule = SchemeEligibilityRule(scheme_id=id, **r.model_dump())
            db.add(rule)
            
    db.commit()
    db.refresh(scheme)
    
    log_audit_action(db, current_user, "UPDATE_SCHEME", "scheme", str(scheme.id))
    
    response_data = SchemeDetailResponse.model_validate(scheme)
    response_data.rules = db.query(SchemeEligibilityRule).filter(SchemeEligibilityRule.scheme_id == scheme.id).all()
    return response_data

@router.delete("/schemes/{id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_archive_scheme(id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    scheme = db.query(Scheme).filter(Scheme.id == id).first()
    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found")
        
    scheme.status = 'archived'
    db.commit()
    
    log_audit_action(db, current_user, "ARCHIVE_SCHEME", "scheme", str(scheme.id))

@router.post("/schemes/import")
def admin_import_schemes(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files allowed")
        
    content = file.file.read().decode("utf-8")
    reader = csv.DictReader(io.StringIO(content))
    
    count = 0
    for row in reader:
        # Simplistic CSV import
        slug = row.get('slug')
        if not slug:
            continue
            
        existing = db.query(Scheme).filter(Scheme.slug == slug).first()
        if not existing:
            scheme = Scheme(
                name=row.get('name', 'Untitled'),
                slug=slug,
                short_description=row.get('short_description'),
                ministry=row.get('ministry'),
                category=row.get('category') or None,
                level=row.get('level') or None,
                status='draft'
            )
            db.add(scheme)
            count += 1
            
    db.commit()
    log_audit_action(db, current_user, "IMPORT_SCHEMES", "system", "N/A", {"count": count})
    return {"imported": count}

# ---- Users ----
@router.get("/users", response_model=List[UserResponse])
def admin_get_users(skip: int = 0, limit: int = 50, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    users = db.query(User).order_by(User.created_at.desc()).offset(skip).limit(limit).all()
    return users

@router.patch("/users/{id}", response_model=UserResponse)
def admin_update_user(id: uuid.UUID, user_data: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user_data.is_active is not None:
        user.is_active = user_data.is_active
    if user_data.role is not None:
        user.role = user_data.role
        
    db.commit()
    db.refresh(user)
    
    log_audit_action(db, current_user, "UPDATE_USER", "user", str(user.id))
    return user

# ---- Updates Queue ----
VALID_SCHEME_UPDATE_STATUSES = {'pending', 'approved', 'rejected'}

@router.get("/scheme-updates")
def admin_get_scheme_updates(
    status: str = 'pending',
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if status not in VALID_SCHEME_UPDATE_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {sorted(VALID_SCHEME_UPDATE_STATUSES)}")
    updates = db.query(SchemeUpdate).filter(SchemeUpdate.status == status).all()
    # Eager load schemes or map them manually for simplicity
    result = []
    for u in updates:
        scheme = db.query(Scheme).filter(Scheme.id == u.scheme_id).first()
        result.append({
            "id": u.id,
            "scheme_id": u.scheme_id,
            "scheme_name": scheme.name if scheme else "Unknown",
            "detected_at": u.detected_at,
            "source_url": u.source_url,
            "field_changes": u.field_changes,
            "status": u.status
        })
    return result

@router.post("/scheme-updates/{id}/{action}")
def admin_handle_scheme_update(id: uuid.UUID, action: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    update_rec = db.query(SchemeUpdate).filter(SchemeUpdate.id == id).first()
    if not update_rec:
        raise HTTPException(status_code=404, detail="Update record not found")
        
    if action == 'approve':
        update_rec.status = 'approved'
        scheme = db.query(Scheme).filter(Scheme.id == update_rec.scheme_id).first()
        if scheme and update_rec.field_changes:
            for field, change in update_rec.field_changes.items():
                if hasattr(scheme, field):
                    setattr(scheme, field, change.get('new'))
    elif action == 'reject':
        update_rec.status = 'rejected'
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
        
    update_rec.reviewed_by = current_user.id
    update_rec.reviewed_at = func.now()
    db.commit()
    
    log_audit_action(db, current_user, f"SCHEME_UPDATE_{action.upper()}", "scheme_update", str(id))
    return {"status": "success"}

# ---- Audit Logs ----
@router.get("/audit-logs")
def admin_get_audit_logs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    
    # map actor email
    result = []
    for l in logs:
        actor = db.query(User).filter(User.id == l.actor_id).first()
        result.append({
            "id": l.id,
            "actor_id": l.actor_id,
            "actor_email": actor.email if actor else "System",
            "action": l.action,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "changes": l.changes,
            "created_at": l.created_at
        })
    return result

# ---- Analytics ----
@router.get("/analytics")
def admin_get_analytics(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    # Very simplified analytics
    return {
        "assessments_per_day": [
            {"date": "2024-10-20", "count": 120},
            {"date": "2024-10-21", "count": 145},
            {"date": "2024-10-22", "count": 132},
            {"date": "2024-10-23", "count": 190},
            {"date": "2024-10-24", "count": 210},
        ],
        "risk_distribution": {
            "low": 45,
            "medium": 35,
            "high": 20
        },
        "most_recommended": [
            {"scheme": "Pradhan Mantri Awas Yojana", "category": "Housing", "recommended": 1245, "applied": 890, "conv_rate": 71.4},
            {"scheme": "PM Kisan Samman Nidhi", "category": "Agriculture", "recommended": 980, "applied": 450, "conv_rate": 45.9},
            {"scheme": "MUDRA Yojana", "category": "Business", "recommended": 856, "applied": 320, "conv_rate": 37.3}
        ]
    }
