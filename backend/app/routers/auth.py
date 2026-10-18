import hashlib
import secrets

from fastapi import APIRouter, Depends, HTTPException, status, Request, Response, Cookie
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone

from app.database import get_db
from app.models.user import User, RefreshToken, PasswordResetToken
from app.schemas.auth import (
    UserCreate, UserResponse, Token, LoginResponse,
    ForgotPasswordRequest, ResetPasswordRequest,
)
from app.core.security import get_password_hash, verify_password, create_access_token, create_refresh_token, decode_token
from app.core.deps import get_current_user

from app.core.limiter import limiter
from app.config import settings
from app.services.email_service import send_password_reset_email

PASSWORD_RESET_TOKEN_TTL_MINUTES = 30


def _hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _is_expired(expires_at: datetime) -> bool:
    """Compare against now regardless of whether the DB driver returned a
    naive or tz-aware datetime (Postgres returns tz-aware; SQLite, used in
    tests, returns naive) - normalize both sides to naive UTC.
    """
    if expires_at.tzinfo is not None:
        expires_at = expires_at.astimezone(timezone.utc).replace(tzinfo=None)
    return expires_at < datetime.utcnow()

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=UserResponse)
@limiter.limit("5/minute")
def register(request: Request, user_in: UserCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_in.email).first()
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    
    hashed_password = get_password_hash(user_in.password)
    user = User(
        email=user_in.email,
        password_hash=hashed_password,
        full_name=user_in.full_name,
        role='user'
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def _authenticate(db: Session, email: str, password: str) -> User:
    """Verify credentials and return the user, or raise 401/400.

    The same error is returned for an unknown email and a wrong password so the
    endpoint does not reveal which accounts exist.
    """
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
    return user


def _issue_session(db: Session, response: Response, user: User) -> str:
    """Mint an access token, persist the refresh token and set its cookie."""
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    # Store refresh token in DB
    payload = decode_token(refresh_token)
    expires_at = datetime.fromtimestamp(payload['exp'])

    db_token = RefreshToken(token=refresh_token, user_id=user.id, expires_at=expires_at)
    db.add(db_token)
    db.commit()

    # Set httpOnly cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=7 * 24 * 60 * 60 # 7 days
    )

    return access_token


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
def login(request: Request, response: Response, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Role-agnostic login. Kept as the OAuth2 token endpoint (see deps.oauth2_scheme)."""
    user = _authenticate(db, form_data.username, form_data.password)
    access_token = _issue_session(db, response, user)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login/user", response_model=LoginResponse)
@limiter.limit("10/minute")
def login_user(request: Request, response: Response, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login for the customer-facing portal.

    Accepts any active account, admins included — an admin is also a user and
    can use the regular dashboard.
    """
    user = _authenticate(db, form_data.username, form_data.password)
    access_token = _issue_session(db, response, user)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "user": user,
    }


@router.post("/login/admin", response_model=LoginResponse)
@limiter.limit("10/minute")
def login_admin(request: Request, response: Response, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login for the admin console. Rejects accounts without the admin role.

    Credentials are checked before the role so a non-admin cannot tell a valid
    password from an invalid one on this endpoint.
    """
    user = _authenticate(db, form_data.username, form_data.password)
    if user.role != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account does not have administrator access",
        )
    access_token = _issue_session(db, response, user)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "user": user,
    }

@router.post("/refresh", response_model=Token)
def refresh(response: Response, refresh_token: str = Cookie(None), db: Session = Depends(get_db)):
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token missing")

    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
        
    db_token = db.query(RefreshToken).filter(RefreshToken.token == refresh_token).first()
    if not db_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    if db_token.revoked:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token has been revoked")
    
    # Revoke old token
    db_token.revoked = True
    db.commit()
    
    # Issue new tokens
    user_id = db_token.user_id
    new_access_token = create_access_token(data={"sub": str(user_id)})
    new_refresh_token = create_refresh_token(data={"sub": str(user_id)})
    
    new_payload = decode_token(new_refresh_token)
    expires_at = datetime.fromtimestamp(new_payload['exp'])
    
    new_db_token = RefreshToken(token=new_refresh_token, user_id=user_id, expires_at=expires_at)
    db.add(new_db_token)
    db.commit()
    
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=7 * 24 * 60 * 60
    )
    
    return {"access_token": new_access_token, "token_type": "bearer"}

@router.post("/logout")
def logout(response: Response, refresh_token: str = Cookie(None), db: Session = Depends(get_db)):
    if refresh_token:
        db_token = db.query(RefreshToken).filter(RefreshToken.token == refresh_token).first()
        if db_token and not db_token.revoked:
            db_token.revoked = True
            db.commit()
    
    response.delete_cookie("refresh_token", secure=settings.COOKIE_SECURE, samesite=settings.COOKIE_SAMESITE)
    return {"message": "Successfully logged out"}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/forgot-password")
@limiter.limit("5/minute")
def forgot_password(request: Request, body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Always returns the same generic message, whether or not the email
    belongs to an account, so this endpoint can't be used to enumerate users.
    """
    generic_response = {"message": "If an account exists for that email, a reset link has been sent."}

    user = db.query(User).filter(User.email == body.email).first()
    if not user or not user.is_active:
        return generic_response

    raw_token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(minutes=PASSWORD_RESET_TOKEN_TTL_MINUTES)
    db.add(PasswordResetToken(
        user_id=user.id,
        token_hash=_hash_reset_token(raw_token),
        expires_at=expires_at,
    ))
    db.commit()

    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={raw_token}"
    send_password_reset_email(user.email, reset_link)

    return generic_response


@router.post("/reset-password")
@limiter.limit("5/minute")
def reset_password(request: Request, body: ResetPasswordRequest, db: Session = Depends(get_db)):
    token_hash = _hash_reset_token(body.token)
    reset_token = db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == token_hash).first()

    if not reset_token or reset_token.used or _is_expired(reset_token.expires_at):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset link")

    user = db.query(User).filter(User.id == reset_token.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset link")

    user.password_hash = get_password_hash(body.new_password)
    reset_token.used = True

    # A password reset invalidates every existing session, not just this device.
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id, RefreshToken.revoked == False).update(
        {"revoked": True}
    )
    db.commit()

    return {"message": "Password has been reset"}

from app.core.deps import require_admin
@router.get("/admin-only")
def admin_only_route(current_user: User = Depends(require_admin)):
    return {"message": "Welcome, admin!"}
