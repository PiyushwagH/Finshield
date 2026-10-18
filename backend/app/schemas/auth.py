import re
from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
import uuid

# ~500KB of raw image data, base64-inflated (~4/3x) plus the data: URI
# prefix - generous for a profile photo thumbnail without letting someone
# bloat a row with a multi-MB upload.
MAX_AVATAR_DATA_URI_LENGTH = 700_000

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
    phone: Optional[str] = None
    avatar_data: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    # A data: URI, e.g. "data:image/png;base64,...". Pass an empty string to
    # remove the current photo.
    avatar_data: Optional[str] = None

    @field_validator('avatar_data')
    @classmethod
    def validate_avatar_data(cls, v: Optional[str]) -> Optional[str]:
        if v and len(v) > MAX_AVATAR_DATA_URI_LENGTH:
            raise ValueError('Image is too large. Please use a smaller photo (under ~500KB).')
        if v and not v.startswith('data:image/'):
            raise ValueError('Avatar must be an image data URI.')
        return v


class SessionResponse(BaseModel):
    id: uuid.UUID
    created_at: datetime
    expires_at: datetime
    is_current: bool


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
