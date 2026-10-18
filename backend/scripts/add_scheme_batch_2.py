"""Batch 2 of real, individually-researched welfare schemes.

Each entry was verified against multiple independent sources during this
session (see the chat for citations); where sources conflicted or a
scheme's current validity was unclear, it was left out rather than guessed.
Added as status='needs_review' first, consistent with the project's
data-governance workflow - run publish_reviewed_schemes.py after a final
look to make them live.

Run from backend/: python scripts/add_scheme_batch_2.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.scheme import Scheme, SchemeEligibilityRule

SCHEMES = [
    {
        "name": "Mahatma Gandhi National Rural Employment Guarantee Act (MGNREGA)",
        "slug": "mgnrega",
        "short_description": "Guarantees 100 days of wage employment per year to rural households willing to do unskilled manual work.",
        "full_description": (
            "A legal right to work: every rural household whose adult members volunteer to do "
            "unskilled manual work is guaranteed at least 100 days of wage employment per financial "
            "year. Work must be provided within 5 km of the applicant's residence at minimum wage; "
            "an unemployment allowance is payable if work isn't provided within 15 days of a request."
        ),
        "ministry": "Ministry of Rural Development",
        "category": "business",
        "level": "central",
        "benefit_type": "other",
        "benefit_description": "Up to 100 days of guaranteed wage employment per household per year, at the notified minimum wage.",
        "official_url": "https://nrega.nic.in/",
        "application_mode": "Register for a Job Card at the local Gram Panchayat.",
        "required_documents": ["Aadhaar Card", "Address Proof", "Passport-size Photographs"],
        "status": "needs_review",
        "source_url": "https://nrega.nic.in/",
        "rules": [
            {"field": "area_type", "operator": "eq", "value": "rural", "logic_group": 1},
            {"field": "age", "operator": "gte", "value": 18, "logic_group": 1},
        ],
    },
    {
        "name": "Pradhan Mantri Shram Yogi Maandhan (PM-SYM)",
        "slug": "pm-shram-yogi-maandhan",
        "short_description": "Voluntary pension scheme for unorganised-sector workers earning up to ₹15,000/month.",
        "full_description": (
            "A voluntary, contributory pension scheme for unorganised-sector workers (street vendors, "
            "rickshaw pullers, construction workers, domestic workers, etc.) aged 18-40 earning up to "
            "₹15,000 a month, who are not covered by EPF/NPS/ESIC and are not income-tax payers. "
            "Monthly contributions (₹55-₹200, based on entry age) are matched equally by the government; "
            "subscribers receive a minimum assured pension of ₹3,000/month after turning 60."
        ),
        "ministry": "Ministry of Labour and Employment",
        "category": "business",
        "level": "central",
        "benefit_type": "insurance",
        "benefit_amount": 3000,
        "benefit_description": "Minimum assured monthly pension of ₹3,000 after age 60, with government-matched contributions.",
        "official_url": "https://maandhan.in/",
        "application_mode": "Enroll via Common Service Centres (CSC) or the Maandhan portal.",
        "required_documents": ["Aadhaar Card", "Savings Bank Account / Jan Dhan Account"],
        "status": "needs_review",
        "source_url": "https://maandhan.in/",
        "rules": [
            {"field": "age", "operator": "between", "value": [18, 40], "logic_group": 1},
            {"field": "annual_income", "operator": "lte", "value": 180000, "logic_group": 1},
        ],
    },
    {
        "name": "Pradhan Mantri Kaushal Vikas Yojana (PMKVY)",
        "slug": "pmkvy",
        "short_description": "Free, government-certified skill training for youth aged 15-45, mainly unemployed or school/college dropouts.",
        "full_description": (
            "India's flagship skill-development scheme, now in its 4th phase. Offers free short-term "
            "training and certification in industry-relevant job roles to Indian nationals aged 15-45, "
            "with a focus on unemployed youth and school/college dropouts. Requires an Aadhaar card and "
            "an Aadhaar-linked bank account."
        ),
        "ministry": "Ministry of Skill Development and Entrepreneurship",
        "category": "education",
        "level": "central",
        "benefit_type": "other",
        "benefit_description": "Free skill training, certification, and a placement-assistance pathway.",
        "official_url": "https://www.skillindia.gov.in/",
        "application_mode": "Register at a PMKVY training centre or via the Skill India portal.",
        "required_documents": ["Aadhaar Card", "Aadhaar-linked Bank Account"],
        "status": "needs_review",
        "source_url": "https://www.skillindia.gov.in/",
        "rules": [
            {"field": "age", "operator": "between", "value": [15, 45], "logic_group": 1},
        ],
    },
    {
        "name": "Pradhan Mantri Matsya Sampada Yojana (PMMSY)",
        "slug": "pmmsy",
        "short_description": "Support for fishers, fish farmers, and fisheries entrepreneurs to boost income and infrastructure.",
        "full_description": (
            "A flagship scheme for the fisheries sector covering fishers, fish farmers, fish vendors, "
            "fisheries cooperatives, and entrepreneurs in fish processing and aquaculture. Provides "
            "financial support for infrastructure, boats and gear, and livelihood development; "
            "applications are evaluated by state fisheries departments, so exact criteria vary by state."
        ),
        "ministry": "Department of Fisheries, Ministry of Fisheries, Animal Husbandry and Dairying",
        "category": "agriculture",
        "level": "central",
        "benefit_type": "subsidy",
        "benefit_description": "Financial assistance for fisheries infrastructure, equipment, and livelihood support; amount varies by component and state.",
        "official_url": "https://pmmsy.dof.gov.in/",
        "application_mode": "Apply through your State Fisheries Department.",
        "required_documents": ["Aadhaar Card", "Bank Account Details", "Project Proposal"],
        "status": "needs_review",
        "source_url": "https://pmmsy.dof.gov.in/",
        "rules": [
            {"field": "occupation_tags", "operator": "in", "value": ["fisheries", "farmer", "agriculture"], "logic_group": 1},
        ],
    },
    {
        "name": "Startup India",
        "slug": "startup-india",
        "short_description": "DPIIT recognition and tax/compliance benefits for eligible Indian startups and entrepreneurs.",
        "full_description": (
            "Recognizes eligible private limited companies, LLPs, registered partnership firms, and "
            "cooperative societies as 'startups' via DPIIT, unlocking tax exemptions, easier compliance, "
            "and funding access. Eligibility is entity-level: generally under 10 years since incorporation "
            "(20 years for deep-tech) with turnover under a notified cap, and the business must be working "
            "towards innovation or a scalable model. This profile-level match reflects the typical applicant "
            "(a business owner or self-employed entrepreneur); the full entity-level criteria are assessed "
            "at the time of DPIIT application."
        ),
        "ministry": "Department for Promotion of Industry and Internal Trade (DPIIT)",
        "category": "business",
        "level": "central",
        "benefit_type": "other",
        "benefit_description": "Tax exemptions, self-certification compliance, IPR fast-tracking, and funding access via DPIIT recognition.",
        "official_url": "https://www.startupindia.gov.in/",
        "application_mode": "Apply for DPIIT recognition online via the Startup India portal.",
        "required_documents": ["Certificate of Incorporation", "PAN", "Business Description / Pitch"],
        "status": "needs_review",
        "source_url": "https://www.startupindia.gov.in/",
        "rules": [
            {"field": "employment_status", "operator": "in", "value": ["business_owner", "self_employed"], "logic_group": 1},
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
            db.flush()  # get scheme.id before inserting rules

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
