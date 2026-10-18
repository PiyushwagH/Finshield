"""Batch 3: Maharashtra state welfare schemes, individually researched.

Each entry was verified against multiple independent sources during this
session; schemes with conflicting or stale eligibility data (Shiv Bhojan
Thali Yojana, Mahatma Jyotiba Phule Jan Arogya Yojana - since merged into
Ayushman Bharat, the 2019 farmer loan waiver - since superseded) were left
out rather than guessed.

Run from backend/: python scripts/add_scheme_batch_3_maharashtra.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.scheme import Scheme, SchemeEligibilityRule

SCHEMES = [
    {
        "name": "Mukhyamantri Majhi Ladki Bahin Yojana",
        "slug": "majhi-ladki-bahin-yojana",
        "short_description": "₹1,500/month direct cash transfer for eligible Maharashtra women aged 21-65.",
        "full_description": (
            "A Maharashtra state scheme providing a monthly direct benefit transfer of ₹1,500 to "
            "eligible women residents aged 21-65, including married, widowed, divorced, abandoned, "
            "and destitute women, plus one unmarried woman per family. Requires an Aadhaar-linked "
            "bank account and a family annual income under ₹2.5 lakh. Families with a member who is "
            "an income-tax payer or a permanent government employee/pensioner are excluded."
        ),
        "ministry": "Women and Child Development Department, Government of Maharashtra",
        "category": None,
        "level": "state",
        "state": "Maharashtra",
        "benefit_type": "cash",
        "benefit_amount": 1500,
        "benefit_description": "₹1,500 per month via Direct Benefit Transfer (DBT).",
        "official_url": "https://ladakibahin.maharashtra.gov.in/",
        "application_mode": "Apply online via the official portal or at Anganwadi centres/Setu/CSC.",
        "required_documents": ["Aadhaar Card", "Maharashtra Domicile Proof", "Aadhaar-linked Bank Account", "Income Certificate"],
        "status": "needs_review",
        "source_url": "https://ladakibahin.maharashtra.gov.in/",
        "rules": [
            {"field": "gender", "operator": "eq", "value": "female", "logic_group": 1},
            {"field": "age", "operator": "between", "value": [21, 65], "logic_group": 1},
            {"field": "state", "operator": "eq", "value": "Maharashtra", "logic_group": 1},
            {"field": "annual_income", "operator": "lte", "value": 250000, "logic_group": 1},
        ],
    },
    {
        "name": "Rajarshi Chhatrapati Shahu Maharaj Shikshan Shulk Shishyavrutti Yojana",
        "slug": "rajarshi-shahu-maharaj-scholarship",
        "short_description": "Tuition and exam fee waiver for Maharashtra students from families earning up to ₹8 lakh/year.",
        "full_description": (
            "A Maharashtra state fee-waiver/scholarship scheme for students admitted via CAP to "
            "government, government-aided, or eligible unaided non-minority colleges in the state, "
            "from families with annual income up to ₹8 lakh. The share of tuition/exam fees covered "
            "scales down as income rises within that band. Maharashtra domicile is required, and "
            "students must maintain minimum attendance to continue receiving the benefit each year."
        ),
        "ministry": "Directorate of Technical Education / Higher Education, Government of Maharashtra",
        "category": "education",
        "level": "state",
        "state": "Maharashtra",
        "benefit_type": "subsidy",
        "benefit_description": "Partial to full tuition and exam fee waiver, scaled by family income band.",
        "official_url": "https://mahadbtmahait.gov.in/",
        "application_mode": "Apply online via the MahaDBT portal.",
        "required_documents": ["Maharashtra Domicile Certificate", "Income Certificate", "CAP Admission Proof"],
        "status": "needs_review",
        "source_url": "https://mahadbtmahait.gov.in/",
        "rules": [
            {"field": "employment_status", "operator": "eq", "value": "student", "logic_group": 1},
            {"field": "state", "operator": "eq", "value": "Maharashtra", "logic_group": 1},
            {"field": "annual_income", "operator": "lte", "value": 800000, "logic_group": 1},
        ],
    },
    {
        "name": "Majhi Kanya Bhagyashree Yojana",
        "slug": "majhi-kanya-bhagyashree-yojana",
        "short_description": "Fixed-deposit savings scheme for Maharashtra families with one or two daughters, income up to ₹7.5 lakh.",
        "full_description": (
            "A Maharashtra state scheme for families with one or two daughters (born after 1 August "
            "2017) and an annual family income up to ₹7.5 lakh. A fixed deposit of ₹50,000 is made for "
            "a single girl child, or ₹25,000 each for two girls, withdrawable with accrued interest at "
            "specified milestones. Administered by the Women and Child Development Department; "
            "applications are typically made offline via the local Anganwadi worker."
        ),
        "ministry": "Women and Child Development Department, Government of Maharashtra",
        "category": None,
        "level": "state",
        "state": "Maharashtra",
        "benefit_type": "subsidy",
        "benefit_amount": 50000,
        "benefit_description": "Fixed deposit of ₹50,000 (one daughter) or ₹25,000 each (two daughters), withdrawable with interest.",
        "official_url": "https://womenchild.maharashtra.gov.in/",
        "application_mode": "Apply offline through your local Anganwadi worker / Women and Child Development office.",
        "required_documents": ["Birth Certificate", "Income Certificate", "Maharashtra Domicile Proof", "Family Planning Certificate"],
        "status": "needs_review",
        "source_url": "https://en.vikaspedia.in/viewcontent/social-welfare/my-daughter-bhagyashree-scheme",
        "rules": [
            {"field": "state", "operator": "eq", "value": "Maharashtra", "logic_group": 1},
            {"field": "dependents", "operator": "gte", "value": 1, "logic_group": 1},
            {"field": "annual_income", "operator": "lte", "value": 750000, "logic_group": 1},
        ],
    },
]


def main():
    db = SessionLocal()
    try:
        added = 0
        for s in SCHEMES:
            existing = db.query(Scheme).filter(Scheme.slug == s["slug"]).first()
            if existing:
                print(f"Skipping (already exists): {s['name']}")
                continue

            rules_data = s.pop("rules")
            scheme = Scheme(**s)
            db.add(scheme)
            db.flush()

            for r in rules_data:
                db.add(SchemeEligibilityRule(scheme_id=scheme.id, **r))

            print(f"Added: {s['name']} (needs_review)")
            added += 1

        db.commit()
        print(f"\nDone. {added} new schemes added as needs_review.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
