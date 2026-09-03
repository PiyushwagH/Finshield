# FinShield

FinShield is a project aimed at providing predictive financial modeling. This repository includes a React frontend, a FastAPI backend, and pre-trained Machine Learning models.

## Local Setup Instructions

This project runs natively on your machine without Docker. Follow the steps below to set it up.

### Prerequisites
- Node.js (v18+)
- Python (3.11+)
- PostgreSQL (15+) natively installed and running

### 1. Database Setup
Create a PostgreSQL database named `finshield`:
```bash
createdb finshield
# Or via psql: CREATE DATABASE finshield;
```

### 2. Backend Setup
Navigate to the `backend` directory and set up the Python environment:
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Set up your environment variables. Copy the `.env.example` file to `.env`:
```bash
cp ../.env.example .env
```
Ensure your `.env` contains the correct `DATABASE_URL` (e.g., `postgresql://postgres:postgrespassword@localhost:5432/finshield`) and a strong `SECRET_KEY`.

Run Alembic migrations (make sure you initialize Alembic if you haven't already):
```bash
alembic upgrade head
```

Start the backend server:
```bash
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend Setup
In a new terminal window, navigate to the `frontend` directory:
```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.
