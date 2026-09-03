import logging
from sqlalchemy.orm import Session
from app.models.audit import AuditLog
from app.models.user import User

logger = logging.getLogger(__name__)

def log_audit_action(
    db: Session,
    actor: User,
    action: str,
    entity_type: str,
    entity_id: str,
    changes: dict = None,
    ip_address: str = None
):
    try:
        log_entry = AuditLog(
            actor_id=actor.id if actor else None,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id),
            changes=changes,
            ip_address=ip_address
        )
        db.add(log_entry)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to write audit log: {e}")
        db.rollback()
