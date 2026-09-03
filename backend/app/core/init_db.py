import os
import logging
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
