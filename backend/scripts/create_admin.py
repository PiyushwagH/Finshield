import sys
import argparse
from pathlib import Path
import logging

# Setup paths for importing app modules
base_dir = Path(__file__).resolve().parent.parent
sys.path.append(str(base_dir))

from app.database import SessionLocal
from app.models.user import User

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def promote_to_admin(email: str):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            logger.error(f"User with email '{email}' not found.")
            sys.exit(1)
            
        if user.role == 'admin':
            logger.info(f"User '{email}' is already an admin.")
            return

        user.role = 'admin'
        db.commit()
        logger.info(f"Successfully promoted '{email}' to admin.")
    except Exception as e:
        logger.error(f"An error occurred: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Promote an existing user to the admin role.")
    parser.add_argument("email", type=str, help="The email address of the user to promote.")
    args = parser.parse_args()
    
    promote_to_admin(args.email)
