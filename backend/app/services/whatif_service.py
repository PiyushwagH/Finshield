from typing import Dict, Any, List, Union
from uuid import UUID
from sqlalchemy.orm import Session
from app.services.risk_service import predictor
from app.models.scheme import Scheme
from app.services.i18n import t
from app.services.risk_rules import apply_safety_rules

def simulate_whatif(
    base_form: dict,
    changes: dict,
    scheme_ids: List[Union[str, int, UUID]],
    db: Session,
    lang: str = "en"
) -> Dict[str, Any]:
    """
    Reruns the frozen predictor with user-specified financial changes and recalculates affordability.

    IMPORTANT NOTE:
    Scheme benefit_monthly affects ONLY monthly surplus and runway, never the model input.
    The LightGBM statistical credit model inputs remain strictly based on individual financial
    and employment parameters; government welfare cashflows are reflected strictly in the
    cash-flow affordability layer.
    """
    # 1. Base prediction
    base_pred = predictor.predict(base_form)
    base_score = base_pred["risk_score"]
    base_band = base_pred["risk_band"]
    base_prob = base_pred["default_probability"]
    base_affordability = base_pred["affordability"]

    # 2. Prepare modified scenario form
    scenario_form = {**base_form}
    if changes.get("monthly_emi") is not None:
        scenario_form["monthly_emi"] = float(changes["monthly_emi"])
    if changes.get("savings") is not None:
        scenario_form["savings"] = float(changes["savings"])
    if changes.get("monthly_expenditure") is not None:
        scenario_form["monthly_expenditure"] = float(changes["monthly_expenditure"])
    if changes.get("annual_income") is not None:
        scenario_form["annual_income"] = float(changes["annual_income"])

    # 3. Predict scenario with frozen ML model
    scenario_pred = predictor.predict(scenario_form)
    scenario_score = scenario_pred["risk_score"]
    scenario_band = scenario_pred["risk_band"]
    scenario_prob = scenario_pred["default_probability"]
    scenario_affordability = dict(scenario_pred["affordability"])

    # 4. Compute scheme benefits from selected schemes
    scheme_benefit_monthly = 0.0
    if scheme_ids:
        # Match schemes by UUID string
        scheme_id_strs = [str(sid) for sid in scheme_ids if sid]
        schemes = db.query(Scheme).filter(Scheme.id.in_(scheme_id_strs), Scheme.status == 'active').all() if scheme_id_strs else []
        for s in schemes:
            amt = float(getattr(s, "benefit_amount_inr", None) or s.benefit_amount or 0.0)
            period = str(getattr(s, "benefit_period", "") or "").lower()
            if period == "monthly":
                scheme_benefit_monthly += amt
            elif period == "yearly":
                scheme_benefit_monthly += amt / 12.0
            elif period == "one_time":
                scheme_benefit_monthly += amt / 12.0  # amortized monthly
            elif amt > 0:
                scheme_benefit_monthly += amt / 12.0

    scheme_benefit_monthly = round(scheme_benefit_monthly, 2)

    # 5. Apply scheme benefit ONLY to scenario monthly surplus and runway
    if scheme_benefit_monthly > 0:
        updated_surplus = round(scenario_affordability["monthly_surplus"] + scheme_benefit_monthly, 2)
        annual_inc = float(scenario_form.get("annual_income", 0) or 0)
        monthly_inc = (annual_inc / 12.0) if annual_inc > 0 else 1.0
        updated_surplus_ratio = round(updated_surplus / monthly_inc, 4)

        scenario_affordability["monthly_surplus"] = updated_surplus
        scenario_affordability["surplus_ratio"] = updated_surplus_ratio

    score_delta = scenario_score - base_score
    base_adj = apply_safety_rules(base_form, base_affordability, base_band)
    scenario_adj = apply_safety_rules(scenario_form, scenario_affordability, scenario_band)

    disclaimer_text = f"{t('disclaimer.whatif_note', lang)} {t('disclaimer.regulatory', lang)}"

    return {
        "base": {
            "score": base_score,
            "band": base_band,
            "final_band": base_adj["final_band"],
            "band_reasons": base_adj["reasons"],
            "default_probability": base_prob
        },
        "scenario": {
            "score": scenario_score,
            "band": scenario_band,
            "final_band": scenario_adj["final_band"],
            "band_reasons": scenario_adj["reasons"],
            "default_probability": scenario_prob
        },
        "score_delta": score_delta,
        "affordability_base": base_affordability,
        "affordability_scenario": scenario_affordability,
        "scheme_benefit_monthly_inr": scheme_benefit_monthly,
        "disclaimer": disclaimer_text
    }
