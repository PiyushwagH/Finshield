from app.services.risk_rules import apply_safety_rules

CLEAN = {"has_prior_credit": True, "has_defaulted": False, "payment_history": "good"}
OK_AFF = {"emi_to_income_ratio": 0.2, "monthly_surplus": 10000}


def test_no_flags_keeps_model_band():
    r = apply_safety_rules(CLEAN, OK_AFF, "Very Low")
    assert r == {"final_band": "Very Low", "model_band": "Very Low", "raised": False, "reasons": []}


def test_single_severe_flag_floors_at_high():
    r = apply_safety_rules({**CLEAN, "has_defaulted": True}, OK_AFF, "Low")
    assert r["final_band"] == "High" and r["raised"] and r["reasons"] == ["past_default"]


def test_moderate_flag_floors_at_moderate():
    r = apply_safety_rules({**CLEAN, "payment_history": "fair"}, {**OK_AFF, "emi_to_income_ratio": 0.45}, "Very Low")
    assert r["final_band"] == "Moderate"
    assert set(r["reasons"]) == {"fair_payment_history", "emi_over_40"}


def test_two_severe_flags_make_very_high():
    # The exact profile reported as wrongly "Low": past default, poor history,
    # EMIs at 93% of income, outflow above income.
    inp = {"has_prior_credit": True, "has_defaulted": True, "payment_history": "poor"}
    aff = {"emi_to_income_ratio": 0.933, "monthly_surplus": -57500}
    r = apply_safety_rules(inp, aff, "Very Low")
    assert r["final_band"] == "Very High"
    assert set(r["reasons"]) == {"past_default", "poor_payment_history", "emi_over_50", "outflow_exceeds_income"}


def test_never_lowers_the_model_band():
    r = apply_safety_rules(CLEAN, OK_AFF, "Very High")
    assert r["final_band"] == "Very High" and not r["raised"]


def test_default_ignored_without_prior_credit():
    # The wizard hides these answers unless the user has prior credit, and the
    # model ignores them too - a stale toggle must not raise the band.
    r = apply_safety_rules({"has_prior_credit": False, "has_defaulted": True, "payment_history": "poor"}, OK_AFF, "Low")
    assert r["final_band"] == "Low" and r["reasons"] == []
