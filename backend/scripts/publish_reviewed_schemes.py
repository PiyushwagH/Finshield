"""One-off: promote sourced-and-reviewed schemes from needs_review to active.

Run from backend/: python scripts/publish_reviewed_schemes.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.scheme import Scheme
from app.models.audit import AuditLog


def main():
    db = SessionLocal()
    try:
        schemes = db.query(Scheme).filter(Scheme.status == "needs_review").all()
        if not schemes:
            print("No schemes in needs_review. Nothing to do.")
            return

        for scheme in schemes:
            scheme.status = "active"
            db.add(AuditLog(
                actor_id=None,
                action="PUBLISH_SCHEME",
                entity_type="scheme",
                entity_id=str(scheme.id),
                changes={"status": {"from": "needs_review", "to": "active"}, "via": "publish_reviewed_schemes.py"},
            ))
            print(f"Published: {scheme.name} ({scheme.slug})")

        db.commit()
        print(f"\nDone. {len(schemes)} schemes now active.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
