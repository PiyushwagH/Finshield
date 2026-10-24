import uuid
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import get_db
from app.models.user import User
from app.models.expense import Expense
from app.core.security import create_access_token

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def isolated_db():
    # Other test modules install their own get_db override at import time;
    # pin ours for the duration of each test here.
    app.dependency_overrides[get_db] = override_get_db
    app.state.limiter.enabled = False
    User.__table__.create(bind=engine, checkfirst=True)
    Expense.__table__.create(bind=engine, checkfirst=True)
    yield
    Expense.__table__.drop(bind=engine, checkfirst=True)


client = TestClient(app)


def _make_user():
    db = TestingSessionLocal()
    uid = uuid.uuid4()
    db.add(User(id=uid, email=f"exp_{uid.hex[:8]}@example.com", full_name="Exp", password_hash="x"))
    db.commit()
    db.close()
    return {"Authorization": f"Bearer {create_access_token(data={'sub': str(uid)})}"}


def _add(headers, **overrides):
    body = {"amount": 250, "category": "food", "spent_on": date.today().isoformat(), **overrides}
    return client.post("/api/expenses", json=body, headers=headers)


def test_requires_auth():
    assert client.get("/api/expenses").status_code == 401


def test_create_and_list():
    h = _make_user()
    r = _add(h, amount=120.5, category="travel", payment_mode="upi", note="  auto  ")
    assert r.status_code == 201
    data = r.json()
    assert data["category"] == "travel"
    assert data["note"] == "auto"
    listed = client.get("/api/expenses", headers=h).json()
    assert len(listed) == 1 and listed[0]["id"] == data["id"]


@pytest.mark.parametrize("bad", [
    {"amount": 0},
    {"amount": -5},
    {"amount": 12.345},
    {"category": "gambling"},
    {"payment_mode": "crypto"},
    {"spent_on": (date.today() + timedelta(days=5)).isoformat()},
    {"note": "x" * 201},
])
def test_validation_rejects_bad_input(bad):
    h = _make_user()
    assert _add(h, **bad).status_code == 422


def test_users_cannot_see_or_touch_each_others_expenses():
    a, b = _make_user(), _make_user()
    exp_id = _add(a).json()["id"]
    assert client.get("/api/expenses", headers=b).json() == []
    assert client.patch(f"/api/expenses/{exp_id}", json={"amount": 1}, headers=b).status_code == 404
    assert client.delete(f"/api/expenses/{exp_id}", headers=b).status_code == 404
    assert len(client.get("/api/expenses", headers=a).json()) == 1


def test_update_and_delete():
    h = _make_user()
    exp_id = _add(h).json()["id"]
    r = client.patch(f"/api/expenses/{exp_id}", json={"amount": 999, "category": "bills"}, headers=h)
    assert r.status_code == 200
    assert float(r.json()["amount"]) == 999 and r.json()["category"] == "bills"
    assert client.delete(f"/api/expenses/{exp_id}", headers=h).status_code == 204
    assert client.get("/api/expenses", headers=h).json() == []


def test_month_filter_and_summary():
    h = _make_user()
    _add(h, amount=100, category="food", spent_on="2026-03-02")
    _add(h, amount=300, category="food", spent_on="2026-03-15")
    _add(h, amount=200, category="travel", spent_on="2026-03-15")
    _add(h, amount=50, category="food", spent_on="2026-02-20")

    march = client.get("/api/expenses?month=2026-03", headers=h).json()
    assert len(march) == 3
    assert march[0]["spent_on"] == "2026-03-15"  # newest first

    s = client.get("/api/expenses/summary?month=2026-03", headers=h).json()
    assert float(s["total"]) == 600
    assert s["count"] == 3
    assert s["days_in_month"] == 31
    assert float(s["avg_per_day"]) == round(600 / 31, 2)  # past month: full month
    assert float(s["previous_month_total"]) == 50
    assert [c["category"] for c in s["by_category"]] == ["food", "travel"]
    assert float(s["by_category"][0]["total"]) == 400
    assert [d["date"] for d in s["daily"]] == ["2026-03-02", "2026-03-15"]


def test_invalid_month_param():
    h = _make_user()
    assert client.get("/api/expenses?month=2026-13", headers=h).status_code == 422
    assert client.get("/api/expenses/summary?month=march", headers=h).status_code == 422


def test_pdf_report():
    h = _make_user()
    _add(h, amount=1250, category="rent", note="Rent <Oct> & deposit", spent_on="2026-03-05")
    r = client.get("/api/expenses/report.pdf?month=2026-03", headers=h)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert 'filename="FinShield-Expenses-2026-03.pdf"' in r.headers["content-disposition"]
    assert r.content.startswith(b"%PDF")

    # Empty month still produces a valid PDF; no auth -> 401.
    assert client.get("/api/expenses/report.pdf?month=2026-01", headers=h).content.startswith(b"%PDF")
    assert client.get("/api/expenses/report.pdf?month=2026-03").status_code == 401
