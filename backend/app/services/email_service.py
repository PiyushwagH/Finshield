import logging
import smtplib
from email.message import EmailMessage
from email.utils import formataddr

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"
SUBJECT = "Reset your FinShield password"


def _plain_body(reset_link: str) -> str:
    return (
        "We received a request to reset your FinShield password.\n\n"
        f"Choose a new password here (link expires in 30 minutes):\n{reset_link}\n\n"
        "If you didn't request this, you can safely ignore this email - "
        "your password won't change.\n\n- FinShield"
    )


def _html_body(reset_link: str) -> str:
    return f"""\
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F7F9FC;font-family:Inter,Arial,sans-serif;color:#1A2332;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F9FC;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:12px;border:1px solid #E2E8F0;">
          <tr><td style="background:#0F2A47;border-radius:12px 12px 0 0;padding:20px 28px;">
            <span style="color:#FFFFFF;font-size:20px;font-weight:700;">FinShield</span>
          </td></tr>
          <tr><td style="padding:28px;">
            <h1 style="margin:0 0 12px;font-size:20px;color:#0F2A47;">Reset your password</h1>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#5B6B7F;">
              We received a request to reset the password for your FinShield account.
              Click the button below to choose a new one.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:#0E8F86;">
              <a href="{reset_link}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">Choose a new password</a>
            </td></tr></table>
            <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#5B6B7F;">
              This link expires in <strong>30 minutes</strong> and can only be used once.
              If the button doesn't work, paste this into your browser:<br>
              <a href="{reset_link}" style="color:#0E8F86;word-break:break-all;">{reset_link}</a>
            </p>
            <hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0;">
            <p style="margin:0;font-size:12px;color:#5B6B7F;">
              Didn't request this? You can safely ignore this email - your password won't change.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>"""


def _send_via_smtp(to_email: str, reset_link: str) -> None:
    msg = EmailMessage()
    msg["Subject"] = SUBJECT
    msg["From"] = formataddr(("FinShield", settings.SMTP_FROM or settings.SMTP_USER))
    msg["To"] = to_email
    msg.set_content(_plain_body(reset_link))
    msg.add_alternative(_html_body(reset_link), subtype="html")

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)


def _send_via_resend(to_email: str, reset_link: str) -> None:
    response = httpx.post(
        RESEND_API_URL,
        headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
        json={
            "from": settings.EMAIL_FROM,
            "to": [to_email],
            "subject": SUBJECT,
            "html": _html_body(reset_link),
            "text": _plain_body(reset_link),
        },
        timeout=10.0,
    )
    if response.status_code >= 400:
        raise RuntimeError(f"Resend API {response.status_code}: {response.text}")


def send_password_reset_email(to_email: str, reset_link: str) -> None:
    """Email the password-reset link via SMTP (preferred) or Resend, or log it
    if neither is configured.

    Never raises - a failed/unconfigured send must not reveal to the caller
    whether the account exists or whether delivery succeeded, and must not
    block the (deliberately generic) API response.
    """
    smtp_ready = settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD
    try:
        if smtp_ready:
            _send_via_smtp(to_email, reset_link)
            logger.info("Password reset email sent via SMTP to %s", to_email)
        elif settings.RESEND_API_KEY:
            _send_via_resend(to_email, reset_link)
            logger.info("Password reset email sent via Resend to %s", to_email)
        else:
            logger.warning(
                "No email provider configured (set SMTP_* or RESEND_API_KEY); "
                "password reset link for %s: %s", to_email, reset_link,
            )
    except Exception:
        logger.exception("Failed to send password reset email to %s", to_email)
