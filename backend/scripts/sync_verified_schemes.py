"""Sync all 27 verified welfare schemes with complete official attributes,
benefit amounts, driver tags, documents, apply steps, and verification dates.

Run from backend/: python scripts/sync_verified_schemes.py
"""
import sys
import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.scheme import Scheme, SchemeEligibilityRule

VERIFIED_SCHEMES = [
    {
        "name": "Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)",
        "slug": "pm-kisan",
        "short_description": "₹6,000 annual direct income support for landholding farmer families across India.",
        "full_description": "A central sector scheme with 100% funding from Government of India providing income support of ₹6,000 per year in three equal instalments of ₹2,000 directly into the bank accounts of farmer families having cultivable land.",
        "ministry": "Ministry of Agriculture and Farmers Welfare",
        "category": "agriculture",
        "level": "central",
        "benefit_type": "cash",
        "benefit_amount": 6000,
        "benefit_amount_inr": 6000,
        "benefit_period": "yearly",
        "driver_tags": ["income", "emi_burden"],
        "documents": [
            "Aadhaar Card",
            "Land ownership record / Khatauni",
            "Aadhaar-linked Bank Account Passbook",
            "Citizenship proof"
        ],
        "apply_steps": [
            "Visit the official portal at pmkisan.gov.in",
            "Click on 'New Farmer Registration' under Farmers Corner",
            "Enter your Aadhaar number and captcha for authentication",
            "Select your State, District, Sub-District, Block and Village",
            "Enter land details (Survey/Khata number) and bank account details",
            "Submit the registration and save the reference number for tracking"
        ],
        "official_url": "https://pmkisan.gov.in/",
        "status": "active",
        "last_verified_at": datetime(2026, 10, 20, 0, 0, 0, tzinfo=timezone.utc),
        "rules": [
            {"field": "employment_status", "operator": "in", "value": ["self_employed", "unemployed", "salaried_private"], "logic_group": 1},
            {"field": "owns_property", "operator": "eq", "value": True, "logic_group": 1}
        ]
    },
    {
        "name": "Pradhan Mantri Awas Yojana (PMAY - Urban)",
        "slug": "pmay-urban",
        "short_description": "Up to ₹2.67 Lakh interest subsidy on home loans for eligible urban homebuyers.",
        "full_description": "Credit Linked Subsidy Scheme (CLSS) under PMAY-U provides an upfront interest subsidy of up to ₹2.67 Lakh for EWS, LIG, and MIG categories acquiring or constructing their first pucca house.",
        "ministry": "Ministry of Housing and Urban Affairs",
        "category": "business",
        "level": "central",
        "benefit_type": "loan_subsidy",
        "benefit_amount": 267000,
        "benefit_amount_inr": 267000,
        "benefit_period": "one_time",
        "driver_tags": ["emi_burden", "savings"],
        "documents": [
            "Aadhaar Card of all family members",
            "Salary Slips or Income Certificate",
            "Bank statement for past 6 months",
            "Affidavit stating beneficiary does not own a pucca house in India",
            "Property purchase or construction agreement"
        ],
        "apply_steps": [
            "Visit the official portal at pmaymis.gov.in or apply through your home loan lender",
            "Select Citizen Assessment -> Apply Online -> Benefit under 3 components",
            "Enter your Aadhaar number for authentication",
            "Fill in family demographics, annual income, and property details",
            "Submit application; your lending bank/HFC processes CLSS subsidy claim with CNA"
        ],
        "official_url": "https://pmaymis.gov.in/",
        "status": "active",
        "last_verified_at": datetime(2026, 10, 20, 0, 0, 0, tzinfo=timezone.utc),
        "rules": [
            {"field": "annual_income", "operator": "lte", "value": 1800000, "logic_group": 1},
            {"field": "owns_property", "operator": "eq", "value": False, "logic_group": 1}
        ]
    },
    {
        "name": "Sukanya Samriddhi Yojana (SSY)",
        "slug": "sukanya-samriddhi",
        "short_description": "Government-backed savings scheme for girl child with 8.2% sovereign tax-free interest.",
        "full_description": "A small-deposit scheme launched under the Beti Bachao Beti Padhao campaign for girl children under 10 years of age, offering high guaranteed sovereign interest and Section 80C tax deduction.",
        "ministry": "Ministry of Finance",
        "category": None,
        "level": "central",
        "benefit_type": "savings_return",
        "benefit_amount": None,
        "benefit_amount_inr": None,
        "benefit_period": "yearly",
        "driver_tags": ["savings", "dependents"],
        "documents": [
            "Birth certificate of the girl child",
            "Aadhaar Card of parent or legal guardian",
            "PAN Card of guardian",
            "Address proof (utility bill, passport, voter ID)",
            "Passport-size photographs of child and guardian"
        ],
        "apply_steps": [
            "Visit your nearest Post Office or authorized commercial bank branch",
            "Obtain and complete the SSY Account Opening Form (Form SSA-1)",
            "Attach child's birth certificate and guardian KYC documents",
            "Deposit the minimum opening amount (minimum ₹250, up to ₹1.5 Lakh/year)",
            "Receive the physical SSY passbook for record and future deposits"
        ],
        "official_url": "https://www.indiapost.gov.in/",
        "status": "active",
        "last_verified_at": datetime(2026, 10, 20, 0, 0, 0, tzinfo=timezone.utc),
        "rules": [
            {"field": "dependents", "operator": "gte", "value": 1, "logic_group": 1}
        ]
    },
    {
        "name": "Atal Pension Yojana (APY)",
        "slug": "atal-pension-yojana",
        "short_description": "Guaranteed monthly pension of ₹1,000 to ₹5,000 for unorganized sector workers post age 60.",
        "full_description": "A government-backed pension scheme aimed at unorganized workers aged 18-40. Subscribers receive an assured monthly pension between ₹1,000 and ₹5,000 upon reaching age 60, backed by sovereign guarantee.",
        "ministry": "Ministry of Finance",
        "category": None,
        "level": "central",
        "benefit_type": "insurance",
        "benefit_amount": 12000,
        "benefit_amount_inr": 12000,
        "benefit_period": "yearly",
        "driver_tags": ["savings", "income"],
        "documents": [
            "Aadhaar Card",
            "Savings Bank Account / Post Office Account details",
            "Mobile number registered with bank"
        ],
        "apply_steps": [
            "Visit the bank branch where you maintain your primary savings account or log into net banking",
            "Fill out the APY registration form specifying your desired pension slab (₹1,000 - ₹5,000)",
            "Provide nominee details and authorize automatic monthly debit for contributions",
            "Receive your Permanent Retirement Account Number (PRAN) confirmation via SMS"
        ],
        "official_url": "https://www.npscra.nsdl.co.in/",
        "status": "active",
        "last_verified_at": datetime(2026, 10, 20, 0, 0, 0, tzinfo=timezone.utc),
        "rules": [
            {"field": "age", "operator": "between", "value": [18, 40], "logic_group": 1}
        ]
    },
    {
        "name": "Pradhan Mantri Mudra Yojana (PMMY)",
        "slug": "pm-mudra-yojana",
        "short_description": "Collateral-free business loans up to ₹10 Lakh for micro and small enterprises.",
        "full_description": "Provides collateral-free loans across three categories: Shishu (up to ₹50,000), Kishor (₹50,000 to ₹5 Lakh), and Tarun (₹5 Lakh to ₹10 Lakh) to non-corporate, non-farm small and micro enterprises.",
        "ministry": "Ministry of Finance",
        "category": "business",
        "level": "central",
        "benefit_type": "loan_subsidy",
        "benefit_amount": 500000,
        "benefit_amount_inr": 500000,
        "benefit_period": "one_time",
        "driver_tags": ["emi_burden", "employment_stability", "income"],
        "documents": [
            "Aadhaar Card / Voter ID / Passport",
            "Business registration certificate or Udyam Registration",
            "Bank account statements for the past 6 months",
            "Quotations for machinery/tools or working capital estimation report"
        ],
        "apply_steps": [
            "Visit udyamimitra.in or walk into any public/private commercial bank or NBFC",
            "Fill the standard Mudra loan application form corresponding to your tier (Shishu/Kishor/Tarun)",
            "Submit identity, business address proof, and equipment/stock quotations",
            "The lending institution evaluates and sanctions the collateral-free loan facility"
        ],
        "official_url": "https://www.mudra.org.in/",
        "status": "active",
        "last_verified_at": datetime(2026, 10, 20, 0, 0, 0, tzinfo=timezone.utc),
        "rules": [
            {"field": "employment_status", "operator": "in", "value": ["self_employed", "business_owner"], "logic_group": 1}
        ]
    },
    {
        "name": "National Scholarship Portal (NSP) - Post Matric",
        "slug": "nsp-post-matric",
        "short_description": "Financial assistance covering tuition and living allowances for post-matric students.",
        "full_description": "Centrally sponsored scholarship scheme providing tuition reimbursement and maintenance allowance to students from SC, ST, and minority communities studying in Class 11 through doctoral degrees.",
        "ministry": "Ministry of Social Justice and Empowerment",
        "category": "education",
        "level": "central",
        "benefit_type": "cash",
        "benefit_amount": 13500,
        "benefit_amount_inr": 13500,
        "benefit_period": "yearly",
        "driver_tags": ["income", "education"],
        "documents": [
            "Aadhaar Card",
            "Caste Certificate issued by competent revenue authority",
            "Income Certificate (family annual income up to ₹2.5 Lakh)",
            "Previous qualifying exam marksheet",
            "Fee receipt / Student ID proof from recognized institution"
        ],
        "apply_steps": [
            "Register on scholarships.gov.in using your Aadhaar or enrolment ID",
            "Select Post-Matric Scholarship Scheme and complete the application profile",
            "Upload scanned copies of caste, income certificate, and marksheets",
            "Your educational institution verifies the application online",
            "State department validates and disburses scholarship via Direct Benefit Transfer"
        ],
        "official_url": "https://scholarships.gov.in/",
        "status": "active",
        "last_verified_at": datetime(2026, 10, 20, 0, 0, 0, tzinfo=timezone.utc),
        "rules": [
            {"field": "employment_status", "operator": "eq", "value": "student", "logic_group": 1},
            {"field": "annual_income", "operator": "lte", "value": 250000, "logic_group": 1}
        ]
    },
    {
        "name": "Ayushman Bharat Pradhan Mantri Jan Arogya Yojana (AB-PMJAY)",
        "slug": "ayushman-bharat",
        "short_description": "Cashless secondary and tertiary health insurance coverage up to ₹5 Lakh per family per year.",
        "full_description": "The world's largest health assurance scheme, providing health cover of ₹5 Lakh per family per year for secondary and tertiary care hospitalization across empanelled public and private hospitals.",
        "ministry": "Ministry of Health and Family Welfare",
        "category": "health",
        "level": "central",
        "benefit_type": "insurance",
        "benefit_amount": 500000,
        "benefit_amount_inr": 500000,
        "benefit_period": "yearly",
        "driver_tags": ["savings", "income", "dependents"],
        "documents": [
            "Aadhaar Card",
            "Ration Card or SECC family identification letter",
            "Active mobile number"
        ],
        "apply_steps": [
            "Check your family's eligibility at beneficiary.nha.gov.in or call toll-free 14555",
            "Visit any empanelled public/private hospital or nearest Common Service Centre (CSC)",
            "Provide your Aadhaar or Ration Card for biometric e-KYC verification",
            "Receive your Ayushman Golden Card for cashless treatment at empanelled facilities"
        ],
        "official_url": "https://pmjay.gov.in/",
        "status": "active",
        "last_verified_at": datetime(2026, 10, 20, 0, 0, 0, tzinfo=timezone.utc),
        "rules": [
            {"field": "annual_income", "operator": "lte", "value": 500000, "logic_group": 1}
        ]
    },
    {
        "name": "Stand-Up India",
        "slug": "stand-up-india",
        "short_description": "Bank loans between ₹10 Lakh and ₹1 Crore for SC/ST and women entrepreneurs for greenfield projects.",
        "full_description": "Facilitates bank loans between ₹10 Lakh and ₹1 Crore to at least one SC/ST borrower and at least one woman borrower per bank branch for setting up a greenfield enterprise in manufacturing, services, or trading.",
        "ministry": "Ministry of Finance",
        "category": "business",
        "level": "central",
        "benefit_type": "loan_subsidy",
        "benefit_amount": 2500000,
        "benefit_amount_inr": 2500000,
        "benefit_period": "one_time",
        "driver_tags": ["emi_burden", "employment_stability", "income"],
        "documents": [
            "Aadhaar Card and PAN Card",
            "Caste Certificate (for SC/ST) or proof of 51% female shareholding",
            "Comprehensive Project Report (DPR) with cashflow projections",
            "Proof of enterprise premises and promoter equity contribution"
        ],
        "apply_steps": [
            "Visit standupmitra.in portal and click 'Register as Entrepreneur'",
            "Complete the business loan application profile and attach your project proposal",
            "Choose a preferred scheduled commercial bank or allow portal routing to local branch",
            "Bank conducts due diligence and sanctions the credit facility"
        ],
        "official_url": "https://www.standupmitra.in/",
        "status": "active",
        "last_verified_at": datetime(2026, 10, 20, 0, 0, 0, tzinfo=timezone.utc),
        "rules": [
            {"field": "employment_status", "operator": "in", "value": ["self_employed", "business_owner"], "logic_group": 1}
        ]
    },
    {
        "name": "Pradhan Mantri Ujjwala Yojana (PMUY)",
        "slug": "pm-ujjwala-yojana",
        "short_description": "Deposit-free LPG cylinder connection plus ₹300 per refill subsidy for low-income women.",
        "full_description": "Empowers women from poor households by providing deposit-free LPG connections, a free stove, and direct targeted subsidies per 14.2 kg domestic refill.",
        "ministry": "Ministry of Petroleum and Natural Gas",
        "category": None,
        "level": "central",
        "benefit_type": "subsidy",
        "benefit_amount": 1600,
        "benefit_amount_inr": 1600,
        "benefit_period": "one_time",
        "driver_tags": ["income", "dependents"],
        "documents": [
            "Aadhaar Card of adult female beneficiary",
            "Ration Card showing family composition",
            "Bank Account Passbook / IFSC code",
            "Self-declaration 14-point poverty affidavit"
        ],
        "apply_steps": [
            "Visit pmuy.gov.in or your nearest authorized Indane/Bharatgas/HP gas distributor",
            "Fill out the Ujjwala 2.0 application form",
            "Submit biometric e-KYC and family ration card verification",
            "Distributor provides deposit-free regulator, cylinder, and gas stove"
        ],
        "official_url": "https://www.pmuy.gov.in/",
        "status": "active",
        "last_verified_at": datetime(2026, 10, 20, 0, 0, 0, tzinfo=timezone.utc),
        "rules": [
            {"field": "gender", "operator": "eq", "value": "female", "logic_group": 1},
            {"field": "annual_income", "operator": "lte", "value": 200000, "logic_group": 1}
        ]
    },
    {
        "name": "Pradhan Mantri Jeevan Jyoti Bima Yojana (PMJJBY)",
        "slug": "pmjjby",
        "short_description": "₹2 Lakh renewable term life insurance for just ₹436 annual premium.",
        "full_description": "A one-year life insurance scheme renewable from year to year offering coverage for death due to any reason. Available to individuals aged 18 to 50 having a bank account.",
        "ministry": "Ministry of Finance",
        "category": "health",
        "level": "central",
        "benefit_type": "insurance",
        "benefit_amount": 200000,
        "benefit_amount_inr": 200000,
        "benefit_period": "yearly",
        "driver_tags": ["savings", "dependents"],
        "documents": [
            "Aadhaar Card",
            "Savings Bank Account with active auto-debit facility",
            "Nominee details"
        ],
        "apply_steps": [
            "Log into your bank's Internet Banking/Mobile App or visit your home branch",
            "Select Government Insurance Schemes -> PMJJBY",
            "Authorize an annual auto-debit of ₹436 from your savings account",
            "Certificate of Insurance is generated and sent via SMS and email"
        ],
        "official_url": "https://financialservices.gov.in/beta/en/pmjjby",
        "status": "active",
        "last_verified_at": datetime(2026, 10, 20, 0, 0, 0, tzinfo=timezone.utc),
        "rules": [
            {"field": "age", "operator": "between", "value": [18, 50], "logic_group": 1}
        ]
    },
    {
        "name": "Pradhan Mantri Suraksha Bima Yojana (PMSBY)",
        "slug": "pmsby",
        "short_description": "₹2 Lakh accidental death and disability insurance cover for ₹20 per year.",
        "full_description": "A one-year accidental death and disability cover renewable annually, providing ₹2 Lakh in case of accidental death or permanent total disability, and ₹1 Lakh for permanent partial disability for a nominal ₹20/year premium.",
        "ministry": "Ministry of Finance",
        "category": "health",
        "level": "central",
        "benefit_type": "insurance",
        "benefit_amount": 200000,
        "benefit_amount_inr": 200000,
        "benefit_period": "yearly",
        "driver_tags": ["savings", "dependents"],
        "documents": [
            "Aadhaar Card",
            "Savings Bank Account with active auto-debit facility",
            "Nominee details"
        ],
        "apply_steps": [
            "Log into net banking or visit your savings bank branch",
            "Fill PMSBY enrollment consent form or opt in online",
            "Authorize ₹20 annual premium auto-debit in May each year",
            "Receive coverage acknowledgment and policy reference"
        ],
        "official_url": "https://financialservices.gov.in/beta/en/pmsby",
        "status": "active",
        "last_verified_at": datetime(2026, 10, 20, 0, 0, 0, tzinfo=timezone.utc),
        "rules": [
            {"field": "age", "operator": "between", "value": [18, 70], "logic_group": 1}
        ]
    },
    {
        "name": "Pradhan Mantri Fasal Bima Yojana (PMFBY)",
        "slug": "pmfby",
        "short_description": "Subsidized crop insurance covering yield loss due to non-preventable natural risks.",
        "full_description": "Comprehensive insurance coverage against crop failure from natural disasters, pest infestations, and localized calamities, with farmers paying only 1.5% to 2% subsidized premium.",
        "ministry": "Ministry of Agriculture and Farmers Welfare",
        "category": "agriculture",
        "level": "central",
        "benefit_type": "insurance",
        "benefit_amount": 50000,
        "benefit_amount_inr": 50000,
        "benefit_period": "yearly",
        "driver_tags": ["income", "emi_burden"],
        "documents": [
            "Aadhaar Card",
            "Land Possession Certificate (LPC) / Record of Rights (RoR)",
            "Sowing Certificate issued by Patwari/Village officer",
            "Bank Account Passbook (or KCC details)"
        ],
        "apply_steps": [
            "Visit pmfby.gov.in or your nearest bank branch / CSC centre",
            "Enter land survey number, crop type, and acreage details",
            "Pay the subsidized farmer share of premium (1.5% rabi, 2% kharif)",
            "Receive digital insurance policy receipt and crop coverage confirmation"
        ],
        "official_url": "https://pmfby.gov.in/",
        "status": "active",
        "last_verified_at": datetime(2026, 10, 20, 0, 0, 0, tzinfo=timezone.utc),
        "rules": [
            {"field": "employment_status", "operator": "in", "value": ["self_employed", "unemployed"], "logic_group": 1},
            {"field": "owns_property", "operator": "eq", "value": True, "logic_group": 1}
        ]
    },
    {
        "name": "PM Vishwakarma Yojana",
        "slug": "pm-vishwakarma-yojana",
        "short_description": "₹15,000 toolkit voucher and collateral-free enterprise loans up to ₹3 Lakh at 5% interest.",
        "full_description": "A comprehensive central scheme supporting traditional artisans and craftspeople with recognition, modern toolkit incentives of ₹15,000, and subsidized collateral-free enterprise credit up to ₹3 Lakh at 5% interest.",
        "ministry": "Ministry of Micro, Small and Medium Enterprises",
        "category": "business",
        "level": "central",
        "benefit_type": "loan_subsidy",
        "benefit_amount": 300000,
        "benefit_amount_inr": 300000,
        "benefit_period": "one_time",
        "driver_tags": ["employment_stability", "emi_burden", "income"],
        "documents": [
            "Aadhaar Card and mobile number linked to Aadhaar",
            "Bank Account Passbook",
            "Traditional trade declaration (18 eligible artisan trades)",
            "Ration Card"
        ],
        "apply_steps": [
            "Visit a Common Service Centre (CSC) to register on pmvishwakarma.gov.in",
            "Gram Panchayat or Urban Local Body verifies your artisan trade",
            "Complete 5-7 days of basic skill training with a ₹500/day stipend",
            "Receive ₹15,000 e-voucher for modern toolkit and apply for collateral-free loan"
        ],
        "official_url": "https://pmvishwakarma.gov.in/",
        "status": "active",
        "last_verified_at": datetime(2026, 10, 20, 0, 0, 0, tzinfo=timezone.utc),
        "rules": [
            {"field": "employment_status", "operator": "in", "value": ["self_employed", "salaried_private"], "logic_group": 1},
            {"field": "age", "operator": "gte", "value": 18, "logic_group": 1}
        ]
    },
    {
        "name": "Prime Minister's Employment Generation Programme (PMEGP)",
        "slug": "pmegp",
        "short_description": "Government subsidy up to 35% on bank-financed micro-enterprise projects up to ₹50 Lakh.",
        "full_description": "A credit-linked subsidy programme aimed at generating self-employment opportunities through establishment of micro-enterprises in non-farm sector by helping traditional artisans and unemployed youth.",
        "ministry": "Ministry of Micro, Small and Medium Enterprises",
        "category": "business",
        "level": "central",
        "benefit_type": "subsidy",
        "benefit_amount": 350000,
        "benefit_amount_inr": 350000,
        "benefit_period": "one_time",
        "driver_tags": ["employment_stability", "income", "emi_burden"],
        "documents": [
            "Aadhaar Card and PAN Card",
            "Detailed Project Report (DPR)",
            "Class 8 pass marksheet (for projects exceeding ₹10 Lakh in manufacturing)",
            "Caste or Special Category Certificate (if claiming 35% subsidy)"
        ],
        "apply_steps": [
            "Visit kviconline.gov.in/pmegpeportal and click 'Apply Online'",
            "Fill in entrepreneur profile, project details, and chosen bank branch",
            "Upload project report, caste certificate, and qualification documents",
            "District Task Force Committee shortlists proposal and sends to bank for sanction"
        ],
        "official_url": "https://www.kviconline.gov.in/pmegpeportal/pmegphome/index.jsp",
        "status": "active",
        "last_verified_at": datetime(2026, 10, 20, 0, 0, 0, tzinfo=timezone.utc),
        "rules": [
            {"field": "age", "operator": "gte", "value": 18, "logic_group": 1},
            {"field": "employment_status", "operator": "in", "value": ["unemployed", "self_employed", "business_owner"], "logic_group": 1}
        ]
    },
    {
        "name": "PM SVANidhi (Street Vendor's AtmaNirbhar Nidhi)",
        "slug": "pm-svanidhi",
        "short_description": "Working capital micro-loans of ₹10,000, ₹20,000, and ₹50,000 with 7% interest subsidy.",
        "full_description": "A micro-credit facility providing street vendors with collateral-free working capital loans starting at ₹10,000, scaling to ₹20,000 and ₹50,000 on timely repayment, with a 7% annual interest subsidy.",
        "ministry": "Ministry of Housing and Urban Affairs",
        "category": "business",
        "level": "central",
        "benefit_type": "loan_subsidy",
        "benefit_amount": 50000,
        "benefit_amount_inr": 50000,
        "benefit_period": "one_time",
        "driver_tags": ["emi_burden", "income"],
        "documents": [
            "Aadhaar Card",
            "Vending Certificate or Letter of Recommendation (LoR) from Urban Local Body",
            "Aadhaar-linked Bank Account Passbook"
        ],
        "apply_steps": [
            "Visit pmsvanidhi.mohua.gov.in or apply through an empanelled banking agent",
            "Verify your phone number with OTP linked to your Aadhaar",
            "Upload your Vending ID or request LoR verification online",
            "Choose a preferred bank; loan is disbursed within 10-15 business days"
        ],
        "official_url": "https://pmsvanidhi.mohua.gov.in/",
        "status": "active",
        "last_verified_at": datetime(2026, 10, 20, 0, 0, 0, tzinfo=timezone.utc),
        "rules": [
            {"field": "employment_status", "operator": "eq", "value": "self_employed", "logic_group": 1},
            {"field": "annual_income", "operator": "lte", "value": 300000, "logic_group": 1}
        ]
    },
    {
        "name": "National Means-cum-Merit Scholarship Scheme (NMMSS)",
        "slug": "nmmss",
        "short_description": "₹12,000 annual scholarship for meritorious secondary students from low-income families.",
        "full_description": "Awards scholarships to meritorious students of economically weaker sections to arrest dropout rates at Class 8 and encourage them to continue study at secondary stage through Class 12.",
        "ministry": "Ministry of Education",
        "category": "education",
        "level": "central",
        "benefit_type": "cash",
        "benefit_amount": 12000,
        "benefit_amount_inr": 12000,
        "benefit_period": "yearly",
        "driver_tags": ["income", "dependents"],
        "documents": [
            "Aadhaar Card",
            "Class 7 and 8 Marksheet (minimum 55% marks)",
            "Income certificate showing parental annual income under ₹3.5 Lakh",
            "Student Bank Account passbook"
        ],
        "apply_steps": [
            "Appear for the state-level NMMS written exam conducted in Class 8",
            "Upon selection, register on scholarships.gov.in with student Aadhaar",
            "School principal verifies marks and economic eligibility",
            "Disbursement of ₹12,000/year made via DBT directly into student account"
        ],
        "official_url": "https://scholarships.gov.in/",
        "status": "active",
        "last_verified_at": datetime(2026, 10, 20, 0, 0, 0, tzinfo=timezone.utc),
        "rules": [
            {"field": "dependents", "operator": "gte", "value": 1, "logic_group": 1},
            {"field": "annual_income", "operator": "lte", "value": 350000, "logic_group": 1}
        ]
    },
    {
        "name": "Pradhan Mantri Matru Vandana Yojana (PMMVY)",
        "slug": "pmmvy",
        "short_description": "₹5,000 direct cash incentive for pregnant women and lactating mothers.",
        "full_description": "A conditional cash transfer maternity benefit providing partial compensation for wage loss during pregnancy and childbirth, promoting safe delivery and exclusive breastfeeding.",
        "ministry": "Ministry of Women and Child Development",
        "category": "health",
        "level": "central",
        "benefit_type": "cash",
        "benefit_amount": 5000,
        "benefit_amount_inr": 5000,
        "benefit_period": "one_time",
        "driver_tags": ["income", "dependents"],
        "documents": [
            "Aadhaar Card of mother and husband",
            "Mother and Child Protection (MCP) Card",
            "Aadhaar-linked Bank Account details"
        ],
        "apply_steps": [
            "Register at your local Anganwadi Centre or online at pmmvy.wcd.gov.in",
            "Submit Form 1A with MCP Card details within 570 days of last menstrual period",
            "Receive ₹3,000 after completing at least one antenatal checkup",
            "Receive balance ₹2,000 upon child birth registration and first round of vaccinations"
        ],
        "official_url": "https://pmmvy.wcd.gov.in/",
        "status": "active",
        "last_verified_at": datetime(2026, 10, 20, 0, 0, 0, tzinfo=timezone.utc),
        "rules": [
            {"field": "gender", "operator": "eq", "value": "female", "logic_group": 1},
            {"field": "annual_income", "operator": "lte", "value": 800000, "logic_group": 1}
        ]
    },
    {
        "name": "Pradhan Mantri Jan Dhan Yojana (PMJDY)",
        "slug": "pm-jan-dhan-yojana",
        "short_description": "Zero-balance basic bank account with ₹2 Lakh accidental insurance and ₹10,000 overdraft.",
        "full_description": "National Mission for Financial Inclusion ensuring universal access to banking services with at least one basic banking account per household, financial literacy, and credit facility.",
        "ministry": "Ministry of Finance",
        "category": None,
        "level": "central",
        "benefit_type": "insurance",
        "benefit_amount": 200000,
        "benefit_amount_inr": 200000,
        "benefit_period": "yearly",
        "driver_tags": ["savings", "credit_history"],
        "documents": [
            "Aadhaar Card",
            "PAN Card (or Form 60)",
            "Passport size photograph"
        ],
        "apply_steps": [
            "Walk into any commercial bank branch or visit a Bank Mitra / Business Correspondent kiosk",
            "Fill out the simplified PMJDY account opening form",
            "Provide biometric Aadhaar authentication",
            "Receive instant zero-balance savings account and RuPay debit card"
        ],
        "official_url": "https://pmjdy.gov.in/",
        "status": "active",
        "last_verified_at": datetime(2026, 10, 20, 0, 0, 0, tzinfo=timezone.utc),
        "rules": [
            {"field": "age", "operator": "gte", "value": 18, "logic_group": 1}
        ]
    },
    {
        "name": "Pre-Matric Scholarship for SC Students",
        "slug": "pre-matric-scholarship-sc",
        "short_description": "Annual scholarship and book grants for Class 9 and 10 SC students from low-income families.",
        "full_description": "Centrally funded financial support scheme aimed at curbing high drop-out rates in secondary education among SC children whose parents earn under ₹2.5 Lakh per annum.",
        "ministry": "Ministry of Social Justice and Empowerment",
        "category": "education",
        "level": "central",
        "benefit_type": "cash",
        "benefit_amount": 4000,
        "benefit_amount_inr": 4000,
        "benefit_period": "yearly",
        "driver_tags": ["income", "education"],
        "documents": [
            "Aadhaar Card",
            "SC Caste Certificate",
            "Income Certificate (parental income up to ₹2.5 Lakh)",
            "Student Bank Account passbook"
        ],
        "apply_steps": [
            "Apply online through the state scholarship portal or scholarships.gov.in",
            "Submit student registration with school enrolment code and Aadhaar",
            "School headmaster approves and forwards nomination to Social Welfare Department",
            "Scholarship allowance is directly transferred to the student's bank account"
        ],
        "official_url": "https://scholarships.gov.in/",
        "status": "active",
        "last_verified_at": datetime(2026, 10, 20, 0, 0, 0, tzinfo=timezone.utc),
        "rules": [
            {"field": "annual_income", "operator": "lte", "value": 250000, "logic_group": 1},
            {"field": "dependents", "operator": "gte", "value": 1, "logic_group": 1}
        ]
    },
    {
        "name": "Mahatma Gandhi National Rural Employment Guarantee Act (MGNREGA)",
        "slug": "mgnrega",
        "short_description": "Guaranteed 100 days of wage employment per year for rural adult households.",
        "full_description": "Legal guarantee providing at least 100 days of wage employment in every financial year to every rural household whose adult members volunteer to do unskilled manual work at statutory minimum wages.",
        "ministry": "Ministry of Rural Development",
        "category": "business",
        "level": "central",
        "benefit_type": "cash",
        "benefit_amount": 26000,
        "benefit_amount_inr": 26000,
        "benefit_period": "yearly",
        "driver_tags": ["employment_stability", "income"],
        "documents": [
            "Aadhaar Card",
            "Address Proof in rural jurisdiction",
            "Aadhaar-linked Bank or Post Office Account details",
            "Passport-size photographs"
        ],
        "apply_steps": [
            "Apply in writing or orally for a Job Card at your local Gram Panchayat office",
            "Gram Panchayat conducts verification and issues Job Card within 15 days",
            "Submit a dated work application specifying preferred work period",
            "Gram Panchayat provides wage employment within 15 days within 5 km radius"
        ],
        "official_url": "https://nrega.nic.in/",
        "status": "active",
        "last_verified_at": datetime(2026, 10, 20, 0, 0, 0, tzinfo=timezone.utc),
        "rules": [
            {"field": "age", "operator": "gte", "value": 18, "logic_group": 1},
            {"field": "employment_status", "operator": "in", "value": ["unemployed", "self_employed"], "logic_group": 1}
        ]
    },
    {
        "name": "Pradhan Mantri Shram Yogi Maandhan (PM-SYM)",
        "slug": "pm-shram-yogi-maandhan",
        "short_description": "Voluntary contributory pension providing assured ₹3,000 monthly pension for unorganized workers.",
        "full_description": "A 50:50 government-matching pension scheme for unorganized workers aged 18-40 earning up to ₹15,000/month. Assures a minimum monthly pension of ₹3,000 after attaining age 60.",
        "ministry": "Ministry of Labour and Employment",
        "category": "business",
        "level": "central",
        "benefit_type": "insurance",
        "benefit_amount": 36000,
        "benefit_amount_inr": 36000,
        "benefit_period": "yearly",
        "driver_tags": ["savings", "income"],
        "documents": [
            "Aadhaar Card",
            "Savings Bank Account / Jan Dhan Account with IFSC",
            "Mobile Number"
        ],
        "apply_steps": [
            "Visit the nearest Common Services Centre (CSC) with Aadhaar and bank passbook",
            "Village Level Entrepreneur (VLE) completes biometric authentication on maandhan.in",
            "Pay the initial monthly contribution (₹55 - ₹200 based on age) in cash",
            "Auto-debit mandate registered; instant Shram Yogi Pension Card issued"
        ],
        "official_url": "https://maandhan.in/",
        "status": "active",
        "last_verified_at": datetime(2026, 10, 20, 0, 0, 0, tzinfo=timezone.utc),
        "rules": [
            {"field": "age", "operator": "between", "value": [18, 40], "logic_group": 1},
            {"field": "annual_income", "operator": "lte", "value": 180000, "logic_group": 1}
        ]
    },
    {
        "name": "PM Kaushal Vikas Yojana (PMKVY)",
        "slug": "pmkvy",
        "short_description": "Free industry-aligned skill certification and placement assistance with monetary incentives.",
        "full_description": "Flagship scheme of the Ministry of Skill Development and Entrepreneurship enabling Indian youth to take up industry-relevant skill training that will help them secure a better livelihood.",
        "ministry": "Ministry of Skill Development and Entrepreneurship",
        "category": "education",
        "level": "central",
        "benefit_type": "subsidy",
        "benefit_amount": 8000,
        "benefit_amount_inr": 8000,
        "benefit_period": "one_time",
        "driver_tags": ["employment_stability", "income"],
        "documents": [
            "Aadhaar Card",
            "Bank Account details",
            "Prior education qualification certificate (if required for trade)"
        ],
        "apply_steps": [
            "Search for authorized training centres on pmkvyofficial.org or Skill India portal",
            "Register for a short-term training course aligned with industry demand",
            "Attend classroom and practical hands-on technical sessions",
            "Clear third-party assessment to receive Government of India NSDC certification"
        ],
        "official_url": "https://www.pmkvyofficial.org/",
        "status": "active",
        "last_verified_at": datetime(2026, 10, 20, 0, 0, 0, tzinfo=timezone.utc),
        "rules": [
            {"field": "age", "operator": "between", "value": [15, 45], "logic_group": 1}
        ]
    },
    {
        "name": "PM Matsya Sampada Yojana (PMMSY)",
        "slug": "pmmsy",
        "short_description": "40% to 60% capital subsidy for fisheries infrastructure and aquaculture entrepreneurship.",
        "full_description": "Comprehensive scheme to bring about Blue Revolution through sustainable and responsible development of fisheries sector, offering substantial financial assistance for modern aquaculture, hatcheries, and cold chain.",
        "ministry": "Ministry of Fisheries, Animal Husbandry and Dairying",
        "category": "agriculture",
        "level": "central",
        "benefit_type": "subsidy",
        "benefit_amount": 240000,
        "benefit_amount_inr": 240000,
        "benefit_period": "one_time",
        "driver_tags": ["income", "emi_burden"],
        "documents": [
            "Aadhaar Card and PAN Card",
            "Land/water body ownership or lease deed for minimum 10 years",
            "Detailed Project Report (DPR)",
            "Bank Account Statement"
        ],
        "apply_steps": [
            "Submit Detailed Project Report to District Fisheries Office or online via pmmsy.dof.gov.in",
            "District Fisheries Officer reviews technical and economic viability",
            "State Level Approval Committee (SLAC) issues formal administrative approval",
            "Subsidy disbursed into beneficiary account in milestone-based tranches"
        ],
        "official_url": "https://pmmsy.dof.gov.in/",
        "status": "active",
        "last_verified_at": datetime(2026, 10, 20, 0, 0, 0, tzinfo=timezone.utc),
        "rules": [
            {"field": "employment_status", "operator": "in", "value": ["self_employed", "business_owner"], "logic_group": 1}
        ]
    },
    {
        "name": "Startup India Initiative",
        "slug": "startup-india",
        "short_description": "3-year income tax holiday, patent fee rebates, and seed capital access for recognized startups.",
        "full_description": "Flagship government initiative intended to build a strong ecosystem for nurturing innovation and startups in the country that will drive sustainable economic growth and generate large scale employment.",
        "ministry": "Ministry of Commerce and Industry",
        "category": "business",
        "level": "central",
        "benefit_type": "unquantified",
        "benefit_amount": None,
        "benefit_amount_inr": None,
        "benefit_period": "yearly",
        "driver_tags": ["employment_stability", "income"],
        "documents": [
            "Certificate of Incorporation / Registration of Partnership",
            "Director / Partner KYC and PAN details",
            "Brief pitch deck describing innovation, scalability, and market viability",
            "Patent / Trademark registration (optional, for fast-track rebate)"
        ],
        "apply_steps": [
            "Create an account on startupindia.gov.in",
            "Click 'Apply for DPIIT Recognition' and enter company details",
            "Upload letter of authorization and brief pitch on innovative solution",
            "DPIIT issues certificate of recognition unlocking Section 80-IAC tax exemptions"
        ],
        "official_url": "https://www.startupindia.gov.in/",
        "status": "active",
        "last_verified_at": datetime(2026, 10, 20, 0, 0, 0, tzinfo=timezone.utc),
        "rules": [
            {"field": "employment_status", "operator": "eq", "value": "business_owner", "logic_group": 1}
        ]
    },
    {
        "name": "Mukhyamantri Majhi Ladki Bahin Yojana",
        "slug": "majhi-ladki-bahin-yojana",
        "short_description": "₹1,500 monthly direct cash transfer for eligible Maharashtra women aged 21-65.",
        "full_description": "A Maharashtra state welfare scheme providing a monthly direct benefit transfer of ₹1,500 (₹18,000/year) to eligible women residents aged 21-65 having family annual income up to ₹2.5 Lakh.",
        "ministry": "Women and Child Development Department, Government of Maharashtra",
        "category": None,
        "level": "state",
        "state": "Maharashtra",
        "benefit_type": "cash",
        "benefit_amount": 18000,
        "benefit_amount_inr": 18000,
        "benefit_period": "yearly",
        "driver_tags": ["income", "dependents"],
        "documents": [
            "Aadhaar Card",
            "Maharashtra Domicile Certificate / 15-year old Ration Card",
            "Income Certificate (family income under ₹2.5 Lakh)",
            "Aadhaar-linked Bank Account Passbook"
        ],
        "apply_steps": [
            "Visit ladakibahin.maharashtra.gov.in or use the Nari Shakti Doot mobile app",
            "Enter your Aadhaar number and verify using OTP",
            "Upload scanned copy of Maharashtra domicile proof and income certificate",
            "Submit the application; ₹1,500 monthly DBT starts following verification"
        ],
        "official_url": "https://ladakibahin.maharashtra.gov.in/",
        "status": "active",
        "last_verified_at": datetime(2026, 10, 20, 0, 0, 0, tzinfo=timezone.utc),
        "rules": [
            {"field": "gender", "operator": "eq", "value": "female", "logic_group": 1},
            {"field": "age", "operator": "between", "value": [21, 65], "logic_group": 1},
            {"field": "annual_income", "operator": "lte", "value": 250000, "logic_group": 1}
        ]
    },
    {
        "name": "Rajarshi Chhatrapati Shahu Maharaj Shikshan Shulk Shishyavrutti Yojana",
        "slug": "rajarshi-shahu-maharaj-scholarship",
        "short_description": "Tuition and exam fee waiver for Maharashtra students from families earning up to ₹8 Lakh/year.",
        "full_description": "State scheme reimbursing 50% to 100% of college tuition and exam fees for students admitted through CAP into government and approved private colleges in Maharashtra.",
        "ministry": "Higher and Technical Education Department, Government of Maharashtra",
        "category": "education",
        "level": "state",
        "state": "Maharashtra",
        "benefit_type": "subsidy",
        "benefit_amount": 50000,
        "benefit_amount_inr": 50000,
        "benefit_period": "yearly",
        "driver_tags": ["income", "education"],
        "documents": [
            "Maharashtra Domicile Certificate",
            "Income Certificate (family income under ₹8 Lakh)",
            "CAP Allotment Letter and college fee receipt",
            "Previous examination marksheet"
        ],
        "apply_steps": [
            "Register on mahadbt.maharashtra.gov.in using Aadhaar",
            "Select Directorate of Higher / Technical Education scholarship category",
            "Fill current academic course details and upload CAP allotment letter",
            "Institute scrutiny officer verifies and fee waiver is processed"
        ],
        "official_url": "https://mahadbt.maharashtra.gov.in/",
        "status": "active",
        "last_verified_at": datetime(2026, 10, 20, 0, 0, 0, tzinfo=timezone.utc),
        "rules": [
            {"field": "employment_status", "operator": "eq", "value": "student", "logic_group": 1},
            {"field": "annual_income", "operator": "lte", "value": 800000, "logic_group": 1}
        ]
    },
    {
        "name": "Majhi Kanya Bhagyashree Yojana",
        "slug": "majhi-kanya-bhagyashree-yojana",
        "short_description": "₹50,000 fixed deposit savings for Maharashtra families with one or two daughters.",
        "full_description": "Government of Maharashtra scheme where a fixed deposit of ₹50,000 is opened for families with one girl child (or ₹25,000 each for two daughters), maturing with accrued interest at age 18.",
        "ministry": "Women and Child Development Department, Government of Maharashtra",
        "category": None,
        "level": "state",
        "state": "Maharashtra",
        "benefit_type": "subsidy",
        "benefit_amount": 50000,
        "benefit_amount_inr": 50000,
        "benefit_period": "one_time",
        "driver_tags": ["savings", "dependents"],
        "documents": [
            "Girl child birth certificate",
            "Maharashtra Domicile Certificate",
            "Family Planning Certificate of parents",
            "Income Certificate (family income under ₹7.5 Lakh)"
        ],
        "apply_steps": [
            "Obtain prescribed application form from your local Anganwadi worker or CDPO office",
            "Attach girl child birth certificate, domicile certificate, and sterilization proof",
            "CDPO officer approves and deposits ₹50,000 in a nationalized bank joint account",
            "Amount matures with interest when the girl child turns 18 and passes Class 10"
        ],
        "official_url": "https://womenchild.maharashtra.gov.in/",
        "status": "active",
        "last_verified_at": datetime(2026, 10, 20, 0, 0, 0, tzinfo=timezone.utc),
        "rules": [
            {"field": "dependents", "operator": "gte", "value": 1, "logic_group": 1},
            {"field": "annual_income", "operator": "lte", "value": 750000, "logic_group": 1}
        ]
    }
]

