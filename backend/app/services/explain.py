from typing import List, Dict, Any
from app.services.risk_service import predictor
from app.services.i18n import t

FEATURE_TO_DRIVER = {
    "ANNUAL_INCOME": "income",
    "INCOME_PER_HEAD": "income",
    "INCOME_PER_YEAR_WORKED": "income",
    "MONTHLY_EMI": "emi_burden",
    "DTI": "emi_burden",
    "DEBT_TO_INCOME": "emi_burden",
    "EXISTING_DEBT": "emi_burden",
    "OWNS_CAR": "savings",
    "OWNS_PROPERTY": "savings",
    "ASSET_SCORE": "savings",
    "EMPLOYMENT_STATUS": "employment_stability",
    "YEARS_EMPLOYED": "employment_stability",
    "EMPLOYMENT_RATIO": "employment_stability",
    "HAS_PRIOR_CREDIT": "credit_history",
    "HAS_DEFAULTED": "credit_history",
    "PAYMENT_HISTORY": "credit_history",
    "N_PRIOR_CREDITS": "credit_history",
    "N_ACTIVE_CREDITS": "credit_history",
    "YEARS_CREDIT_HISTORY": "credit_history",
    "DEPENDENTS": "dependents",
    "AGE": "age",
    "EDUCATION": "education",
    "MARITAL_STATUS": "marital_status",
    "GENDER": "gender",
}

def compute_driver_contributions(form_dict: dict) -> Dict[str, float]:
    """
    Computes TreeSHAP margin contributions using LightGBM's native predict(..., pred_contrib=True).
    Aggregates the 24 individual feature contributions into high-level form drivers.
    Positive values push towards default (increases_risk); negative values reduce default risk.
    """
    X = predictor._build_row(form_dict)
    contrib = predictor.model.predict(X, pred_contrib=True)[0]
    
    driver_totals: Dict[str, float] = {}
    for feat_name, val in zip(predictor.features, contrib[:24]):
        driver_key = FEATURE_TO_DRIVER.get(feat_name, "other")
        driver_totals[driver_key] = driver_totals.get(driver_key, 0.0) + float(val)
        
    return driver_totals

def get_top_drivers(form_dict: dict, lang: str = "en", limit: int = 6) -> List[Dict[str, Any]]:
    """
    Returns top N drivers ranked by absolute contribution magnitude,
    with direction ('increases_risk' | 'reduces_risk') and relative impact_pct.
    """
    driver_totals = compute_driver_contributions(form_dict)
    
    total_abs = sum(abs(v) for v in driver_totals.values()) or 1.0
    sorted_items = sorted(driver_totals.items(), key=lambda item: abs(item[1]), reverse=True)
    
    drivers = []
    for key, val in sorted_items[:limit]:
        impact_pct = round((abs(val) / total_abs) * 100, 1)
        direction = "increases_risk" if val > 0 else "reduces_risk"
        label = t(f"driver.{key}", lang, default=key.replace("_", " ").title())
        drivers.append({
            "key": key,
            "label": label,
            "direction": direction,
            "impact_pct": impact_pct
        })
        
    return drivers
