"""Monthly expense report PDF (ReportLab).

Layout: branded header band -> KPI cards -> category donut + breakdown table
-> daily spending bar chart -> full transaction list (header row repeats
across pages) -> footer with "Page X of Y" on every page.
"""
import io
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from xml.sax.saxutils import escape

from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.platypus import (
    KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

NAVY = colors.HexColor("#0F2A47")
TEAL = colors.HexColor("#0E8F86")
TEXT = colors.HexColor("#1A2332")
MUTED = colors.HexColor("#5B6B7F")
BORDER = colors.HexColor("#E2E8F0")
BG_ALT = colors.HexColor("#F7F9FC")
RED = colors.HexColor("#DC2626")
GREEN = colors.HexColor("#16A34A")

# Same palette as the web app's --cat-* tokens.
CATEGORY_COLORS = {
    "food": "#F97316", "groceries": "#84CC16", "travel": "#0EA5E9",
    "rent": "#6366F1", "bills": "#EAB308", "emi": "#DC2626",
    "health": "#10B981", "education": "#8B5CF6", "shopping": "#EC4899",
    "entertainment": "#14B8A6", "other": "#94A3B8",
}
CATEGORY_LABELS = {
    "food": "Food", "groceries": "Groceries", "travel": "Travel", "rent": "Rent",
    "bills": "Bills", "emi": "EMI", "health": "Health", "education": "Education",
    "shopping": "Shopping", "entertainment": "Entertainment", "other": "Other",
}
PAYMENT_LABELS = {
    "cash": "Cash", "upi": "UPI", "card": "Card", "netbanking": "Net Banking", "other": "Other",
}

PAGE_W, PAGE_H = A4
MARGIN = 16 * mm
CONTENT_W = PAGE_W - 2 * MARGIN
HEADER_H = 30 * mm


def inr(value, decimals: bool = False) -> str:
    """Indian digit grouping (1,25,000). Helvetica has no rupee glyph, so 'Rs.'."""
    amount = Decimal(value or 0)
    negative = amount < 0
    amount = abs(amount)
    whole = int(amount)
    paise = int(round((amount - whole) * 100))
    if paise == 100:
        whole, paise = whole + 1, 0
    digits = str(whole)
    if len(digits) > 3:
        head, tail = digits[:-3], digits[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        digits = ",".join(groups) + "," + tail
    text = f"Rs. {digits}"
    if decimals or paise:
        text += f".{paise:02d}"
    return f"-{text}" if negative else text


def _styles():
    base = dict(fontName="Helvetica", fontSize=9, leading=12, textColor=TEXT)
    return {
        "h2": ParagraphStyle("h2", **{**base, "fontName": "Helvetica-Bold", "fontSize": 12, "leading": 16, "textColor": NAVY}),
        "body": ParagraphStyle("body", **base),
        "muted": ParagraphStyle("muted", **{**base, "fontSize": 8, "textColor": MUTED}),
        "kpi_label": ParagraphStyle("kpi_label", **{**base, "fontSize": 8, "textColor": MUTED}),
        "kpi_value": ParagraphStyle("kpi_value", **{**base, "fontName": "Helvetica-Bold", "fontSize": 15, "leading": 19, "textColor": NAVY}),
        "cell": ParagraphStyle("cell", **{**base, "fontSize": 8.5, "leading": 11}),
        "cell_right": ParagraphStyle("cell_right", **{**base, "fontSize": 8.5, "leading": 11, "alignment": TA_RIGHT}),
        "th": ParagraphStyle("th", **{**base, "fontName": "Helvetica-Bold", "fontSize": 8, "textColor": colors.white}),
        "th_right": ParagraphStyle("th_right", **{**base, "fontName": "Helvetica-Bold", "fontSize": 8, "textColor": colors.white, "alignment": TA_RIGHT}),
    }


class _NumberedCanvas(rl_canvas.Canvas):
    """Defers page output so each footer can say 'Page X of Y'."""

    def __init__(self, *args, header=None, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_pages = []
        self._header = header

    def showPage(self):
        self._saved_pages.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._saved_pages)
        for state in self._saved_pages:
            self.__dict__.update(state)
            self._draw_chrome(total)
            super().showPage()
        super().save()

    def _draw_chrome(self, total_pages: int):
        h = self._header
        # Header band
        self.setFillColor(NAVY)
        self.rect(0, PAGE_H - HEADER_H, PAGE_W, HEADER_H, fill=1, stroke=0)
        self.setFillColor(TEAL)
        self.rect(0, PAGE_H - HEADER_H, PAGE_W, 1.2 * mm, fill=1, stroke=0)
        self.setFillColor(colors.white)
        self.setFont("Helvetica-Bold", 18)
        self.drawString(MARGIN, PAGE_H - 13 * mm, "FinShield")
        self.setFont("Helvetica", 9.5)
        self.setFillColor(colors.HexColor("#C9D6E6"))
        self.drawString(MARGIN, PAGE_H - 19.5 * mm, "Monthly Expense Report")
        self.setFillColor(colors.white)
        self.setFont("Helvetica-Bold", 13)
        self.drawRightString(PAGE_W - MARGIN, PAGE_H - 13 * mm, h["month_label"])
        self.setFont("Helvetica", 8.5)
        self.setFillColor(colors.HexColor("#C9D6E6"))
        self.drawRightString(PAGE_W - MARGIN, PAGE_H - 19.5 * mm, h["owner"])

        # Footer
        self.setStrokeColor(BORDER)
        self.setLineWidth(0.6)
        self.line(MARGIN, 13 * mm, PAGE_W - MARGIN, 13 * mm)
        self.setFont("Helvetica", 7.5)
        self.setFillColor(MUTED)
        self.drawString(MARGIN, 8.5 * mm, f"Generated on {h['generated']}  ·  Based on expenses you recorded in FinShield")
        self.drawRightString(PAGE_W - MARGIN, 8.5 * mm, f"Page {self._pageNumber} of {total_pages}")


def _kpi_cards(summary: dict, st) -> Table:
    total = Decimal(summary["total"])
    prev = Decimal(summary["previous_month_total"])
    if prev > 0:
        change = (total - prev) / prev * 100
        arrow = "+" if change > 0 else ""
        color = "#DC2626" if change > 0 else "#16A34A"
        change_html = f'<font color="{color}"><b>{arrow}{change:.0f}%</b></font>'
        change_note = f"vs {inr(prev)} last month"
    else:
        change_html = '<font color="#5B6B7F">-</font>'
        change_note = "No spending recorded last month"

    top = summary["by_category"][0] if summary["by_category"] else None
    cards = [
        ("Total spent", inr(total), f'{summary["count"]} entries'),
        ("Average per day", inr(summary["avg_per_day"], decimals=False), f'over {summary["days_counted"]} days'),
        ("Top category", CATEGORY_LABELS.get(top["category"], top["category"]) if top else "-",
         inr(top["total"]) if top else "No expenses"),
        ("Change vs last month", change_html, change_note),
    ]
    col_w = (CONTENT_W - 3 * 4 * mm) / 4
    gap = 4 * mm
    row = []
    for i, (label, value, note) in enumerate(cards):
        if i:
            row.append("")  # spacer column between cards
        row.append([Paragraph(label, st["kpi_label"]), Spacer(1, 2), Paragraph(value, st["kpi_value"]),
                    Spacer(1, 2), Paragraph(note, st["muted"])])
    spaced = Table([row], colWidths=[col_w, gap, col_w, gap, col_w, gap, col_w])
    style = [("VALIGN", (0, 0), (-1, -1), "TOP")]
    for c in (0, 2, 4, 6):
        style += [
            ("BACKGROUND", (c, 0), (c, 0), BG_ALT),
            ("BOX", (c, 0), (c, 0), 0.6, BORDER),
            ("LEFTPADDING", (c, 0), (c, 0), 9), ("RIGHTPADDING", (c, 0), (c, 0), 9),
            ("TOPPADDING", (c, 0), (c, 0), 9), ("BOTTOMPADDING", (c, 0), (c, 0), 10),
        ]
    for c in (1, 3, 5):
        style += [("LEFTPADDING", (c, 0), (c, 0), 0), ("RIGHTPADDING", (c, 0), (c, 0), 0)]
    spaced.setStyle(TableStyle(style))
    return spaced


def _category_section(summary: dict, st) -> KeepTogether:
    total = Decimal(summary["total"]) or Decimal(1)
    cats = summary["by_category"]

    donut_size = 58 * mm
    d = Drawing(donut_size, donut_size)
    pie = Pie()
    pie.x, pie.y = 4 * mm, 4 * mm
    pie.width = pie.height = donut_size - 8 * mm
    pie.data = [float(c["total"]) for c in cats]
    pie.innerRadiusFraction = 0.58
    pie.strokeColor = colors.white
    pie.strokeWidth = 1.2
    pie.simpleLabels = 1
    pie.labels = None
    for i, c in enumerate(cats):
        pie.slices[i].fillColor = colors.HexColor(CATEGORY_COLORS.get(c["category"], "#94A3B8"))
        pie.slices[i].strokeColor = colors.white
    d.add(pie)
    cx = donut_size / 2
    d.add(String(cx, cx + 1.5 * mm, inr(summary["total"]), fontName="Helvetica-Bold",
                 fontSize=9.5, fillColor=NAVY, textAnchor="middle"))
    d.add(String(cx, cx - 3 * mm, "total", fontName="Helvetica", fontSize=7,
                 fillColor=MUTED, textAnchor="middle"))

    table_w = CONTENT_W - donut_size - 6 * mm
    bar_w = 34 * mm
    rows = [[Paragraph("Category", st["th"]), Paragraph("Entries", st["th_right"]),
             Paragraph("Share", st["th"]), Paragraph("Amount", st["th_right"])]]
    for c in cats:
        share = float(Decimal(c["total"]) / total * 100)
        color = CATEGORY_COLORS.get(c["category"], "#94A3B8")
        bar = Drawing(bar_w, 7)
        bar.add(Rect(0, 1.5, bar_w - 12 * mm, 4, fillColor=BORDER, strokeColor=None, rx=2, ry=2))
        bar.add(Rect(0, 1.5, max((bar_w - 12 * mm) * share / 100, 1.5), 4,
                     fillColor=colors.HexColor(color), strokeColor=None, rx=2, ry=2))
        bar.add(String(bar_w - 10.5 * mm, 1.8, f"{share:.0f}%", fontName="Helvetica", fontSize=7.5, fillColor=MUTED))
        rows.append([
            Paragraph(f'<font color="{color}">●</font>  {CATEGORY_LABELS.get(c["category"], c["category"])}', st["cell"]),
            Paragraph(str(c["count"]), st["cell_right"]),
            bar,
            Paragraph(f"<b>{inr(c['total'])}</b>", st["cell_right"]),
        ])
    other_w = table_w - bar_w
    t = Table(rows, colWidths=[other_w * 0.48, other_w * 0.18, bar_w, other_w * 0.34], repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, BG_ALT]),
        ("LINEBELOW", (0, 1), (-1, -1), 0.4, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))

    layout = Table([[d, t]], colWidths=[donut_size + 6 * mm, table_w])
    layout.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    return KeepTogether([Paragraph("Spending by category", st["h2"]), Spacer(1, 4), layout])