def sync_all(db):
    for item in VERIFIED_SCHEMES:
        slug = item["slug"]
        scheme = db.query(Scheme).filter(Scheme.slug == slug).first()
        if not scheme:
            scheme = Scheme(
                id=uuid.uuid4(),
                slug=slug,
                name=item["name"],
                status=item["status"]
            )
            db.add(scheme)
            db.flush()

        scheme.name = item["name"]
        scheme.short_description = item["short_description"]
        scheme.full_description = item["full_description"]
        scheme.ministry = item.get("ministry")
        scheme.category = item.get("category")
        scheme.level = item.get("level", "central")
        scheme.state = item.get("state")
        scheme.benefit_type = item.get("benefit_type")
        scheme.benefit_amount = item.get("benefit_amount")
        scheme.benefit_amount_inr = item.get("benefit_amount_inr")
        scheme.benefit_period = item.get("benefit_period")
        scheme.driver_tags = item.get("driver_tags", [])
        scheme.documents = item.get("documents", [])
        scheme.apply_steps = item.get("apply_steps", [])
        scheme.official_url = item.get("official_url")
        scheme.status = "active"
        scheme.last_verified_at = item.get("last_verified_at")

        # Sync rules
        db.query(SchemeEligibilityRule).filter(SchemeEligibilityRule.scheme_id == scheme.id).delete()
        for r in item.get("rules", []):
            rule = SchemeEligibilityRule(
                id=uuid.uuid4(),
                scheme_id=scheme.id,
                field=r["field"],
                operator=r["operator"],
                value=r["value"],
                logic_group=r.get("logic_group", 1)
            )
            db.add(rule)

    db.commit()
    print(f"Successfully synced {len(VERIFIED_SCHEMES)} verified schemes into database.")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        sync_all(db)
    finally:
        db.close()
