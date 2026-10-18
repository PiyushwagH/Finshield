import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


def send_password_reset_email(to_email: str, reset_link: str) -> None:
    """Send the password-reset link by email, or log it if no provider is configured.

    Never raises - a failed/unconfigured email send must not reveal to the
    caller whether the account exists or whether delivery succeeded, and
    must not block the (deliberately generic) API response.
    """
    if not settings.RESEND_API_KEY:
        logger.warning(
            "RESEND_API_KEY not set; password reset link for %s: %s",
            to_email, reset_link,
        )
        return

    html = (
        "<p>We received a request to reset your FinShield password.</p>"
        f'<p><a href="{reset_link}">Click here to choose a new password</a>. '
        "This link expires in 30 minutes.</p>"
        "<p>If you didn't request this, you can safely ignore this email.</p>"
    )

    try:
        response = httpx.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
            json={
                "from": settings.EMAIL_FROM,
                "to": [to_email],
                "subject": "Reset your FinShield password",
                "html": html,
            },
            timeout=10.0,
        )
        if response.status_code >= 400:
            logger.error(
                "Resend API error sending password reset to %s: %s %s",
                to_email, response.status_code, response.text,
            )
    except httpx.HTTPError:
        logger.exception("Failed to send password reset email to %s", to_email)
