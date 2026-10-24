from pathlib import Path

from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Refresh-token cookie attributes. Defaults are correct for local dev,
    # where frontend and backend are both on localhost (same-site, so Lax
    # cookies are sent on axios's cross-origin-but-same-site calls). In
    # production the frontend (Vercel) and backend (Render) are on different
    # registrable domains - genuinely cross-site - so a Lax cookie is never
    # attached to the axios refresh call at all, and every session silently
    # loses its refresh token as soon as the 15-minute access token expires.
    # Set COOKIE_SAMESITE=none and COOKIE_SECURE=true in the production
    # environment (SameSite=None requires Secure, and Render/Vercel are both
    # HTTPS, so this is safe there).
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"

    # Password-reset email. If RESEND_API_KEY is unset (local dev), the reset
    # link is logged instead of emailed - see app/services/email_service.py.
    RESEND_API_KEY: str = ""
    # SMTP takes precedence over Resend when all three of host/user/password
    # are set. Gmail: SMTP_HOST=smtp.gmail.com, SMTP_USER=<gmail address>,
    # SMTP_PASSWORD=<16-char App Password, not your Gmail password>.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    EMAIL_FROM: str = "FinShield <onboarding@resend.dev>"
    FRONTEND_URL: str = "http://localhost:5173"

    class Config:
        # Resolved relative to this file so the app loads the same backend/.env
        # regardless of the directory uvicorn/alembic/pytest is launched from.
        env_file = str(Path(__file__).resolve().parent.parent / ".env")

settings = Settings()
