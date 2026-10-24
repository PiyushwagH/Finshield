from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session
from typing import Optional, List, Union
from uuid import UUID

from app.services.risk_rules import apply_safety_rules
from app.database import get_db
from app.core.deps import get_current_user
from app.core.limiter import limiter
from app.models.user import User
from app.models.assessment import Assessment
from app.schemas.whatif import WhatIfRequest, WhatIfResponse
from app.services.plan_rules import generate_plan
from app.services.whatif_service import simulate_whatif
from app.services.scheme_matching import get_assessment_schemes
from app.services.pdf_service import generate_pdf_report

router = APIRouter(prefix="/api", tags=["Assessment Plan & What-If"])

def _get_user_assessment(assessment_id: Union[str, UUID], user: User, db: Session) -> Assessment:
    try:
        if isinstance(assessment_id, str):
            aid = UUID(assessment_id)
        else:
            aid = assessment_id
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid assessment ID format")

    assessment = db.query(Assessment).filter(Assessment.id == aid).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if assessment.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this assessment")
    return assessment


# ---------------------------------------------------------------------------
# 1. GET /assessments/{id}/plan
# ---------------------------------------------------------------------------
@router.get("/assessments/{id}/plan")
@router.get("/risk/assessments/{id}/plan")
@limiter.limit("60/minute")
def get_assessment_plan(
    id: str,
    request: Request,
    lang: str = Query("en", pattern="^(en|hi|mr)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    assessment = _get_user_assessment(id, current_user, db)
    assessment_dict = {
        "id": str(assessment.id),
        "input_data": assessment.input_data or {},
        "risk_score": assessment.risk_score,
        # Plan and PDF show the same final band as the results page.
        "risk_band": apply_safety_rules(assessment.input_data or {}, assessment.affordability or {}, assessment.risk_band)["final_band"],
        "affordability": assessment.affordability or {}
    }
    return generate_plan(assessment_dict, lang=lang)


# ---------------------------------------------------------------------------
# 2. POST /whatif
# ---------------------------------------------------------------------------
@router.post("/whatif", response_model=WhatIfResponse)
@router.post("/risk/whatif", response_model=WhatIfResponse)
@limiter.limit("60/minute")
def post_whatif(
    req: WhatIfRequest,
    request: Request,
    lang: str = Query("en", pattern="^(en|hi|mr)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    assessment = _get_user_assessment(req.assessment_id, current_user, db)
    base_form = assessment.input_data or {}
    changes_dict = req.changes.model_dump(exclude_unset=True)

    result = simulate_whatif(
        base_form=base_form,
        changes=changes_dict,
        scheme_ids=req.scheme_ids or [],
        db=db,
        lang=lang
    )
    return result


# ---------------------------------------------------------------------------
# 3. GET /assessments/{id}/schemes
# ---------------------------------------------------------------------------
@router.get("/assessments/{id}/schemes")
@router.get("/risk/assessments/{id}/schemes")
@limiter.limit("60/minute")
def get_schemes_for_assessment(
    id: str,
    request: Request,
    lang: str = Query("en", pattern="^(en|hi|mr)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    assessment = _get_user_assessment(id, current_user, db)
    return get_assessment_schemes(assessment, db, lang=lang)


# ---------------------------------------------------------------------------
# 6. GET /assessments/{id}/report.pdf
# ---------------------------------------------------------------------------
@router.get("/assessments/{id}/report.pdf")
@router.get("/risk/assessments/{id}/report.pdf")
@limiter.limit("30/minute")
def download_assessment_pdf_report(
    id: str,
    request: Request,
    lang: str = Query("en", pattern="^(en|hi|mr)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    assessment = _get_user_assessment(id, current_user, db)
    assessment_dict = {
        "id": str(assessment.id),
        "input_data": assessment.input_data or {},
        "risk_score": assessment.risk_score,
        # Plan and PDF show the same final band as the results page.
        "risk_band": apply_safety_rules(assessment.input_data or {}, assessment.affordability or {}, assessment.risk_band)["final_band"],
        "affordability": assessment.affordability or {}
    }

    plan_data = generate_plan(assessment_dict, lang=lang)
    schemes_data = get_assessment_schemes(assessment, db, lang=lang)

    pdf_bytes = generate_pdf_report(
        assessment_data=assessment_dict,
        plan_data=plan_data,
        schemes_data=schemes_data,
        lang=lang
    )

    filename = f"FinShield_Report_{id[:8]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
