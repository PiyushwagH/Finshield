# FinShield — Agent Instructions

Read this before any task in this workspace. These rules apply to every agent,
every task, always.

---

## THE MODEL IS FROZEN — DO NOT MODIFY

`ml/finshield_model.pkl` is a trained LightGBM classifier. It took hours to
train on a 700MB dataset that is **not in this repository**. It cannot be
regenerated here.

**Never:**
- Retrain, refit, or replace the model
- Modify `finshield_predictor.py`'s feature engineering, field mappings, or
  category levels
- Change the feature list, the order of features, or the category values
- Substitute a different algorithm, a dummy model, or random predictions
- Delete or overwrite `finshield_model.pkl`
- "Fix" the model to make a test pass

**If the model fails to load**, the cause is a dependency version mismatch, not
a bad model. Pin the versions in `ml/requirements.txt` and report the error.
Do not work around it by generating fake predictions.

**If you need a change to prediction output**, stop and ask. Do not decide on
your own.

The scripts `step1_*.py` through `step4_*.py` are training code kept for
academic reproducibility. **Never run them** — they need CSV files that do not
exist here and will fail.

---

## Model contract

`FinShieldPredictor.predict(form_dict)` returns exactly this shape. The frontend
must render these fields and no invented ones.

```json
{
  "default_probability": 0.0942,
  "risk_band": "Moderate",
  "risk_score": 641,
  "population_percentile": 62.0,
  "affordability": {
    "grade": "Stretched",
    "monthly_surplus": 12000.0,
    "surplus_ratio": 0.16,
    "emi_to_income_ratio": 0.42,
    "emergency_fund_months": 2.8,
    "flags": ["EMIs are above the 40% comfort threshold"]
  },
  "factors": {
    "positive": ["Stable employment record"],
    "negative": ["Existing EMIs consume a large share of income"]
  },
  "model_meta": {
    "auc": 0.6853,
    "trained_on": 307511,
    "population_default_rate": 0.0807
  }
}
```

### Required input fields

All of these must be collected by the form and sent to the API:

`age, gender, education, marital_status, dependents, employment_status,
years_employed, annual_income, monthly_emi, existing_total_debt, asset_value,
monthly_expenditure, savings, owns_vehicle, owns_property, has_prior_credit,
has_defaulted, payment_history, n_prior_credits, n_active_credits,
years_credit_history`

Dropdown values must match exactly. `GET /api/schema` returns the valid values —
the frontend must use that endpoint rather than hardcoding a different set.

### Risk band display

The model returns five bands: `Very Low, Low, Moderate, High, Very High`.

The UI displays **three**: Low (Very Low + Low), Medium (Moderate), High
(High + Very High).

This grouping happens **in the frontend only**. Never change the model's bands.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + **plain JavaScript** (no TypeScript) |
| Styling | **Plain CSS only** — CSS Modules per component, no Tailwind, no styled-components, no CSS framework |
| State | React Context + hooks. Axios for HTTP calls |
| Routing | React Router v6 |
| Charts | Recharts |
| Backend | Python 3.11 + FastAPI + Pydantic v2 |
| ORM | SQLAlchemy 2.0 + Alembic migrations |
| Database | PostgreSQL 15 |
| Auth | JWT access + refresh tokens, bcrypt password hashing |
| ML runtime | LightGBM (version pinned in ml/requirements.txt) |
| Dev environment | Docker Compose |

Do not substitute technologies without asking.

**Frontend is plain JavaScript and plain CSS. This is a hard requirement.**
Use `.jsx` files, never `.tsx`. Use `.module.css` files alongside components,
never Tailwind utility classes, never inline style objects for layout. Do not
add TypeScript, Tailwind, Bootstrap, Material UI, Chakra, or any other CSS
framework or component library. Recharts is the only UI library permitted, and
only for charts.

---

## Design fidelity

`design/screenshots/` holds the approved UI designs. `design/stitch-code/` holds
the generated HTML/CSS for each.

Build to match the screenshots. Extract exact colors, spacing and typography
from the Stitch code rather than approximating. When a screenshot and this file
disagree on a data field, this file wins — the screenshot may show placeholder
content.

### Design tokens

Declare these once in `frontend/src/styles/variables.css` under `:root` and
reference them everywhere with `var(--navy)`. Never hardcode a hex value in a
component stylesheet.

```
--navy:        #0F2A47
--teal:        #0E8F86
--amber:       #E8A317
--risk-low:    #16A34A
--risk-medium: #F59E0B
--risk-high:   #DC2626
--bg:          #FFFFFF
--bg-alt:      #F7F9FC
--text:        #1A2332
--text-muted:  #5B6B7F
```

Font: Inter. Card radius 12px. Base spacing unit 24px on an 8px grid.
Max content width 1200px. Responsive down to 360px.

---

## Rules

1. **Ask before deviating.** If a requirement seems wrong or a library is
   missing, stop and ask rather than improvising.
2. **No mock data in production paths.** Seed files are fine and belong in
   `backend/seeds/`. Never hardcode fake predictions or fake schemes into
   application code.
3. **Server-side validation is authoritative.** Client validation is a
   convenience only.
4. **Never log financial values.** Log user IDs and event names, not incomes or
   debts.
5. **Every stored prediction records the model version** for traceability.
6. **Currency is INR.** Format with the Indian grouping system (9,00,000 not
   900,000).
7. **Every risk output carries a disclaimer** that it is an indicative estimate,
   not a credit decision or licensed financial advice.
8. **Scheme browsing must work when the ML service is down.** The two are
   independently useful.
9. **Write tests as you go.** pytest for backend, Vitest for frontend.
10. **One feature per task.** Do not build multiple screens in parallel in the
    same branch.

---

## Out of scope

Do not build: payment processing, real government portal API integration
(link out to official portals instead), SMS or OTP delivery, or a mobile app.
