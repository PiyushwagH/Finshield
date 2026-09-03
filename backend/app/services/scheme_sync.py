import json
from typing import Protocol, List
from sqlalchemy.orm import Session
from app.models.scheme import Scheme, SchemeEligibilityRule
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

class SchemeSource(Protocol):
    def fetch_schemes(self) -> List[dict]:
        ...

class JSONSchemeSource:
    def __init__(self, file_path: str):
        self.file_path = file_path

    def fetch_schemes(self) -> List[dict]:
        path = Path(self.file_path)
        if not path.exists():
            logger.error(f"Scheme seed file not found: {self.file_path}")
            return []
        with open(path, 'r') as f:
            return json.load(f)

def sync_schemes(db: Session, source: SchemeSource):
    raw_schemes = source.fetch_schemes()
    count = 0
    for raw in raw_schemes:
        # Update or insert scheme
        scheme = db.query(Scheme).filter(Scheme.slug == raw['slug']).first()
        if not scheme:
            scheme = Scheme(slug=raw['slug'])
            db.add(scheme)
        
        scheme.name = raw.get('name')
        scheme.short_description = raw.get('short_description')
        scheme.full_description = raw.get('full_description')
        scheme.ministry = raw.get('ministry')
        scheme.category = raw.get('category')
        scheme.level = raw.get('level')
        scheme.state = raw.get('state')
        scheme.benefit_type = raw.get('benefit_type')
        scheme.benefit_amount = raw.get('benefit_amount')
        scheme.benefit_description = raw.get('benefit_description')
        scheme.official_url = raw.get('official_url')
        scheme.required_documents = raw.get('required_documents', [])
        scheme.status = raw.get('status', 'active')

        db.commit()
        db.refresh(scheme)
        count += 1

        # Replace rules
        db.query(SchemeEligibilityRule).filter(SchemeEligibilityRule.scheme_id == scheme.id).delete()
        
        rules = raw.get('rules', [])
        for r in rules:
            rule = SchemeEligibilityRule(
                scheme_id=scheme.id,
                field=r['field'],
                operator=r['operator'],
                value=r['value'],
                logic_group=r.get('logic_group', 1)
            )
            db.add(rule)
        
        db.commit()

    logger.info(f"Synced {count} schemes successfully.")
