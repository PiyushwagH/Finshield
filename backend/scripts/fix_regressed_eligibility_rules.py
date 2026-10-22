"""Restore eligibility-rule specificity lost when sync_verified_schemes.py
overwrote all scheme rules during the Antigravity-sourced enrichment pass.

That script enriched schemes with real apply-steps/documents/benefit data
(good), but its eligibility `rules` lists were less specific than what was
there before and introduced confirmed false-positive matches - e.g. a
non-farmer urban salaried employee was shown "eligible" for PM-KISAN
(farmer-only income support), because the occupation/area/state conditions
that used to gate these schemes were dropped.

This adds the missing conditions back as additional AND rules within each
scheme's existing logic_group(s), without touching the good new fields
(documents, apply_steps, benefit_amount_inr, etc.) or removing any rule that
is still correct.

Run from backend/: python scripts/fix_regressed_eligibility_rules.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.scheme import Scheme, SchemeEligibilityRule

# slug -> list of (field, operator, value) rules to add to logic_group 1
MISSING_RULES = {
    "pm-kisan": [("occupation_tags", "in", ["farmer", "agriculture"])],
    "pmfby": [("occupation_tags", "in", ["farmer", "agriculture"])],
    "pmmsy": [("occupation_tags", "in", ["fisheries", "farmer", "agriculture"])],
    "mgnrega": [("area_type", "eq", "rural")],
    "pm-mudra-yojana": [("occupation_tags", "not_in", ["farmer", "agriculture"])],
    "majhi-ladki-bahin-yojana": [("state", "eq", "Maharashtra")],
    "rajarshi-shahu-maharaj-scholarship": [("state", "eq", "Maharashtra")],
    "majhi-kanya-bhagyashree-yojana": [("state", "eq", "Maharashtra")],
}


def main():
    db = SessionLocal()
    try:
        fixed = 0
        for slug, rules_to_add in MISSING_RULES.items():
            scheme = db.query(Scheme).filter(Scheme.slug == slug).first()
            if not scheme:
                print(f"Skipping (not found): {slug}")
                continue

            existing = db.query(SchemeEligibilityRule).filter(
                SchemeEligibilityRule.scheme_id == scheme.id
            ).all()
            existing_fields = {r.field for r in existing}

            added_any = False
            for field, operator, value in rules_to_add:
                if field in existing_fields:
                    print(f"  {slug}: '{field}' rule already present, skipping")
                    continue
                db.add(SchemeEligibilityRule(
                    scheme_id=scheme.id,
                    field=field,
                    operator=operator,
                    value=value,
                    logic_group=1,
                ))
                added_any = True
                print(f"  {slug}: added {field} {operator} {value}")

            if added_any:
                fixed += 1

        db.commit()
        print(f"\nDone. Restored missing eligibility conditions on {fixed} schemes.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
