import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

# Web app brand colors
NAVY = colors.HexColor("#0F2A47")
TEAL = colors.HexColor("#0E8F86")
AMBER = colors.HexColor("#E8A317")
RISK_LOW = colors.HexColor("#16A34A")
RISK_MED = colors.HexColor("#F59E0B")
RISK_HIGH = colors.HexColor("#DC2626")
BG_ALT = colors.HexColor("#F7F9FC")
BORDER = colors.HexColor("#E2E8F0")
TEXT_MUTED = colors.HexColor("#5B6B7F")
TEXT_DARK = colors.HexColor("#1A2332")

def get_band_color(band_str: str):
    b = (band_str or "").lower()
    if "low" in b:
        return RISK_LOW
    elif "mod" in b or "med" in b:
        return RISK_MED
    return RISK_HIGH

def generate_pdf_report(
    assessment_data: dict,
    plan_data: dict,
    schemes_data: dict,
    lang: str = "en"
) -> bytes:
    """
    Generates a high-fidelity PDF report using ReportLab.
    Includes score & band, affordability, top drivers, ranked priorities,
    roadmap, habits, matched schemes, missed benefits summary, and disclaimer.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    # Custom typography styles
    style_title = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=NAVY
    )
    style_subtitle = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=TEXT_MUTED
    )
    style_h2 = ParagraphStyle(
        'Heading2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=NAVY,
        spaceAfter=6
    )
    style_body = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=TEXT_DARK
    )
    style_body_bold = ParagraphStyle(
        'BodyBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=TEXT_DARK
    )
    style_small = ParagraphStyle(
        'Small',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10,
        textColor=TEXT_MUTED
    )
    style_disclaimer = ParagraphStyle(
        'Disclaimer',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=7.5,
        leading=10,
        textColor=TEXT_MUTED
    )

    elements = []

    # 1. Header Banner
    elements.append(Paragraph("FinShield Financial Health & Credit Risk Report", style_title))
    now_str = datetime.utcnow().strftime("%d %B %Y, %H:%M UTC")
    elements.append(Paragraph(f"Assessment ID: {plan_data.get('assessment_id')}  |  Generated on: {now_str}", style_subtitle))
    elements.append(Spacer(1, 10))
    elements.append(HRFlowable(width="100%", thickness=1, color=BORDER, spaceBefore=2, spaceAfter=10))

    # 2. Risk Score & Affordability Overview
    score = plan_data.get("score", 300)
    band = plan_data.get("band", "Moderate")
    band_color = get_band_color(band)

    affordability = plan_data.get("affordability", {})
    surplus_str = f"INR {int(affordability.get('monthly_surplus', 0)):,}"
    emi_ratio_str = f"{affordability.get('emi_to_income_pct', 0)}%"
    runway_str = f"{affordability.get('emergency_runway_months', 'N/A')} Months"

    score_card = [
        [
            Paragraph("<b>CREDIT RISK SCORE</b>", style_small),
            Paragraph("<b>RISK BAND</b>", style_small),
            Paragraph("<b>MONTHLY SURPLUS</b>", style_small),
            Paragraph("<b>EMI / INCOME</b>", style_small),
            Paragraph("<b>RUNWAY</b>", style_small),
        ],
        [
            Paragraph(f"<font color='{NAVY.hexval()}'><b>{score}</b></font> / 850", style_h2),
            Paragraph(f"<font color='{band_color.hexval()}'><b>{band.upper()}</b></font>", style_h2),
            Paragraph(surplus_str, style_body_bold),
            Paragraph(emi_ratio_str, style_body_bold),
            Paragraph(runway_str, style_body_bold),
        ]
    ]
    score_table = Table(score_card, colWidths=[110, 105, 110, 105, 110])
    score_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BG_ALT),
        ('BOX', (0, 0), (-1, -1), 1, BORDER),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(score_table)
    elements.append(Spacer(1, 14))

    # 3. Top Drivers
    drivers = plan_data.get("drivers", [])
    if drivers:
        elements.append(Paragraph("Key Drivers Driving Your Assessment", style_h2))
        driver_rows = [[
            Paragraph("<b>Factor</b>", style_body_bold),
            Paragraph("<b>Direction</b>", style_body_bold),
            Paragraph("<b>Relative Impact</b>", style_body_bold)
        ]]
        for d in drivers:
            is_risk = d.get("direction") == "increases_risk"
            dir_text = f"<font color='{RISK_HIGH.hexval()}'>Raises Risk</font>" if is_risk else f"<font color='{RISK_LOW.hexval()}'>Lowers Risk</font>"
            driver_rows.append([
                Paragraph(d.get("label", ""), style_body),
                Paragraph(dir_text, style_body),
                Paragraph(f"{d.get('impact_pct', 0)}%", style_body)
            ])
        driver_table = Table(driver_rows, colWidths=[240, 150, 150])
        driver_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), BG_ALT),
            ('BOX', (0, 0), (-1, -1), 1, BORDER),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(driver_table)
        elements.append(Spacer(1, 14))

    # 4. Ranked Priorities & Action Plan
    priorities = plan_data.get("priorities", [])
    if priorities:
        elements.append(Paragraph("Ranked Action Priorities", style_h2))
        prio_rows = [[
            Paragraph("<b>#</b>", style_body_bold),
            Paragraph("<b>Priority & Recommended Action</b>", style_body_bold),
            Paragraph("<b>Horizon</b>", style_body_bold),
            Paragraph("<b>Est. Gain</b>", style_body_bold)
        ]]
        for p in priorities:
            gain_str = f"+{p.get('est_score_gain')} pts" if p.get("est_score_gain") else "Stabilization"
            desc = f"<b>{p.get('title')}</b><br/>{p.get('action')}"
            prio_rows.append([
                Paragraph(str(p.get("rank")), style_body_bold),
                Paragraph(desc, style_body),
                Paragraph(p.get("timeframe", "").upper(), style_body_bold),
                Paragraph(f"<font color='{TEAL.hexval()}'><b>{gain_str}</b></font>", style_body)
            ])
        prio_table = Table(prio_rows, colWidths=[25, 365, 75, 75])
        prio_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), BG_ALT),
            ('BOX', (0, 0), (-1, -1), 1, BORDER),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        elements.append(prio_table)
        elements.append(Spacer(1, 14))

    # 5. Roadmap
    roadmap = plan_data.get("roadmap", {})
    if roadmap:
        elements.append(Paragraph("Structured Financial Roadmap", style_h2))
        rm_items = []
        for period, label in [("3m", "3-Month Horizon"), ("6m", "6-Month Horizon"), ("12m", "12-Month Horizon")]:
            items = roadmap.get(period, [])
            for it in items:
                rm_items.append([
                    Paragraph(f"<b>{label}</b>", style_body_bold),
                    Paragraph(f"<b>{it.get('title')}</b><br/>{it.get('detail')}", style_body)
                ])
        rm_table = Table(rm_items, colWidths=[120, 420])
        rm_table.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 1, BORDER),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER),
            ('BACKGROUND', (0, 0), (0, -1), BG_ALT),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(rm_table)
        elements.append(Spacer(1, 14))

    # 6. Missed Government Schemes Summary & Matches
    missed = schemes_data.get("missed_summary", {})
    matched = schemes_data.get("matched", [])
    if matched:
        elements.append(Paragraph("Eligible Government Welfare Schemes", style_h2))
        if missed.get("count", 0) > 0:
            tot_str = f"INR {int(missed.get('total_annual_inr', 0)):,}/year"
            unq_str = f" plus {missed.get('unquantified_count')} unquantified program(s)" if missed.get("unquantified_count") else ""
            summary_txt = f"<b>Opportunity Alert:</b> You appear eligible for <b>{missed.get('count')}</b> scheme(s) you may not yet be utilizing, estimated at up to <b>{tot_str}</b>{unq_str}."
            elements.append(Paragraph(summary_txt, style_body))
            elements.append(Spacer(1, 6))

        sch_rows = [[
            Paragraph("<b>Scheme</b>", style_body_bold),
            Paragraph("<b>Eligibility</b>", style_body_bold),
            Paragraph("<b>Estimated Benefit</b>", style_body_bold),
            Paragraph("<b>Match Reason</b>", style_body_bold)
        ]]
        for s in matched[:6]:  # top 6 schemes
            b_info = s.get("benefit", {})
            amt_val = b_info.get("annual_inr")
            b_str = f"INR {int(amt_val):,}/yr" if amt_val else b_info.get("type", "").replace("_", " ").title()
            sch_rows.append([
                Paragraph(s.get("name", ""), style_body_bold),
                Paragraph(s.get("eligibility", "").upper(), style_body),
                Paragraph(f"<font color='{TEAL.hexval()}'>{b_str}</font>", style_body),
                Paragraph(s.get("match_reason", ""), style_small)
            ])
        sch_table = Table(sch_rows, colWidths=[160, 60, 100, 220])
        sch_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), BG_ALT),
            ('BOX', (0, 0), (-1, -1), 1, BORDER),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(sch_table)
        elements.append(Spacer(1, 14))

    # 7. Regulatory Disclaimer
    elements.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceBefore=4, spaceAfter=8))
    elements.append(Paragraph(f"<b>Disclaimer:</b> {plan_data.get('disclaimer')}", style_disclaimer))

    # Build document
    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()
