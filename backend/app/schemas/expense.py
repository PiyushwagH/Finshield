import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

ExpenseCategory = Literal[
    'food', 'groceries', 'travel', 'rent', 'bills', 'emi', 'health',
    'education', 'shopping', 'entertainment', 'other',
]
PaymentMode = Literal['cash', 'upi', 'card', 'netbanking', 'other']

MAX_AMOUNT = Decimal('10000000')  # ₹1 crore per single entry - catches typos, not real spending


def _not_in_future(v: date) -> date:
    # One day of slack: the server runs on UTC while users are on IST, so
    # "today" for a user can be "tomorrow" relative to the server clock.
    if v > date.today() + timedelta(days=1):
        raise ValueError('Expense date cannot be in the future')
    return v


class ExpenseCreate(BaseModel):
    amount: Decimal = Field(gt=0, le=MAX_AMOUNT, decimal_places=2)
    category: ExpenseCategory
    payment_mode: Optional[PaymentMode] = None
    note: Optional[str] = Field(default=None, max_length=200)
    spent_on: date

    @field_validator('spent_on')
    @classmethod
    def validate_date(cls, v: date) -> date:
        return _not_in_future(v)

    @field_validator('note')
    @classmethod
    def strip_note(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() or None if v else None


class ExpenseUpdate(BaseModel):
    amount: Optional[Decimal] = Field(default=None, gt=0, le=MAX_AMOUNT, decimal_places=2)
    category: Optional[ExpenseCategory] = None
    payment_mode: Optional[PaymentMode] = None
    note: Optional[str] = Field(default=None, max_length=200)
    spent_on: Optional[date] = None

    @field_validator('spent_on')
    @classmethod
    def validate_date(cls, v: Optional[date]) -> Optional[date]:
        return _not_in_future(v) if v else v


class ExpenseResponse(BaseModel):
    id: uuid.UUID
    amount: Decimal
    category: str
    payment_mode: Optional[str] = None
    note: Optional[str] = None
    spent_on: date
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CategoryTotal(BaseModel):
    category: str
    total: Decimal
    count: int


class DailyTotal(BaseModel):
    date: date
    total: Decimal


class ExpenseSummary(BaseModel):
    month: str
    total: Decimal
    count: int
    days_in_month: int
    avg_per_day: Decimal
    previous_month_total: Decimal
    by_category: List[CategoryTotal]
    daily: List[DailyTotal]
