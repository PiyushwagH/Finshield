import csv
import io
import json
from datetime import datetime, timezone
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from pydantic import BaseModel, Field

from app.database import get_db
from app.core.deps import require_admin
from app.models.user import User
from app.models.scheme import Scheme, SchemeEligibilityRule, SchemeUpdate, UserScheme, UserSchemeStatus
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

class SchemeStatusUpdate(BaseModel):
    status: str # 'active', 'archived', 'draft', 'needs_review'

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

@router.get("/schemes/{id_or_slug}", response_model=SchemeDetailResponse)
def admin_get_scheme_detail(id_or_slug: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    scheme = None
    try:
        uid = uuid.UUID(id_or_slug)
        scheme = db.query(Scheme).filter(Scheme.id == uid).first()
    except ValueError:
        scheme = db.query(Scheme).filter(Scheme.slug == id_or_slug).first()

    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found")

    response_data = SchemeDetailResponse.model_validate(scheme)
    response_data.rules = db.query(SchemeEligibilityRule).filter(SchemeEligibilityRule.scheme_id == scheme.id).all()
    return response_data

@router.patch("/schemes/{id}/status", response_model=SchemeDetailResponse)
def admin_update_scheme_status(
    id: uuid.UUID,
    status_data: SchemeStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    scheme = db.query(Scheme).filter(Scheme.id == id).first()
    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found")

    valid_statuses = {'active', 'archived', 'draft', 'needs_review'}
    if status_data.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status must be one of {sorted(valid_statuses)}")

    if status_data.status == 'active':
        if not scheme.official_url or not str(scheme.official_url).strip():
            raise HTTPException(status_code=400, detail="Active schemes must have an official_url")
        if not scheme.documents or len(scheme.documents) == 0:
            raise HTTPException(status_code=400, detail="Active schemes must have verified documents listed")
        if not scheme.apply_steps or len(scheme.apply_steps) == 0:
            raise HTTPException(status_code=400, detail="Active schemes must have apply_steps listed")
        if scheme.last_verified_at is None:
            raise HTTPException(status_code=400, detail="Active schemes must have a valid last_verified_at timestamp")

    scheme.status = status_data.status
    db.commit()
    db.refresh(scheme)

    log_audit_action(db, current_user, f"UPDATE_SCHEME_STATUS_{status_data.status.upper()}", "scheme", str(scheme.id), {"new_status": status_data.status})

    response_data = SchemeDetailResponse.model_validate(scheme)
    response_data.rules = db.query(SchemeEligibilityRule).filter(SchemeEligibilityRule.scheme_id == scheme.id).all()
    return response_data

@router.delete("/schemes/{id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_scheme(
    id: uuid.UUID,
    permanent: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    scheme = db.query(Scheme).filter(Scheme.id == id).first()
    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found")

    if permanent:
        scheme_name = scheme.name
        # Delete related child records first to honor foreign key constraints
        db.query(SchemeEligibilityRule).filter(SchemeEligibilityRule.scheme_id == id).delete(synchronize_session=False)
        db.query(UserScheme).filter(UserScheme.scheme_id == id).delete(synchronize_session=False)
        db.query(UserSchemeStatus).filter(UserSchemeStatus.scheme_id == id).delete(synchronize_session=False)
        db.query(SchemeUpdate).filter(SchemeUpdate.scheme_id == id).delete(synchronize_session=False)
        db.delete(scheme)
        db.commit()
        log_audit_action(db, current_user, "DELETE_SCHEME", "scheme", str(id), {"name": scheme_name})
    else:
        scheme.status = 'archived'
        db.commit()
        log_audit_action(db, current_user, "ARCHIVE_SCHEME", "scheme", str(scheme.id), {"name": scheme.name})

IMPORT_CATEGORIES = {'education', 'health', 'agriculture', 'business'}
IMPORT_LEVELS = {'central', 'state'}
IMPORT_RULE_OPERATORS = {'eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'between', 'in', 'not_in'}
IMPORT_RULE_FIELDS = {
    'age', 'gender', 'annual_income', 'area_type', 'state', 'employment_status',
    'owns_property', 'dependents', 'occupation_tags',
}


def _parse_verified_date(value: Optional[str]) -> Optional[datetime]:
    """last_verified_at: the date the row's facts were checked against the
    source, as YYYY-MM-DD (or full ISO datetime). Blank stays None - activating
    the scheme then requires an admin to set it, which is the point."""
    value = (value or '').strip()
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        raise ValueError(f"last_verified_at '{value}' is not a YYYY-MM-DD date")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    if parsed > datetime.now(timezone.utc):
        raise ValueError("last_verified_at cannot be in the future")
    return parsed


def _split_list(value: Optional[str]) -> List[str]:
    return [item.strip() for item in (value or '').split('|') if item.strip()]


def _parse_rules(raw: Optional[str]) -> List[dict]:
    """Parse the eligibility_rules JSON cell, rejecting unknown fields/operators
    rather than silently storing rules the eligibility engine can't evaluate."""
    if not raw or not raw.strip():
        return []
    rules = json.loads(raw)
    if not isinstance(rules, list):
        raise ValueError("eligibility_rules must be a JSON array")
    parsed = []
    for r in rules:
        if r.get('field') not in IMPORT_RULE_FIELDS:
            raise ValueError(f"unknown rule field '{r.get('field')}'")
        if r.get('operator') not in IMPORT_RULE_OPERATORS:
            raise ValueError(f"unknown rule operator '{r.get('operator')}'")
        if 'value' not in r:
            raise ValueError(f"rule on '{r['field']}' has no value")
        parsed.append({
            'field': r['field'],
            'operator': r['operator'],
            'value': r['value'],
            'logic_group': int(r.get('logic_group', 1)),
        })
    return parsed


@router.post("/schemes/import")
def admin_import_schemes(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Import schemes from CSV.

    Accepts the full scheme format (see backend/seeds/scraped_schemes_import.csv):
    documents/apply_steps are " | "-separated, eligibility_rules is a JSON array.
    Older minimal CSVs (slug/name/short_description/...) still work. Imported
    schemes land in 'needs_review' so an admin checks them before they go live.
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files allowed")

    content = file.file.read().decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))

    imported, skipped, errors = [], [], []
    seen = set()
    for line_no, row in enumerate(reader, start=2):
        slug = (row.get('slug') or '').strip()
        if not slug:
            errors.append({"row": line_no, "slug": None, "error": "missing slug"})
            continue
        if slug in seen or db.query(Scheme).filter(Scheme.slug == slug).first():
            skipped.append(slug)
            continue
        seen.add(slug)

        try:
            rules = _parse_rules(row.get('eligibility_rules'))
            last_verified_at = _parse_verified_date(row.get('last_verified_at'))
            amount_raw = (row.get('benefit_amount') or '').replace(',', '').strip()
            documents = _split_list(row.get('documents'))
            category = (row.get('category') or '').strip().lower()
            level = (row.get('level') or '').strip().lower()

            scheme = Scheme(
                name=(row.get('name') or slug).strip(),
                slug=slug,
                short_description=row.get('short_description') or None,
                full_description=row.get('full_description') or None,
                ministry=row.get('ministry') or None,
                category=category if category in IMPORT_CATEGORIES else None,
                level=level if level in IMPORT_LEVELS else None,
                state=(row.get('state') or '').strip() or None,
                benefit_type=(row.get('benefit_type') or '').strip() or None,
                benefit_amount=float(amount_raw) if amount_raw else None,
                benefit_amount_inr=float(amount_raw) if amount_raw else None,
                benefit_period=(row.get('benefit_period') or '').strip() or None,
                benefit_description=row.get('benefit_description') or None,
                official_url=(row.get('official_url') or '').strip() or None,
                application_mode=row.get('application_mode') or None,
                documents=documents,
                required_documents=documents,
                apply_steps=_split_list(row.get('apply_steps')),
                source_url=(row.get('source_url') or '').strip() or None,
                last_verified_at=last_verified_at,
                status='needs_review',
            )
        except (ValueError, json.JSONDecodeError) as e:
            errors.append({"row": line_no, "slug": slug, "error": str(e)})
            continue

        # Savepoint per row: a bad row must not roll back the good rows
        # already imported earlier in the same file.
        try:
            with db.begin_nested():
                db.add(scheme)
                db.flush()
                for r in rules:
                    db.add(SchemeEligibilityRule(scheme_id=scheme.id, **r))
            imported.append(slug)
        except SQLAlchemyError as e:
            errors.append({"row": line_no, "slug": slug, "error": str(e.orig) if getattr(e, 'orig', None) else str(e)})

    db.commit()
    log_audit_action(db, current_user, "IMPORT_SCHEMES", "system", "N/A",
                     {"imported": len(imported), "skipped": len(skipped), "errors": len(errors)})
    return {"imported": len(imported), "skipped": skipped, "errors": errors}

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
