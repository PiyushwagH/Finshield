import re
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
import uuid

def _validate_password_strength(v: str) -> str:
    if len(v) < 8:
        raise ValueError('Password must be at least 8 characters long')
    if not re.search(r'[A-Za-z]', v):
        raise ValueError('Password must contain at least one letter')
    if not re.search(r'\d', v):
        raise ValueError('Password must contain at least one number')
    return v


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        return _validate_password_strength(v)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator('new_password')
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        return _validate_password_strength(v)

class UserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    role: str
    full_name: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class LoginResponse(Token):
    """Returned by the role-scoped login endpoints.

    Carries the role and user record alongside the token so the caller can
    route straight to the right landing page without a follow-up /auth/me.
    """
    role: str
    user: UserResponse
