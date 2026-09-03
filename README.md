# FinShield

FinShield is a project aimed at providing predictive financial modeling. This repository includes a React frontend, a FastAPI backend, and pre-trained Machine Learning models.

## Local Setup Instructions

This project runs natively on your machine without Docker. Follow the steps below to set it up.

### Prerequisites
- Node.js (v18+)
- Python (3.11+)
- PostgreSQL (15+) natively installed and running

### 1. Database Setup

Either a local PostgreSQL database:
```bash
createdb finshield
# Or via psql: CREATE DATABASE finshield;
```

…or a hosted Neon database — copy the **pooled** connection string from the Neon
dashboard and use it as `DATABASE_URL` in step 2. No local PostgreSQL needed.

### 2. Backend Setup
Navigate to the `backend` directory and set up the Python environment:
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Set up your environment variables. Copy the template to `backend/.env`:
```bash
cp .env.example .env
```
Ensure `backend/.env` contains the correct `DATABASE_URL` and a strong `SECRET_KEY`
(generate one with `python -c "import secrets; print(secrets.token_hex(32))"`).
`backend/.env` is gitignored — never commit it.

Run Alembic migrations to create the schema:
```bash
alembic upgrade head
```

Load the welfare scheme seed data:
```bash
python scripts/run_sync.py
```

Start the backend server:
```bash
uvicorn app.main:app --reload --port 8000
```

To create an admin account, register a user through the app, then promote it:
```bash
python scripts/create_admin.py you@example.com
```

### 3. Frontend Setup
In a new terminal window, navigate to the `frontend` directory:
```bash
cd frontend
cp .env.example .env   # sets VITE_API_URL to the backend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

### 4. Verifying the backend

With the backend running, this exercises every API endpoint the frontend calls
and prints a pass/fail line for each:
```bash
cd frontend
npm run test:api
```

Admin endpoint checks need an admin account:
```bash
TEST_ADMIN_EMAIL=you@example.com TEST_ADMIN_PASSWORD=... npm run test:api
```

Backend unit tests (run against a local SQLite file, not your real database):
```bash
cd backend && pytest
```
