from typing import Dict, Any, List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.scheme import Scheme, SchemeEligibilityRule, UserSchemeStatus
from app.models.assessment import Assessment
from app.services.eligibility_service import evaluate_scheme
from app.services.explain import get_top_drivers
from app.services.i18n import t

DRIVER_MATCH_REASONS = {
    "emi_burden": {
        "en": "Addresses debt pressure with subsidized credit terms and interest subvention.",
        "hi": "रियायती ऋण शर्तों और ब्याज सब्सिडी के साथ कर्ज का दबाव कम करता है।",
        "mr": "सवलतीच्या कर्ज अटी आणि व्याज अनुदानासह कर्जाचा भार कमी करण्यास मदत करते."
    },
    "savings": {
        "en": "Bolsters emergency liquidity and long-term financial security.",
        "hi": "आपातकालीन नकदी और दीर्घकालिक वित्तीय सुरक्षा को मजबूत करता है।",
        "mr": "आपत्कालीन निधी आणि दीर्घकालीन आर्थिक सुरक्षिततेला बळकट करते."
    },
    "income": {
        "en": "Provides direct income support, allowances, or targeted subsidies.",
        "hi": "प्रत्यक्ष आय सहायता, भत्ते या लक्षित सब्सिडी प्रदान करता है।",
        "mr": "थेट उत्पन्न सहाय्य, भत्ते किंवा लक्ष्यित अनुदान उपलब्ध करून देते."
    },
    "employment_stability": {
        "en": "Offers enterprise capital, wage guarantees, and skill enhancement.",
        "hi": "उद्यमिता पूंजी, मजदूरी गारंटी और कौशल विकास अवसर प्रदान करता है।",
        "mr": "व्यवसाय भांडवल, रोजगार हमी आणि कौशल्य विकासाच्या संधी प्रदान करते."
    },
    "credit_history": {
        "en": "Improves institutional credit access with low-friction basic banking.",
        "hi": "सरल बैंकिंग के साथ औपचारिक संस्थागत ऋण तक पहुंच को आसान बनाता है।",
        "mr": "सुलभ बँकिंगद्वारे संस्थात्मक कर्जाची उपलब्धता वाढवते."
    },
    "dependents": {
        "en": "Family welfare coverage, child development assistance, and household security.",
        "hi": "परिवार कल्याण सहायता, बाल विकास लाभ और घरेलू सुरक्षा प्रदान करता है।",
        "mr": "कुटुंब कल्याण योजना, बाल विकास लाभ आणि कौटुंबिक सुरक्षा पुरवते."
    },
    "education": {
        "en": "Covers educational tuition, fees, and student living allowances.",
        "hi": "शैक्षणिक ट्यूशन शुल्क, परीक्षा फीस और छात्रवृत्ति भत्ते कवर करता है।",
        "mr": "शैक्षणिक शुल्क, परीक्षा फी आणि शिष्यवृत्ती भत्ता प्रदान करते."
    }
}

DEFAULT_MATCH_REASONS = {
    "en": "Matched based on your personal and demographic assessment profile.",
    "hi": "आपकी व्यक्तिगत और जनसांख्यिकीय प्रोफाइल के आधार पर सुझाई गई।",
    "mr": "तुमच्या वैयक्तिक आणि लोकसंख्याशास्त्रीय प्रोफाइलच्या आधारे जुळलेली."
}

def normalize_benefit(scheme: Scheme) -> Dict[str, Any]:
    b_type = (scheme.benefit_type or "unquantified").lower()
    period = (scheme.benefit_period or "").lower()
    amt = float(scheme.benefit_amount_inr or scheme.benefit_amount or 0.0)

    # Standardize types to contract: cash | loan_subsidy | insurance | savings_return | unquantified
    if "loan" in b_type or "subsidy" in b_type:
        contract_type = "loan_subsidy" if "loan" in b_type else "loan_subsidy"
    elif "insur" in b_type:
        contract_type = "insurance"
    elif "cash" in b_type:
        contract_type = "cash"
    elif "saving" in b_type:
        contract_type = "savings_return"
    else:
        contract_type = "unquantified" if amt <= 0 else "cash"

    if amt <= 0 or contract_type == "unquantified":
        return {
            "type": contract_type,
            "annual_inr": None,
            "monthly_inr": None,
            "note": scheme.benefit_description or scheme.short_description or "Official benefit"
        }

    if period == "monthly":
        annual_inr = round(amt * 12.0, 2)
        monthly_inr = round(amt, 2)
    elif period == "yearly":
        annual_inr = round(amt, 2)
        monthly_inr = round(amt / 12.0, 2)
    elif period == "one_time":
        annual_inr = round(amt, 2)
        monthly_inr = round(amt / 12.0, 2)
    else:
        annual_inr = round(amt, 2)
        monthly_inr = round(amt / 12.0, 2)

    return {
        "type": contract_type,
        "annual_inr": annual_inr,
        "monthly_inr": monthly_inr,
        "note": scheme.benefit_description or scheme.short_description or "Official benefit"
    }

