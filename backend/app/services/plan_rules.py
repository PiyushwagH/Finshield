from typing import Dict, Any, List
from app.services.risk_service import predictor
from app.services.explain import get_top_drivers, compute_driver_contributions
from app.services.i18n import t

def generate_plan(assessment_data: dict, lang: str = "en") -> Dict[str, Any]:
    """
    Deterministic, rule-based Plan Engine.
    Evaluates actionable levers, re-scores them through the frozen predictor
    to calculate real est_score_gain, ranks them, and constructs roadmap + habits.
    """
    form = assessment_data.get("input_data", {})
    base_score = assessment_data.get("risk_score", 300)
    raw_band = assessment_data.get("risk_band", "Moderate")
    affordability = assessment_data.get("affordability", {})

    annual_income = float(form.get("annual_income", 0) or 0)
    monthly_income = annual_income / 12.0 if annual_income > 0 else 1.0
    monthly_emi = float(form.get("monthly_emi", 0) or 0)
    existing_debt = float(form.get("existing_total_debt", 0) or 0)
    expenditure = float(form.get("monthly_expenditure", 0) or 0)
    savings = float(form.get("savings", 0) or 0)
    has_defaulted = bool(form.get("has_defaulted", False))
    payment_history = str(form.get("payment_history", "no_history")).lower()
    
    outflow = expenditure + monthly_emi
    runway = (savings / outflow) if outflow > 0 else 12.0
    emi_ratio = (monthly_emi / monthly_income) if monthly_income > 0 else 0.0
    surplus = monthly_income - outflow
    surplus_ratio = (surplus / monthly_income) if monthly_income > 0 else 0.0

    # Top drivers
    drivers = get_top_drivers(form, lang=lang, limit=6)
    driver_contribs = compute_driver_contributions(form)

    # Candidate levers
    candidate_levers = []

    # 1. Clear default (if defaulted)
    if has_defaulted:
        mod = {**form, "has_defaulted": False}
        res = predictor.predict(mod)
        gain = max(0, res["risk_score"] - base_score)
        candidate_levers.append({
            "key": "clear_default",
            "timeframe": "12m",
            "est_score_gain": gain
        })

    # 2. Reduce EMI by 30%
    if monthly_emi > 0 and (emi_ratio > 0.30 or driver_contribs.get("emi_burden", 0) > 0):
        mod = {
            **form,
            "monthly_emi": round(monthly_emi * 0.7),
            "existing_total_debt": round(existing_debt * 0.7)
        }
        res = predictor.predict(mod)
        gain = max(0, res["risk_score"] - base_score)
        candidate_levers.append({
            "key": "reduce_emi_30",
            "timeframe": "6m",
            "est_score_gain": gain
        })

    # 3. Reduce EMI by 20%
    if monthly_emi > 0:
        mod = {
            **form,
            "monthly_emi": round(monthly_emi * 0.8),
            "existing_total_debt": round(existing_debt * 0.8)
        }
        res = predictor.predict(mod)
        gain = max(0, res["risk_score"] - base_score)
        candidate_levers.append({
            "key": "reduce_emi_20",
            "timeframe": "3m",
            "est_score_gain": gain
        })

    # 4. Improve payment history
    if payment_history in ["poor", "fair", "no_history"]:
        mod = {**form, "payment_history": "good", "has_prior_credit": True}
        res = predictor.predict(mod)
        gain = max(0, res["risk_score"] - base_score)
        candidate_levers.append({
            "key": "improve_credit_history",
            "timeframe": "12m",
            "est_score_gain": gain
        })

    # 5. Build 3-month emergency fund
    if runway < 3.0:
        target_savings = round(expenditure * 3.0)
        mod = {**form, "savings": target_savings}
        res = predictor.predict(mod)
        gain = max(0, res["risk_score"] - base_score)
        candidate_levers.append({
            "key": "raise_emergency_fund_3m",
            "timeframe": "3m",
            "est_score_gain": gain
        })

    # 6. Expand emergency fund to 6 months
    if runway < 6.0:
        target_savings = round(expenditure * 6.0)
        mod = {**form, "savings": target_savings}
        res = predictor.predict(mod)
        gain = max(0, res["risk_score"] - base_score)
        candidate_levers.append({
            "key": "raise_emergency_fund_6m",
            "timeframe": "6m",
            "est_score_gain": gain
        })

    # 7. Reduce monthly expenditure by 10%
    if expenditure > 0 and (surplus < 0 or surplus_ratio < 0.20):
        mod = {**form, "monthly_expenditure": round(expenditure * 0.9)}
        res = predictor.predict(mod)
        gain = max(0, res["risk_score"] - base_score)
        candidate_levers.append({
            "key": "reduce_expenditure_10",
            "timeframe": "3m",
            "est_score_gain": gain
        })

    # Fallback if profile is already very strong
    if not candidate_levers:
        candidate_levers.append({
            "key": "raise_emergency_fund_6m",
            "timeframe": "6m",
            "est_score_gain": 0
        })
        candidate_levers.append({
            "key": "improve_credit_history",
            "timeframe": "12m",
            "est_score_gain": 0
        })

    # Deterministic sorting: sort by gain desc, then timeframe asc ("3m" < "6m" < "12m")
    timeframe_order = {"3m": 1, "6m": 2, "12m": 3}
    candidate_levers.sort(key=lambda x: (-x["est_score_gain"], timeframe_order.get(x["timeframe"], 99)))

    # Deduplicate: if both reduce_emi_30 and reduce_emi_20 are present, keep both or order them naturally
    priorities = []
    for rank, lever in enumerate(candidate_levers[:5], start=1):
        k = lever["key"]
        priorities.append({
            "rank": rank,
            "key": k,
            "title": t(f"priority.{k}.title", lang),
            "why": t(f"priority.{k}.why", lang),
            "action": t(f"priority.{k}.action", lang),
            "est_score_gain": lever["est_score_gain"],
            "timeframe": lever["timeframe"]
        })

    # Build roadmap
    roadmap_items = {"3m": [], "6m": [], "12m": []}
    roadmap_items["3m"].append({
        "title": t("roadmap.3m.title", lang),
        "detail": t("roadmap.3m.detail", lang)
    })
    roadmap_items["6m"].append({
        "title": t("roadmap.6m.title", lang),
        "detail": t("roadmap.6m.detail", lang)
    })
    roadmap_items["12m"].append({
        "title": t("roadmap.12m.title", lang),
        "detail": t("roadmap.12m.detail", lang)
    })

    # Habits (5 to 7 chosen by rule)
    habit_keys = [
        "habit.emi_ceiling",
        "habit.emergency_buffer",
        "habit.auto_pay",
        "habit.credit_utilization",
        "habit.annual_check",
        "habit.scheme_leverage"
    ]
    habits = []
    for hk in habit_keys:
        habits.append({
            "title": t(f"{hk}.title", lang),
            "detail": t(f"{hk}.detail", lang)
        })

    # Normalized affordability
    affordability_out = {
        "monthly_surplus": round(affordability.get("monthly_surplus", surplus), 2),
        "emi_to_income_pct": round(affordability.get("emi_to_income_ratio", emi_ratio) * 100, 1),
        "emergency_runway_months": (round(affordability.get("emergency_fund_months", runway), 1)
                                    if affordability.get("emergency_fund_months") is not None else None)
    }

    return {
        "assessment_id": str(assessment_data.get("id", "")),
        "score": base_score,
        "band": raw_band,
        "affordability": affordability_out,
        "drivers": drivers,
        "priorities": priorities,
        "roadmap": roadmap_items,
        "habits": habits,
        "disclaimer": t("disclaimer.regulatory", lang)
    }
