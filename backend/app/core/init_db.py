import os
import logging
from email_validator import EmailNotValidError, validate_email
from app.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash

logger = logging.getLogger(__name__)

def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL")
    admin_password = os.environ.get("ADMIN_PASSWORD")
    
    if not admin_email or not admin_password:
        logger.info("ADMIN_EMAIL or ADMIN_PASSWORD not set. Skipping admin seeding.")
        return

    # UserResponse serializes email as EmailStr, which rejects reserved TLDs
    # (.local, .test, .example). Seeding such an address would create an admin
    # that cannot log in, because every auth response would fail validation.
    try:
        validate_email(admin_email, check_deliverability=False)
    except EmailNotValidError as e:
        logger.error(
            f"ADMIN_EMAIL '{admin_email}' is not a usable address ({e}). "
            "Skipping admin seeding - use a real domain, not a reserved TLD."
        )
        return

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == admin_email).first()
        if not user:
            logger.info(f"Seeding admin user: {admin_email}")
            user = User(
                email=admin_email,
                full_name="System Administrator",
                password_hash=get_password_hash(admin_password),
                role="admin",
                is_verified=True,
                is_active=True
            )
            db.add(user)
            db.commit()
        else:
            if user.role != 'admin':
                logger.info(f"Promoting {admin_email} to admin role.")
                user.role = 'admin'
                db.commit()
    except Exception as e:
        logger.error(f"Failed to seed admin: {e}")
        db.rollback()
    finally:
        db.close()
