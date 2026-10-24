import calendar
import uuid
from datetime import date
from decimal import Decimal
from typing import List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.expense import Expense
from app.models.user import User
from app.services.expense_pdf import generate_expense_pdf
from app.schemas.expense import (
    ExpenseCategory, ExpenseCreate, ExpenseResponse,
    ExpenseSummary, ExpenseUpdate,
)

router = APIRouter(prefix="/api/expenses", tags=["expenses"])

MONTH_PATTERN = r"^\d{4}-(0[1-9]|1[0-2])$"


def _month_bounds(month: Optional[str]) -> Tuple[date, date, str]:
    """Return (first_day, last_day, 'YYYY-MM') for the given month, default current."""
    if month:
        year, mon = (int(p) for p in month.split('-'))
    else:
        today = date.today()
        year, mon = today.year, today.month
    last = calendar.monthrange(year, mon)[1]
    return date(year, mon, 1), date(year, mon, last), f"{year:04d}-{mon:02d}"


def _get_owned(db: Session, expense_id: uuid.UUID, user: User) -> Expense:
    expense = db.query(Expense).filter(Expense.id == expense_id, Expense.user_id == user.id).first()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")
    return expense


@router.get("", response_model=List[ExpenseResponse])
def list_expenses(
    month: Optional[str] = Query(None, pattern=MONTH_PATTERN),
    category: Optional[ExpenseCategory] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start, end, _ = _month_bounds(month)
    query = db.query(Expense).filter(
        Expense.user_id == current_user.id,
        Expense.spent_on >= start,
        Expense.spent_on <= end,
    )
    if category:
        query = query.filter(Expense.category == category)
    return query.order_by(Expense.spent_on.desc(), Expense.created_at.desc()).all()


@router.post("", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_expense(
    data: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expense = Expense(user_id=current_user.id, **data.model_dump())
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.patch("/{expense_id}", response_model=ExpenseResponse)
def update_expense(
    expense_id: uuid.UUID,
    data: ExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expense = _get_owned(db, expense_id, current_user)
    for key, value in data.model_dump(exclude_unset=True).items():
        if key in ('amount', 'category', 'spent_on') and value is None:
            continue  # required columns can't be cleared
        setattr(expense, key, value)
    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    expense_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expense = _get_owned(db, expense_id, current_user)
    db.delete(expense)
    db.commit()


def _build_summary(db: Session, user: User, month: Optional[str]) -> dict:
    start, end, label = _month_bounds(month)
    in_month = (
        Expense.user_id == user.id,
        Expense.spent_on >= start,
        Expense.spent_on <= end,
    )

    by_category_rows = (
        db.query(Expense.category, func.sum(Expense.amount), func.count(Expense.id))
        .filter(*in_month)
        .group_by(Expense.category)
        .all()
    )
    by_category = sorted(
        ({"category": c, "total": Decimal(t or 0), "count": n} for c, t, n in by_category_rows),
        key=lambda x: x["total"],
        reverse=True,
    )

    daily_rows = (
        db.query(Expense.spent_on, func.sum(Expense.amount))
        .filter(*in_month)
        .group_by(Expense.spent_on)
        .order_by(Expense.spent_on)
        .all()
    )
    daily = [{"date": d, "total": Decimal(t or 0)} for d, t in daily_rows]

    total = sum((c["total"] for c in by_category), Decimal(0))
    count = sum(c["count"] for c in by_category)

    # For the current month, average over days elapsed so far, not the full
    # month - otherwise the average looks artificially low early in the month.
    today = date.today()
    days_counted = today.day if (start.year, start.month) == (today.year, today.month) else end.day
    avg = (total / days_counted).quantize(Decimal('0.01')) if days_counted else Decimal(0)

    prev_start, prev_last, _ = _month_bounds(
        f"{start.year - 1}-12" if start.month == 1 else f"{start.year:04d}-{start.month - 1:02d}"
    )
    previous_total = (
        db.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(
            Expense.user_id == user.id,
            Expense.spent_on >= prev_start,
            Expense.spent_on <= prev_last,
        )
        .scalar()
    )

    return {
        "month": label,
        "total": total,
        "count": count,
        "days_in_month": end.day,
        "days_counted": days_counted,
        "avg_per_day": avg,
        "previous_month_total": Decimal(previous_total or 0),
        "by_category": by_category,
        "daily": daily,
    }


@router.get("/summary", response_model=ExpenseSummary)
def expense_summary(
    month: Optional[str] = Query(None, pattern=MONTH_PATTERN),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _build_summary(db, current_user, month)


@router.get("/report.pdf")
def expense_report_pdf(
    month: Optional[str] = Query(None, pattern=MONTH_PATTERN),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    summary = _build_summary(db, current_user, month)
    start, end, label = _month_bounds(month)
    expenses = (
        db.query(Expense)
        .filter(Expense.user_id == current_user.id, Expense.spent_on >= start, Expense.spent_on <= end)
        .order_by(Expense.spent_on.asc(), Expense.created_at.asc())
        .all()
    )
    rows = [
        {"spent_on": e.spent_on, "category": e.category, "payment_mode": e.payment_mode,
         "note": e.note, "amount": e.amount}
        for e in expenses
    ]
    owner = current_user.full_name or current_user.email
    month_label = start.strftime("%B %Y")
    pdf = generate_expense_pdf(summary, rows, owner=owner, month_label=month_label)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="FinShield-Expenses-{label}.pdf"'},
    )
