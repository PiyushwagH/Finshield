"""
FinShield serving layer.

Takes the raw JSON from the website form, maps it onto the trained feature
space, and returns a probability of default, a risk band, and the drivers
behind the score.

    from finshield_predictor import FinShieldPredictor
    p = FinShieldPredictor("finshield_model.pkl")
    p.predict(form_dict)
"""
from __future__ import annotations
import pickle
import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Form dropdown values -> the category levels the model was trained on.
# Keep the left-hand side in sync with the <select> options on the website.
# ---------------------------------------------------------------------------
EDUCATION_MAP = {
    "below_10th": "Lower secondary",
    "secondary": "Secondary / secondary special",
    "higher_secondary": "Secondary / secondary special",
    "diploma": "Incomplete higher",
    "bachelors": "Higher education",
    "masters": "Higher education",
    "doctorate": "Academic degree",
}

MARITAL_MAP = {
    "single": "Single / not married",
    "married": "Married",
    "live_in": "Civil marriage",
    "separated": "Separated",
    "divorced": "Separated",
    "widowed": "Widow",
}

EMPLOYMENT_MAP = {
    "salaried_private": "Working",
    "salaried_government": "State servant",
    "self_employed": "Commercial associate",
    "business_owner": "Businessman",
    "student": "Student",
    "retired": "Pensioner",
    "unemployed": "Unemployed",
    "homemaker": "Maternity leave",
}

PAYMENT_HISTORY_MAP = {
    "excellent": "Excellent",
    "good": "Good",
    "fair": "Fair",
    "poor": "Poor",
    "no_history": "No history",
}

GENDER_MAP = {"male": "M", "female": "F", "other": None, "prefer_not_to_say": None}

BAND_LABELS = ["Very Low", "Low", "Moderate", "High", "Very High"]


