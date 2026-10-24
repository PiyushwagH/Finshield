"""Rule-based safety layer on top of the frozen ML model.

The LightGBM model (trained on a non-Indian proxy dataset, AUC 0.685) gives
very little weight to self-reported defaults, poor repayment history and heavy
EMI burden - e.g. a profile with a past default and EMIs at 93% of income can
score "Very Low". These rules never touch the model or its outputs
(default_probability, risk_score and the stored risk_band are unchanged); they
only set a *minimum* displayed band when hard red flags are present, and say
which rule did it.
"""
from typing import Any, Dict, List

BANDS = ["Very Low", "Low", "Moderate", "High", "Very High"]

# code -> minimum band. "High" rules are the severe ones.
RULES = {
    "past_default": "High",
    "poor_payment_history": "High",
    "fair_payment_history": "Moderate",
    "emi_over_50": "High",
    "emi_over_40": "Moderate",
    "outflow_exceeds_income": "High",
}


def _rank(band: str) -> int:
    return BANDS.index(band) if band in BANDS else 0


def triggered_rules(input_data: Dict[str, Any], affordability: Dict[str, Any]) -> List[str]:
    codes: List[str] = []
    has_prior = bool(input_data.get("has_prior_credit"))
    # Default / repayment answers only exist when the user has prior credit -
    # the model itself ignores them otherwise.
    if has_prior and input_data.get("has_defaulted"):
        codes.append("past_default")
    history = str(input_data.get("payment_history") or "").lower()
    if has_prior and history == "poor":
        codes.append("poor_payment_history")
    elif has_prior and history == "fair":
        codes.append("fair_payment_history")

    emi_ratio = float(affordability.get("emi_to_income_ratio") or 0)
    if emi_ratio > 0.5:
        codes.append("emi_over_50")
    elif emi_ratio > 0.4:
        codes.append("emi_over_40")

    if float(affordability.get("monthly_surplus") or 0) < 0:
        codes.append("outflow_exceeds_income")
    return codes


def apply_safety_rules(input_data: Dict[str, Any], affordability: Dict[str, Any], model_band: str) -> Dict[str, Any]:
    """Return {"final_band", "model_band", "raised", "reasons"}.

    final_band = the higher of the model's band and the strictest triggered
    rule; two or more severe ("High") red flags together mean "Very High".
    """
    codes = triggered_rules(input_data or {}, affordability or {})
    severe = [c for c in codes if RULES[c] == "High"]
    combined = len(severe) >= 2
    floor = max((_rank(RULES[c]) for c in codes), default=0)
    if combined:
        floor = _rank("Very High")

    model_rank = _rank(model_band)
    final_rank = max(model_rank, floor)
    raised = final_rank > model_rank
    if not raised:
        reasons: List[str] = []
    elif combined and final_rank == _rank("Very High"):
        reasons = severe  # the combination of severe flags is what raised it
    else:
        reasons = [c for c in codes if _rank(RULES[c]) > model_rank]
    return {
        "final_band": BANDS[final_rank],
        "model_band": model_band,
        "raised": raised,
        "reasons": reasons,
    }