def get_assessment_schemes(
    assessment: Assessment,
    db: Session,
    lang: str = "en"
) -> Dict[str, Any]:
    """
    Evaluates all active schemes against the user's assessment profile,
    correlates with TreeSHAP risk-increasing drivers, normalizes benefits,
    and returns matched schemes with missed-summary arithmetic.
    """
    profile = assessment.input_data or {}
    user_id = assessment.user_id

    # 1. Get user's top drivers that increase risk
    drivers = get_top_drivers(profile, lang=lang, limit=6)
    risk_drivers = [d["key"] for d in drivers if d.get("direction") == "increases_risk"]

    # 2. Query all active schemes & rules
    schemes = db.query(Scheme).filter(Scheme.status == "active").all()

    # Query user scheme status map for current user
    user_statuses = db.query(UserSchemeStatus).filter(UserSchemeStatus.user_id == user_id).all()
    status_map = {us.scheme_id: us.status for us in user_statuses}

    matched_list = []
    missed_count = 0
    missed_total_annual = 0.0
    missed_unquantified = 0

    for s in schemes:
        rules = db.query(SchemeEligibilityRule).filter(SchemeEligibilityRule.scheme_id == s.id).all()
        eval_res = evaluate_scheme(profile, rules)

        total_rules = len(eval_res.get("criteria", []))
        passed_rules = sum(1 for c in eval_res.get("criteria", []) if c["passed"])

        if eval_res["is_eligible"]:
            eligibility = "eligible"
        elif total_rules > 0 and (passed_rules / total_rules) >= 0.5:
            eligibility = "likely"
        else:
            eligibility = "check"

        # Check driver tags overlap
        tags = s.driver_tags or []
        matched_driver = None
        match_reason = DEFAULT_MATCH_REASONS.get(lang, DEFAULT_MATCH_REASONS["en"])

        for rd in risk_drivers:
            if rd in tags:
                matched_driver = rd
                reasons = DRIVER_MATCH_REASONS.get(rd, {})
                match_reason = reasons.get(lang, reasons.get("en", match_reason))
                break

        # If no risk driver matched, check if any general tag matched
        if not matched_driver and tags:
            for d in drivers:
                dk = d.get("key")
                if dk in tags:
                    matched_driver = dk
                    reasons = DRIVER_MATCH_REASONS.get(dk, {})
                    match_reason = reasons.get(lang, reasons.get("en", match_reason))
                    break

        benefit_info = normalize_benefit(s)
        my_status = status_map.get(s.id)

        # Missed benefits summary calculation:
        # missed = (eligible or likely) and my_status != "using"
        if eligibility in ["eligible", "likely"] and my_status != "using":
            missed_count += 1
            if benefit_info["annual_inr"] is not None:
                missed_total_annual += benefit_info["annual_inr"]
            else:
                missed_unquantified += 1

        matched_list.append({
            "scheme_id": s.id,
            "name": s.name,
            "category": s.category,
            "matched_driver_key": matched_driver,
            "match_reason": match_reason,
            "eligibility": eligibility,
            "benefit": benefit_info,
            "my_status": my_status,
            "official_url": s.official_url or ""
        })

    # Sort matched schemes:
    # 1. Eligible, 2. Likely, 3. Check. Within each, prioritize schemes with matched_driver_key
    elig_order = {"eligible": 0, "likely": 1, "check": 2}
    matched_list.sort(key=lambda x: (
        elig_order.get(x["eligibility"], 9),
        0 if x["matched_driver_key"] else 1,
        -(x["benefit"]["annual_inr"] or 0)
    ))

    return {
        "matched": matched_list,
        "missed_summary": {
            "count": missed_count,
            "total_annual_inr": round(missed_total_annual, 2),
            "unquantified_count": missed_unquantified
        }
    }