class FinShieldPredictor:
    def __init__(self, model_path: str = "finshield_model.pkl"):
        with open(model_path, "rb") as f:
            b = pickle.load(f)
        self.model = b["model"]
        self.features = b["features"]
        self.categoricals = b["categoricals"]
        self.cat_categories = b["cat_categories"]
        self.cutoffs = b["band_cutoffs"]
        self.percentile_grid = b["percentile_grid"]
        self.metrics = b["metrics"]

    # ------------------------------------------------------------------ map
    def _build_row(self, f: dict) -> pd.DataFrame:
        age = float(f["age"])
        annual_income = float(f["annual_income"])
        years_employed = float(f.get("years_employed", 0) or 0)
        dependents = int(f.get("dependents", 0) or 0)
        monthly_emi = float(f.get("monthly_emi", 0) or 0)
        existing_debt = float(f.get("existing_total_debt", 0) or 0)

        has_prior = 1 if f.get("has_prior_credit") else 0
        has_default = 1 if f.get("has_defaulted") else 0
        n_prior = float(f.get("n_prior_credits", 0) or 0)
        n_active = float(f.get("n_active_credits", 0) or 0)
        yrs_hist = float(f.get("years_credit_history", 0) or 0)

        owns_car = 1 if f.get("owns_vehicle") else 0
        owns_prop = 1 if f.get("owns_property") else 0

        payment_history = PAYMENT_HISTORY_MAP.get(
            str(f.get("payment_history", "no_history")).lower(), "No history"
        )
        if not has_prior:
            payment_history = "No history"

        inc = annual_income if annual_income > 0 else np.nan

        row = {
            "AGE": age,
            "GENDER": GENDER_MAP.get(str(f.get("gender", "")).lower()),
            "EDUCATION": EDUCATION_MAP.get(str(f.get("education", "")).lower()),
            "MARITAL_STATUS": MARITAL_MAP.get(str(f.get("marital_status", "")).lower()),
            "DEPENDENTS": min(dependents, 10),
            "EMPLOYMENT_STATUS": EMPLOYMENT_MAP.get(
                str(f.get("employment_status", "")).lower()),
            "YEARS_EMPLOYED": years_employed,
            "ANNUAL_INCOME": annual_income,
            "MONTHLY_EMI": monthly_emi,
            "EXISTING_DEBT": existing_debt,
            "OWNS_CAR": owns_car,
            "OWNS_PROPERTY": owns_prop,
            "ASSET_SCORE": owns_car + 2 * owns_prop,
            "HAS_PRIOR_CREDIT": has_prior,
            "HAS_DEFAULTED": has_default,
            "PAYMENT_HISTORY": payment_history,
            "N_PRIOR_CREDITS": n_prior,
            "N_ACTIVE_CREDITS": n_active,
            "YEARS_CREDIT_HISTORY": yrs_hist,
            "DTI": (monthly_emi * 12) / inc,
            "DEBT_TO_INCOME": existing_debt / inc,
            "INCOME_PER_HEAD": annual_income / (1 + dependents),
            "INCOME_PER_YEAR_WORKED": annual_income / (1 + years_employed),
            "EMPLOYMENT_RATIO": years_employed / max(age - 18, 1),
        }

        X = pd.DataFrame([row])[self.features]
        for c in self.categoricals:
            X[c] = pd.Categorical(X[c], categories=self.cat_categories[c])
        return X

    # ------------------------------------------------------------- affordability
    @staticmethod
    def _affordability(f: dict) -> dict:
        """
        Rule-based layer for the three form fields the dataset has no
        counterpart for: monthly expenditure, savings, and asset value.
        Reported alongside the ML score, never blended into it.
        """
        annual_income = float(f["annual_income"])
        monthly_income = annual_income / 12 if annual_income else 0
        expenditure = float(f.get("monthly_expenditure", 0) or 0)
        emi = float(f.get("monthly_emi", 0) or 0)
        savings = float(f.get("savings", 0) or 0)
        assets = float(f.get("asset_value", 0) or 0)

        outflow = expenditure + emi
        surplus = monthly_income - outflow
        surplus_ratio = surplus / monthly_income if monthly_income else 0
        emi_ratio = emi / monthly_income if monthly_income else 0
        runway = savings / outflow if outflow else float("inf")

        flags = []
        if emi_ratio > 0.50:
            flags.append("EMIs exceed 50% of monthly income")
        elif emi_ratio > 0.40:
            flags.append("EMIs are above the 40% comfort threshold")
        if surplus < 0:
            flags.append("Monthly outflow exceeds income")
        elif surplus_ratio < 0.10:
            flags.append("Less than 10% of income left after expenses")
        if runway < 3:
            flags.append("Emergency fund covers under 3 months of outflow")
        if assets and annual_income and assets < annual_income * 0.5:
            flags.append("Asset base is small relative to income")

        if not flags:
            grade = "Comfortable"
        elif len(flags) == 1:
            grade = "Stretched"
        elif len(flags) == 2:
            grade = "Strained"
        else:
            grade = "Critical"

        return {
            "grade": grade,
            "monthly_surplus": round(surplus, 2),
            "surplus_ratio": round(surplus_ratio, 4),
            "emi_to_income_ratio": round(emi_ratio, 4),
            "emergency_fund_months": (round(runway, 1)
                                      if runway != float("inf") else None),
            "flags": flags,
        }

    # -------------------------------------------------------------- explain
    def _factors(self, f: dict, prob: float) -> dict:
        pos, neg = [], []
        income = float(f["annual_income"])
        emi_ratio = (float(f.get("monthly_emi", 0) or 0) * 12 / income) if income else 0

        if f.get("has_defaulted"):
            neg.append("Previous default on a credit obligation")
        ph = str(f.get("payment_history", "")).lower()
        if ph == "poor":
            neg.append("Self-reported poor payment history")
        elif ph == "fair":
            neg.append("Self-reported fair payment history")
        elif ph == "excellent":
            pos.append("Consistently clean payment history")

        if emi_ratio > 0.40:
            neg.append("Existing EMIs consume a large share of income")
        elif emi_ratio < 0.15:
            pos.append("Low existing debt burden relative to income")

        if float(f.get("years_employed", 0) or 0) >= 5:
            pos.append("Stable employment record")
        elif float(f.get("years_employed", 0) or 0) < 1:
            neg.append("Short employment history")

        if float(f.get("years_credit_history", 0) or 0) >= 7:
            pos.append("Long established credit history")
        elif f.get("has_prior_credit") and float(f.get("years_credit_history", 0) or 0) < 2:
            neg.append("Thin credit file")
        elif not f.get("has_prior_credit"):
            neg.append("No prior credit history to assess")

        if float(f.get("age", 0)) >= 40:
            pos.append("Age band associated with lower default rates")
        if f.get("owns_property"):
            pos.append("Property ownership")

        return {"positive": pos, "negative": neg}

    # -------------------------------------------------------------- predict
    def predict(self, form: dict) -> dict:
        X = self._build_row(form)
        prob = float(self.model.predict_proba(X)[0, 1])

        band_idx = int(np.searchsorted(self.cutoffs, prob))
        score = int(round(300 + (1 - prob / 0.5) * 550))
        score = max(300, min(850, score))

        return {
            "default_probability": round(prob, 4),
            "risk_band": BAND_LABELS[band_idx],
            "risk_score": score,
            "population_percentile": float(
                np.searchsorted(self.percentile_grid, prob)),
            "affordability": self._affordability(form),
            "factors": self._factors(form, prob),
            "model_meta": {
                "auc": round(self.metrics["auc"], 4),
                "trained_on": self.metrics["n_train"],
                "population_default_rate": round(self.metrics["base_rate"], 4),
            },
        }


if __name__ == "__main__":
    import json
    p = FinShieldPredictor("finshield_model.pkl")

    sample = {
        "age": 34, "gender": "male", "education": "bachelors",
        "marital_status": "married", "dependents": 2,
        "employment_status": "salaried_private", "years_employed": 8,
        "annual_income": 900000,
        "monthly_emi": 18000, "existing_total_debt": 850000,
        "asset_value": 2500000, "monthly_expenditure": 35000, "savings": 300000,
        "owns_vehicle": True, "owns_property": True,
        "has_prior_credit": True, "has_defaulted": False,
        "payment_history": "good",
        "n_prior_credits": 4, "n_active_credits": 2, "years_credit_history": 9,
    }
    print(json.dumps(p.predict(sample), indent=2))

    risky = {**sample, "annual_income": 240000, "monthly_emi": 12000,
             "years_employed": 0.5, "has_defaulted": True,
             "payment_history": "poor", "savings": 15000,
             "owns_property": False, "years_credit_history": 1,
             "monthly_expenditure": 14000}
    print(json.dumps(p.predict(risky), indent=2))