def _daily_chart(summary: dict, st) -> KeepTogether:
    totals = {d["date"]: float(d["total"]) for d in summary["daily"]}
    year, month = (int(p) for p in summary["month"].split("-"))
    values = [totals.get(date(year, month, day), 0.0) for day in range(1, summary["days_in_month"] + 1)]

    height = 52 * mm
    d = Drawing(CONTENT_W, height)
    chart = VerticalBarChart()
    chart.x, chart.y = 14 * mm, 7 * mm
    chart.width, chart.height = CONTENT_W - 16 * mm, height - 11 * mm
    chart.data = [values]
    chart.bars[0].fillColor = TEAL
    chart.bars[0].strokeColor = None
    chart.barSpacing = 1
    chart.groupSpacing = 2
    chart.valueAxis.valueMin = 0
    peak = max(values) if any(values) else 100
    # Round axis steps (1k, 2k, 2.5k, 5k...) instead of peak/4 fractions.
    raw_step = peak / 4
    step = next((n * mag for mag in (1, 10, 100, 1000, 10000, 100000, 1000000)
                 for n in (1, 2, 2.5, 5) if n * mag >= raw_step), raw_step)
    chart.valueAxis.valueStep = step
    chart.valueAxis.valueMax = step * (int(peak // step) + 1)
    chart.valueAxis.labels.fontName = "Helvetica"
    chart.valueAxis.labels.fontSize = 7
    chart.valueAxis.labels.fillColor = MUTED
    chart.valueAxis.labelTextFormat = lambda v: (f"{v / 1000:g}k" if v >= 1000 else f"{v:g}")
    chart.valueAxis.strokeColor = BORDER
    chart.valueAxis.visibleGrid = 1
    chart.valueAxis.gridStrokeColor = BORDER
    chart.valueAxis.gridStrokeWidth = 0.4
    chart.categoryAxis.categoryNames = [str(i) if i in (1, 5, 10, 15, 20, 25, len(values)) else "" for i in range(1, len(values) + 1)]
    chart.categoryAxis.labels.fontName = "Helvetica"
    chart.categoryAxis.labels.fontSize = 7
    chart.categoryAxis.labels.fillColor = MUTED
    chart.categoryAxis.strokeColor = BORDER
    chart.categoryAxis.tickDown = 0
    d.add(chart)
    return KeepTogether([Paragraph("Daily spending", st["h2"]), Spacer(1, 2), d])


def _transactions_table(expenses: List[dict], st) -> Table:
    widths = [24 * mm, 28 * mm, CONTENT_W - 24 * mm - 28 * mm - 24 * mm - 30 * mm, 24 * mm, 30 * mm]
    rows = [[Paragraph(h, st["th"]) for h in ("Date", "Category", "Note")] +
            [Paragraph("Paid via", st["th"]), Paragraph("Amount", st["th_right"])]]
    for e in expenses:
        color = CATEGORY_COLORS.get(e["category"], "#94A3B8")
        rows.append([
            Paragraph(e["spent_on"].strftime("%d %b %Y"), st["cell"]),
            Paragraph(f'<font color="{color}">●</font>  {CATEGORY_LABELS.get(e["category"], e["category"])}', st["cell"]),
            Paragraph(escape(e["note"]) if e["note"] else '<font color="#5B6B7F">-</font>', st["cell"]),
            Paragraph(PAYMENT_LABELS.get(e["payment_mode"] or "", "-"), st["cell"]),
            Paragraph(inr(e["amount"], decimals=True), st["cell_right"]),
        ])
    total = sum((Decimal(e["amount"]) for e in expenses), Decimal(0))
    rows.append(["", "", "", Paragraph("<b>Total</b>", st["cell"]), Paragraph(f"<b>{inr(total, decimals=True)}</b>", st["cell_right"])])

    t = Table(rows, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, BG_ALT]),
        ("LINEBELOW", (0, 1), (-1, -2), 0.4, BORDER),
        ("LINEABOVE", (0, -1), (-1, -1), 1, NAVY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def generate_expense_pdf(summary: dict, expenses: List[dict], owner: str, month_label: str,
                         generated_at: Optional[datetime] = None) -> bytes:
    """summary: the same shape as GET /api/expenses/summary plus 'days_counted';
    expenses: dicts with spent_on (date), category, payment_mode, note, amount."""
    st = _styles()
    buffer = io.BytesIO()
    header = {
        "month_label": month_label,
        "owner": owner,
        "generated": (generated_at or datetime.now()).strftime("%d %b %Y, %I:%M %p"),
    }
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        # Frames add 6pt padding on each side; offset it so content lines up
        # exactly with the header band's text at MARGIN.
        leftMargin=MARGIN - 6, rightMargin=MARGIN - 6,
        topMargin=HEADER_H + 8 * mm, bottomMargin=20 * mm,
        title=f"FinShield Expense Report - {month_label}", author="FinShield",
    )

    story = [_kpi_cards(summary, st), Spacer(1, 8 * mm)]
    if summary["count"] == 0:
        story += [
            Paragraph("No expenses recorded", st["h2"]),
            Spacer(1, 3),
            Paragraph(f"You haven't logged any expenses for {escape(month_label)} yet. "
                      "Add them from the Expenses page in FinShield and download this report again.", st["body"]),
        ]
    else:
        story += [
            _category_section(summary, st), Spacer(1, 8 * mm),
            _daily_chart(summary, st), Spacer(1, 6 * mm),
            Paragraph("All transactions", st["h2"]), Spacer(1, 4),
            _transactions_table(expenses, st),
        ]

    doc.build(story, canvasmaker=lambda *a, **kw: _NumberedCanvas(*a, header=header, **kw))
    return buffer.getvalue()
