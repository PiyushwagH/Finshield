# FinShield — Context for Review-II PPT

This file summarizes the actual, verified state of the FinShield project as of
2026-10-19, for use as reference material when drafting the Review-II
presentation. Every claim below was checked against the running code or the
live deployment during development — nothing here is aspirational.

---

## 1. What FinShield Is

FinShield is a full-stack web application with two functions:

1. **Financial risk assessment** — a user fills a multi-step form about their
   personal, employment, and financial situation; a trained ML model returns
   a default-risk probability, a credit-score-style risk score, and a
   plain-language breakdown of what's driving the result.
2. **Government welfare scheme discovery** — users browse and get matched to
   Indian government welfare schemes (central and state) based on their
   profile, with a direct link to apply on the scheme's official portal.

The two features are intentionally decoupled: scheme browsing works even if
the ML service is unavailable.

Beyond the two core features, the app now has a full account layer: email-based
password reset, an editable profile with a photo, an active-sessions
("Security Log") view with per-session revoke, and an admin console for
managing users, schemes, and scheme-data review.

---

## 2. System Architecture

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite, plain JavaScript (`.jsx`, no TypeScript), plain CSS Modules (no Tailwind/UI framework) |
| Routing | React Router v7 |
| HTTP client | Axios |
| Charts | Recharts |
| Backend | Python 3.11 + FastAPI + Pydantic v2 |
| ORM / migrations | SQLAlchemy 2.0 (pinned `<2.1`, see Section 11) + Alembic |
| Database | PostgreSQL 18 (hosted on **Neon**, serverless Postgres) |
| Auth | JWT access tokens (15 min) + httpOnly refresh-token cookies (7 days), bcrypt password hashing |
| Email | Resend (password-reset links; falls back to server-side logging if unconfigured) |
| ML runtime | LightGBM |
| Rate limiting | slowapi |

### Deployment topology

- **Frontend** → Vercel (`finshield-three.vercel.app`)
- **Backend (FastAPI + ML)** → Render, a standard container-based web service
  (`finshield-backend-4un4.onrender.com`)
- **Database** → Neon (managed Postgres, serverless)

**Why the backend is not on Vercel:** it was originally deployed there and
failed outright (every request returned `500 FUNCTION_INVOCATION_FAILED`).
Root cause: Vercel serverless functions cap at 250MB unzipped; this backend's
ML dependencies alone (`lightgbm` + `pandas` + `scikit-learn` + `numpy` +
`scipy`) total ~256MB, before FastAPI/SQLAlchemy are even counted. Vercel is
architecturally unsuitable for a Python service bundling a real ML stack.
Render (a normal container, no such size cap) was used instead — this is a
legitimate, documented architectural decision, worth mentioning in a
"Design/System Architecture" slide as a real engineering trade-off that was
diagnosed and resolved, not just "we deployed it."

### Authentication design

Three login endpoints, all built on shared `_authenticate` / `_issue_session`
helpers in `backend/app/routers/auth.py`:

- `POST /api/auth/login` — role-agnostic; kept only because it's the OAuth2
  `tokenUrl` FastAPI's dependency injection uses internally.
- `POST /api/auth/login/user` — the customer portal login. Accepts any active
  account, admins included (an admin is also a user).
- `POST /api/auth/login/admin` — the admin console login. Returns 403 if the
  account's role isn't `admin`. Checks the password before the role, so a
  wrong password always returns 401 regardless of role — this prevents the
  403 response itself from leaking whether a password was correct.

The frontend has two separate login surfaces (`/login` and `/admin/login`)
sharing one `Auth.jsx` component via a `mode` prop.

**Admin accounts are never self-service.** There is deliberately no public
"create admin" UI — that would let anyone on the internet grant themselves
admin access. The real path: a person signs up as a normal user through the
public Sign Up form, then a project owner runs
`backend/scripts/create_admin.py <email>` against the database to promote
that one account. This is a conscious security decision worth naming in a
review if asked "how do you create an admin."

### Password reset (added this cycle)

Previously, `POST /auth/forgot-password` and `POST /auth/reset-password` were
**complete no-op stubs** — the UI claimed success ("a reset link has been
sent") but nothing happened server-side: no token, no email, no password
change. This was found and fixed:

- `POST /auth/forgot-password` generates a single-use, SHA-256-hashed,
  30-minute-expiry token (`password_reset_tokens` table), and emails a reset
  link via Resend's API. If `RESEND_API_KEY` isn't configured (e.g. local
  dev), the link is logged server-side instead of silently failing. The
  response message is identical whether or not the email belongs to an
  account, so the endpoint can't be used to enumerate registered users.
- `POST /auth/reset-password` validates the token, updates the password, and
  **revokes every existing refresh-token session** for that account — a
  password reset should invalidate all prior sessions, not just the current
  device.
- A real bug was caught during verification, not assumed fixed: Postgres
  returns a timezone-aware datetime for the token's expiry column, but the
  comparison code used a naive `datetime.utcnow()`, which crashed with a 500
  — passed in the local SQLite test suite (which returns naive datetimes)
  but failed against the real production database. Fixed with a
  dialect-agnostic comparison, re-verified against the live database.

### Profile, Photo, and Security Log (added this cycle)

- `PATCH /api/auth/me` lets a user update their name, phone, and a profile
  photo (stored as a size-capped, server-validated base64 `data:` URI —
  there's no object-storage service set up for this project, so the photo
  lives directly in the `users.avatar_data` column rather than adding a new
  infra dependency).
- `GET /api/auth/sessions` / `DELETE /api/auth/sessions/{id}` expose the
  account's active (non-revoked) refresh-token sessions, each ownership-
  checked so one user can never revoke another's session — this is what
  backs the "Security Log" page.
- The dashboard avatar used to log the user out **instantly** on click, with
  no way to view or edit a profile at all. It now opens the Settings/profile
  page instead. The same bug existed independently in the admin console's
  layout and was fixed there too.

### System architecture diagram

Deployment/component view — three independently hosted pieces talking over
HTTPS, with the ML model loaded in-process inside the backend rather than as
a separate service:

```mermaid
flowchart TB
    subgraph Client["User's Browser"]
        UI["React SPA\n(user portal + admin console)"]
    end

    subgraph Vercel["Vercel"]
        Frontend["Static frontend build\nVite + React Router"]
    end

    subgraph Render["Render (container)"]
        API["FastAPI app"]
        subgraph Routers["Routers"]
            AuthR["auth"]
            RiskR["risk"]
            SchemeR["scheme / user_scheme"]
            AdminR["admin"]
        end
        subgraph Services["Services"]
            RiskSvc["risk_service"]
            EligSvc["eligibility_service"]
            AdviceSvc["advice_service"]
            EmailSvc["email_service (Resend)"]
        end
        Model["FinShieldPredictor\n(LightGBM, ml/finshield_model.pkl)"]
        API --> Routers
        RiskR --> RiskSvc --> Model
        SchemeR --> EligSvc
        RiskR --> AdviceSvc
        AuthR --> EmailSvc
    end

    subgraph Neon["Neon (managed Postgres)"]
        DB[("PostgreSQL 18\nusers, assessments, schemes,\naudit_logs, refresh_tokens,\npassword_reset_tokens")]
    end

    UI -- "HTTPS" --> Frontend
    UI -- "Axios: JWT access token (memory)\n+ httpOnly refresh cookie" --> API
    Services --> DB
    Routers --> DB
```

Request flow for a risk assessment, end to end:

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant F as React Frontend (Vercel)
    participant B as FastAPI Backend (Render)
    participant M as LightGBM Model (in-process)
    participant D as Neon Postgres

    U->>F: Fill 4-step assessment form
    F->>B: POST /api/risk/assess (JWT bearer)
    B->>B: Validate payload (Pydantic)
    B->>M: predictor.predict(form_dict)
    M-->>B: probability, risk_score, band, factors
    B->>D: INSERT assessment (with model_version)
    D-->>B: assessment row
    B-->>F: AssessmentResponse JSON
    F-->>U: Risk gauge + affordability + factors + disclaimer
```

Why this shape, for the review: the ML model is loaded once at backend
startup and served in-process (not as a separate microservice) — simplest
correct choice at this scale, and it's what makes the startup self-check
(section 3) possible, since the same process that serves predictions can
validate itself on boot. Scheme matching is a separate code path from risk
assessment (`eligibility_service`, not `risk_service`), which is what allows
scheme browsing to keep working independently of the ML pipeline.

---

## 3. The ML Model

**Algorithm:** LightGBM (`LGBMClassifier`, gradient-boosted decision trees).

**Hyperparameters:** 322 boosting rounds, 48 leaves per tree, learning rate
0.03, binary objective.

**Training data:** 307,511 rows. Population base default rate: 8.07%.

**Performance:**
| Metric | Value |
|---|---|
| AUC | 0.685 |
| Gini | 0.371 |
| KS statistic | 0.271 |
| Brier score | 0.071 |

Worth stating honestly in the review: AUC 0.685 is moderate, not strong, by
production credit-scorecard standards (0.75+ is typical for a deployed
scorecard). This is disclosed in-app — every result carries a disclaimer that
it is an indicative estimate, not a credit decision or financial advice.

**24 engineered features** fed to the model, derived from the user's 21 raw
form inputs (e.g. `owns_vehicle` → `OWNS_CAR`), including several derived
ratios: `DTI`, `DEBT_TO_INCOME`, `INCOME_PER_HEAD`, `INCOME_PER_YEAR_WORKED`,
`EMPLOYMENT_RATIO`. Categorical features: gender, education, marital status,
employment status, payment history.

**Output shape** (`FinShieldPredictor.predict()`):
- `default_probability` — raw model output
- `risk_score` — a 300–850 linear rescale of the probability onto a
  FICO-style range (`300 + (1 - prob/0.5) * 550`, clamped); higher = safer
- `risk_band` — one of 5 bands (Very Low/Low/Moderate/High/Very High) from
  fixed probability cutoffs baked into the model file; the frontend collapses
  these to 3 bands (Low/Medium/High) for display only — the model's own bands
  are never altered
- `population_percentile`
- `affordability` block — grade, monthly surplus, surplus ratio,
  EMI-to-income ratio, emergency fund months, flags
- `factors` — plain-language positive/negative drivers of the score

**The model file (`ml/finshield_model.pkl`) is frozen** — it cannot be
retrained in this environment; the 700MB training dataset isn't included in
the repo. A startup self-check runs a fixed sample input on every backend
boot and logs a critical error if the output drifts from the expected value
(`0.0232`), to catch a dependency version mismatch silently corrupting
predictions.

**Important, demo-relevant clarification verified this cycle:** the ML risk
band and the separate affordability heuristic can legitimately disagree, and
this isn't a bug. A profile with no prior credit history and no past defaults
reads as low statistical default-risk to the model even if the person's
current cash flow is badly stretched (which the affordability panel correctly
flags as "Critical"). Credit-history fields (`has_prior_credit`,
`has_defaulted`, `payment_history`) are what the model weighs most heavily —
income/expense extremity alone does not push the risk band up. This was
confirmed by pulling a real user's stored `input_data` from the database and
reproducing the exact "Low risk + Critical affordability" result, then
resubmitting the same profile with only the credit-history fields changed and
getting `Very High` / score 300 back from the live production API. Worth a
sentence in the paper's Discussion/Limitations section.

---

## 4. Scheme Recommendation Engine

- Eligibility rules are stored per scheme as `(field, operator, value,
  logic_group)` tuples, evaluated against the user's profile.
- Groups combine with AND; multiple groups combine with OR (so a scheme can
  have more than one eligibility path — e.g. "SC/ST OR women entrepreneurs").
- `POST /api/schemes/match` — full-profile matching (logged-in users, uses
  the assessment data).
- `POST /api/schemes/quick-match` — lighter matching (works without login,
  fewer fields) — this is what keeps scheme discovery independent of the ML
  service.
- Every scheme card links directly to the scheme's real official application
  URL (`official_url` field) — this app does not build a government
  application flow itself; it links out, by design.

### Data status (the honest bottleneck — now meaningfully smaller)

| Status | Count | Meaning |
|---|---|---|
| `active` (visible to users) | **27** | Real, sourced, verified schemes |
| `archived` | 17 | Removed fabricated placeholder data — see below |
| `needs_review` | 0 | All currently-sourced schemes have been reviewed and published |

**Important context for the review:** the project originally shipped with 17
fake "State Welfare Scheme 9–25" entries — invented benefit amounts, a
generic non-scheme URL, and descriptions that literally read "This is a
placeholder" — live and shown to users as real schemes. These were identified
and archived, and have been deliberately **kept archived** rather than
reactivated, even when asked, precisely because reactivating them would
reintroduce fabricated financial guidance into a live product.

In their place, 27 real schemes have been added across three verified
batches, each individually researched and cross-checked against multiple
independent sources (not generated from memory):

**Central schemes (24):** PM-KISAN, PMAY (Urban), Sukanya Samriddhi Yojana,
Atal Pension Yojana, PM Mudra Yojana, NSP Post-Matric Scholarship, Ayushman
Bharat (PM-JAY), Stand-Up India, PM Ujjwala Yojana, PMJJBY, PMSBY, PM Fasal
Bima Yojana, PM Vishwakarma, PMEGP, PM SVANidhi, NMMSS, PMMVY, PM Jan Dhan
Yojana, Pre-Matric Scholarship for SC students, MGNREGA, PM Shram Yogi
Maandhan (PM-SYM), PM Kaushal Vikas Yojana (PMKVY), PM Matsya Sampada Yojana
(PMMSY), Startup India.

**Maharashtra state schemes (3):** Mukhyamantri Majhi Ladki Bahin Yojana
(₹1,500/month DBT for eligible women), Rajarshi Chhatrapati Shahu Maharaj
Shikshan Shulk Shishyavrutti Yojana (tuition/exam fee waiver), Majhi Kanya
Bhagyashree Yojana (fixed-deposit scheme for families with daughters).

**Equally worth presenting: what was deliberately left out, and why.**
During research, several well-known schemes were investigated and *not*
added, because the available sources disagreed or the scheme's current
status was unclear — a stronger data-integrity story than silently including
everything found:
- **PMAY-Gramin** — eligibility is based on a fixed 2011-census survey list
  (SECC 2011), not criteria that can be expressed as reusable rules.
- **PM Vaya Vandana Yojana** — sources disagreed on whether the scheme is
  still open for new enrollment past March 2023/2026.
- **IGNOAPS / NSAP old-age pension** — pension amounts vary wildly by state
  (₹200 to ₹2,500/month) with no single reliable central figure, and one
  source's date range (1995–2019) raised doubt about current status.
- **MJPJAY (Maharashtra)** — merged into Ayushman Bharat–PMJAY in July 2024
  (which the app already lists), so a separate entry would be a duplicate.
- **Shiv Bhojan Thali Yojana (Maharashtra)** — no formal eligibility
  criteria at all (anyone can walk in), and multiple 2025 news reports
  describe unresolved funding/payment arrears casting doubt on current
  operational status.
- **The 2019 Maharashtra farmer loan waiver** — tied to a specific historical
  loan window (2015–2019) and superseded by a newer 2026 scheme not yet
  independently verified.

---

## 4a. Project Outcomes — What a User Actually Gets

This is the "Results" section for the paper — what the system delivers
end-to-end, not just the model's raw JSON output.

**Flow a real user goes through:**
1. Registers/logs in (separate user and admin login portals, JWT access +
   httpOnly refresh-token cookie session). Can reset a forgotten password via
   a real emailed link, and manage an editable profile with a photo.
2. Fills a 4-step risk assessment wizard (personal details → employment/
   assets → finances → credit history), with conditional fields (e.g. EMI/
   loan-balance inputs only appear if the user has active loans) and inline
   validation.
3. On submit, the backend calls the frozen LightGBM model and returns, within
   the same request, both the ML risk result and automatically ranked welfare
   scheme matches — the two modules work together in one flow even though
   they're independently functional.
4. **Risk Result screen** shows: a 300–850 gauge-style score with a 3-band
   color label (Low/Medium/High), the default probability and population
   percentile ("safer than X% of a reference population of 307,511
   applicants"), an affordability breakdown (monthly surplus, EMI-to-income
   ratio, emergency-fund-months), plain-language positive/negative factors
   driving the result, and a mandatory disclaimer that this is an indicative
   estimate from FinShield's trained ML model, not a credit decision or
   licensed financial advice.
5. **Scheme matches**: ranked list of government welfare schemes the user is
   currently eligible for, each with eligibility criteria shown and a link to
   the official government application portal (the app deliberately does not
   build its own application flow — see Out of Scope).
6. **Reports/History**: logged-in users can revisit past assessments; a
   Security Log page lists active sessions with per-session revoke; an admin
   console lets an admin manage scheme records (draft/active/archived/
   needs_review lifecycle), review detected scheme-data changes, and manage
   users — independent of the ML side.

**Outcome in one line for the abstract:** a single web application where a
user gets both an ML-backed, explainable credit-risk indication and a
personalized, linked list of government schemes they qualify for — two
problems (credit opacity and welfare scheme under-discovery) addressed in one
flow, each usable even if the other component fails (per Rule 8 in
AGENTS.md: scheme browsing works independent of the ML service).

**What to quantify in the Results section of the paper**, pulling from this
file: model metrics (section 3's table), scheme coverage honestly (27 active,
up from an initial 8, against India's 500+ actual schemes — see section 4),
test coverage (29 pytest + 46 API smoke checks, section 6), and the bug-fix
list (section 5) as evidence of a working, hardened system rather than a
prototype that only runs once.

---

## 5. Notable Bugs Found and Fixed This Cycle

Useful for a "Partial Implementation/Results" slide — shows engineering
rigor, not just feature-building. This list now spans two development
cycles; the newer items (8 onward) were found and fixed in the most recent
session:

1. **Assessment submission silently failed for every user without prior
   credit history.** The frontend sent `payment_history: "No History"`; the
   backend only accepted `"no_history"`. Every such submission was rejected
   before the ML model ever ran.
2. **That failure crashed the page to a blank white screen** instead of
   showing an error — FastAPI's 422 validation errors return an array of
   error objects, and the code tried to render that array directly as React
   children, which React refuses to do. Fixed with a proper error-formatting
   helper.
3. **Risk gauge showed a "Low Risk" label while the needle pointed at the red
   (high-risk) end of the dial** — traced via the SVG rotation math: the
   needle sweep direction was correct, but the color gradient was reversed.
4. **A committed secret**: an early commit included a real database
   password and JWT signing key in a tracked `.env` file, pushed to the
   public GitHub repo. Rotated, and the file moved to a gitignored location.
5. **Reserved-TLD email trap**: an admin account seeded with a
   `.local`-domain email address could log in with correct credentials but
   the server crashed with a 500 on every response, because Pydantic's
   `EmailStr` validator rejects reserved TLDs even on output serialization.
6. **`bcrypt`/`passlib` version incompatibility broke all logins on the fresh
   Render deployment** — `bcrypt>=4.1` raises on inputs over 72 bytes instead
   of silently truncating them (its old behavior), which crashed `passlib`
   1.7.4's own internal self-test on first use. Fixed by pinning
   `bcrypt==4.0.1`; verified in a clean virtual environment before deploying.
7. **A per-user data leak**: the risk-assessment wizard's draft (in-progress
   form data, including income and debt figures) was stored under one global
   `localStorage` key shared by every account on the same browser — so
   logging in as a second user showed the first user's unsaved financial
   data. Fixed by scoping the draft key to the logged-in user's ID and
   clearing it on logout.
8. **Cross-site refresh-token cookie failure after multi-domain deployment.**
   Once the frontend (Vercel) and backend (Render) were on different
   registrable domains, `SameSite=Lax` (correct for same-site local dev)
   meant browsers never attached the refresh cookie to the cross-site
   `/auth/refresh` call, surfacing as "Refresh token missing" whenever a
   15-minute access token expired mid-session. Fixed by making the cookie's
   `secure`/`samesite` attributes environment-driven.
9. **An unpinned `sqlalchemy` dependency broke every Render deploy.** Render
   builds from a fresh `pip install` on every deploy; it resolved to the
   newly-released SQLAlchemy 2.1, which changed the default driver for a
   bare `postgresql://` URL from `psycopg2` to `psycopg` (v3) — a driver
   this project never installs. Local dev was unaffected because its venv
   had an older SQLAlchemy cached from before. Reproduced the exact failure
   in a disposable clean virtualenv before fixing it by pinning `<2.1`.
10. **The entire app, including the public landing page, was blocked behind
    a backend network call on every single visit.** `AuthProvider` rendered
    nothing until `POST /auth/refresh` resolved — and Render's free tier
    cold-starts after ~15 minutes idle, which can take 30-60+ seconds to load
    a Python process with `pandas`/`lightgbm` in it. Fixed so only routes
    that actually require a known login state wait on that check; public
    pages render immediately.
11. **Password reset was a complete no-op.** The UI showed success messages
    ("a reset link has been sent," "password has been reset") but the
    backend endpoints did nothing at all — see Section 2's "Password reset"
    subsection for the full fix and the timezone bug caught during
    verification.
12. **The dashboard avatar instantly logged the user out on click**, with no
    way to view or edit a profile — the same bug existed independently in
    the admin console. Both now open a real profile/settings page instead.
13. **Logout always landed on the login form instead of the home page,
    regardless of which page triggered it.** Root cause: `ProtectedRoute`/
    `AdminRoute` each declaratively redirect to `/login` the instant `user`
    becomes `null` — which fires while the old protected page is still
    mounted during logout, racing the explicit "go home" navigation and
    usually winning. Fixed with a `loggingOut` flag so the route guards stay
    neutral during a deliberate logout.
14. **The admin "Scheme Updates" page's Pending/Approved/Rejected tabs did
    nothing when clicked**, and its sidebar badge was a hardcoded literal
    `3` regardless of the real count (which was actually 0). The backend
    endpoint also always filtered to `pending` with no way to request the
    other statuses. Fixed end-to-end: a `status` query param on the
    endpoint, real tab-switching on the frontend, and a sidebar badge that
    reads the actual `pending_updates` figure from `/admin/stats`.
15. **A hardcoded `"welfare"` category option in the admin scheme editor
    wasn't a valid value** in the backend's Postgres enum (`education`,
    `health`, `agriculture`, `business`) — any admin saving a new scheme
    without manually changing the default would have hit a database error.
    Also found: the editor was missing input fields for `official_url`,
    `application_mode`, `required_documents`, and benefit fields entirely,
    despite the backend already supporting them — meaning no admin could
    actually set a scheme's real application link through the UI before this
    was fixed.
16. **`SchemeDetail`'s "Similar Schemes" card was hardcoded** to always show
    the same two fake scheme names ("Kisan Credit Card," "PM Fasal Bima
    Yojana") regardless of which scheme was actually being viewed — a real
    mock-data violation live in production. Replaced with a real
    same-category API query.

---

## 6. Testing / Verification Infrastructure

- **Backend**: pytest suite, now **29 tests** (grew from the original 20 —
  new coverage added for profile updates, avatar validation, session
  listing/revocation, and cross-user session isolation), run against an
  isolated SQLite DB.
- **API smoke test** (`frontend/scripts/api-smoke-test.mjs`, `npm run
  test:api`): a standalone Node script hitting every backend endpoint on a
  live server — 46 checks covering auth, risk assessment, schemes,
  user-schemes, and admin routes, including negative cases (401/403/422).
  Zero dependencies.
- All fixes above were verified against the live production deployment
  (Render + Neon + Vercel) with real HTTP requests, not just locally — this
  discipline directly caught the production-only timezone bug in the
  password-reset flow (Section 5, item 11) that the local test suite missed.

---

## 7. What's Explicitly Out of Scope

Per the project's own constraints: payment processing, real government
portal API integration (the app links out to official portals instead of
building its own application flow), SMS/OTP delivery, a mobile app.

---

## 8. Suggested Framing for Review-II Slides

- **Objective**: two independent, functional modules — ML-based risk
  scoring and government scheme discovery — for financial inclusion, now
  wrapped in a complete account/security layer (password reset, profile
  management, session control).
- **Design/System Architecture**: use section 2 above; the Vercel→Render
  migration and the SQLAlchemy 2.1 incident are both genuine, presentable
  architecture/dependency-management decisions — diagnosed real constraints,
  chose and verified the right fix each time.
- **Partial Implementation/Results**: use sections 3, 5, and 6 — a working
  deployed system with a real trained model (cite the AUC/Gini/KS numbers),
  a documented 16-item bug-fixing history across two development cycles, and
  automated test coverage (29 unit + 46 API) is stronger evidence of
  "partial implementation" than most capstones show at this stage.
- **Honest gap to name explicitly** (don't let a reviewer find it first):
  scheme data coverage, while now at 27 real, verified schemes (more than
  tripled from the initial 8), is still a small fraction of India's actual
  500+ central and state schemes. Framing this as a deliberate
  data-integrity choice — each entry individually researched and cited,
  several well-known schemes deliberately excluded due to unclear or
  conflicting current status — is a stronger story than claiming broader
  coverage than is actually verified.

---

## 9. Screenshots — Not Included Here, But You Should Add Them

This is a text file with no images embedded. For both the slide deck and the
paper, take real screenshots of the live app yourself and drop them in
wherever a "Fig." reference appears — don't let a downstream Claude session
invent or describe placeholder UI. Minimum set worth capturing:

1. Landing page (shows the Admin Login / User Login split, and the new SVG
   dashboard illustration replacing the old empty placeholder box).
2. The assessment wizard — at least one step with the conditional loan
   fields visible (demonstrates the fixed mandatory-field bug).
3. The Risk Result screen — gauge, score, band label, affordability block,
   disclaimer text all visible in one shot.
4. The scheme match list — a card showing eligibility criteria and the
   official application link.
5. The Settings page showing the profile photo upload and editable fields.
6. The Security Log page listing active sessions.
7. The admin console's scheme management table (draft/active/needs_review
   status visible) and the Scheme Updates page with working tabs — shows
   the data-integrity workflow, not just the end-user side.
8. Optional: the Reports/history page, and a terminal screenshot of the
   pytest + API smoke-test run (see section 6) as evidence of the test
   infrastructure, if the paper's venue expects that kind of proof.

Use real data/test accounts, not production users' real financial figures,
per the "never log financial values" rule — screenshots are also a form of
exposure, so use test or dummy accounts when capturing these.
