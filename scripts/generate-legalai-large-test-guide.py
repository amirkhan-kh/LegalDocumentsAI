#!/usr/bin/env python3
import hashlib
import json
import shutil
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output" / "pdf"
DESKTOP = Path.home() / "Desktop"
TEST_PDF_NAME = "LegalAI_20MB_All_Features_Mixed_OCR_Test.pdf"
GUIDE_PDF_NAME = "LegalAI_20MB_Test_Guide_UZ.pdf"
GUIDE_MD_NAME = "LegalAI_20MB_Test_Guide_UZ.md"
EXPECTED_NAME = "LegalAI_20MB_Expected_Findings.json"
BENCHMARK_NAME = "LegalAI_20MB_Validated_Benchmark.json"
PLAYBOOK_NAME = "LegalAI_Grounding_Playbook.md"

VALIDATED_BENCHMARK = {
    "status": "PASS",
    "qualityScore": 0.9063,
    "model": "gemini-2.5-pro",
    "transport": "gcs",
    "processingMs": 54892,
    "requestMs": 55153,
    "analysisBytes": 1849757,
    "counts": {"fields": 14, "risks": 10, "obligations": 10, "review_queue": 7, "alerts": 11},
    "pageCitationRate": 1.0,
}

PURPLE = colors.HexColor("#40349F")
PURPLE_DARK = colors.HexColor("#27205F")
PINK = colors.HexColor("#F04FA9")
CYAN = colors.HexColor("#27BDD3")
TEXT = colors.HexColor("#111827")
MUTED = colors.HexColor("#6F7A90")
LINE = colors.HexColor("#E5E8F1")
SOFT = colors.HexColor("#F7F8FC")
GREEN = colors.HexColor("#119B83")
AMBER = colors.HexColor("#AE6B0B")
RED = colors.HexColor("#E5415B")


PAGE_GUIDE = [
    {
        "page": 1,
        "title": "Tomonlar, klassifikatsiya va asosiy metadata",
        "purpose": "Selectable text. Hujjat turi, ikki tomon, til ustuvorligi, effective date, end date va signing deadline tekshiriladi.",
        "facts": "LAI-TEST-2026-07-06; Tashkent Retail Systems LLC; Nova LegalTech Solutions Ltd.; STIR 305123456; NL-884200; 2026-08-01; 2027-07-31; signing 2026-07-25.",
        "expected": "document_class=contract, language=mixed, Master Services Agreement, counterparty, 5+ reusable fields va 2026-07-25 alert.",
    },
    {
        "page": 2,
        "title": "Moliyaviy shartlar, payment va service-credit konflikti",
        "purpose": "Qiymat, valyuta, QQS, usage cap, bosqichli to'lovlar, penya va qarama-qarshi foizlar aniqlanadi.",
        "facts": "UZS 1,250,000,000 incl. VAT; USD 98,500 cap; advance 2026-07-20; penalty 0.15% daily, cap 10%; service credit 5% vs 15%.",
        "expected": "Finance field va obligationlar, dated alerts, medium/high conflict risk va review reason ichida aniq '5 percent vs 15 percent'.",
    },
    {
        "page": 3,
        "title": "OCR-only: deadline, auto-renewal va overdue ISO",
        "purpose": "Bu sahifada text layer yo'q. Gemini Pro sahifani rasm sifatida OCR qilishi kerak.",
        "facts": "DPA 2026-08-05; security evidence 2026-08-15; OCR text 2O26-09-l5; auto-renewal 12 months; 60-day notice; ISO due 2026-07-01 and overdue.",
        "expected": "Past confidence OCR field, needs_review, auto-renewal high risk, ISO high risk + high-priority review + overdue alert.",
    },
    {
        "page": 4,
        "title": "Provider va customer majburiyatlari",
        "purpose": "Owner role, due date, recurrence, category va task generation tekshiriladi.",
        "facts": "99.5% uptime; monthly report; 24-hour breach notice; logs 36 months; samples 2026-08-02; low-confidence review in 2 business days.",
        "expected": "Legal, Finance, Operations ownerlari; Reporting, Compliance, Delivery va Payment kategoriyalari; taskga aylantiriladigan 7+ obligation.",
    },
    {
        "page": 5,
        "title": "Yuqori risk bandlari",
        "purpose": "Risk klassifikatsiyasi, severity, recommendation va review queue sifati tekshiriladi.",
        "facts": "Unilateral price change; broad indemnity; 3-month liability cap; UZS 250m confidentiality penalty; cross-border transfer; audit cost; 18-month non-compete.",
        "expected": "Kamida 5 risk; broad indemnity va confidentiality penalty yuqori; manba sahifa va tavsiya mavjud.",
    },
    {
        "page": 6,
        "title": "OCR-only ruscha ilova va narx konflikti",
        "purpose": "Bu sahifa ham raster-only. Ruscha OCR va Uzbek asosiy matni bilan conflict detection tekshiriladi.",
        "facts": "RU suspension after 15 days; 5 business-day notice; Russian price UZS 1,150,000,000 without VAT vs main UZS 1,250,000,000 with VAT.",
        "expected": "language=mixed, price conflict review, pastroq confidence, page 6 citation va qiymatni silent almashtirmaslik.",
    },
    {
        "page": 7,
        "title": "English law, London arbitration va AI model guardrail",
        "purpose": "English clauses, governing law, forum va assignment risklari tekshiriladi.",
        "facts": "England and Wales; London arbitration; 24-hour breach; affiliate assignment without consent; only paid enterprise AI models.",
        "expected": "Governing law field, London arbitration high risk, affiliate assignment risk va AI guardrail summary.",
    },
    {
        "page": 8,
        "title": "Non-binding QA appendix",
        "purpose": "Kutilgan field/risk/review/alert ro'yxati berilgan, lekin appendix majburiy contract clause emas.",
        "facts": "Expected values, conflicts, overdue alerts va owner mapping.",
        "expected": "Model appendix matnini grounding sifatida ishlatishi mumkin, ammo undan yangi soxta majburiyat yaratmasligi kerak.",
    },
    {
        "page": 9,
        "title": "Route, persistence va UI population markerlari",
        "purpose": "Save'dan keyin sidebar modullari, dashboard, task va global search bo'sh qolmasligi tekshiriladi.",
        "facts": "ROUTE-* tokenlar; QA-NO-EMPTY-TASKS-AFTER-SAVE; QA-NO-ZERO-OBLIGATIONS-AFTER-SAVE.",
        "expected": "Registry, obligations, tasks, templates, analytics va Staff Lab state'i non-zero bo'lishi.",
    },
    {
        "page": 10,
        "title": "Template field library va analytics",
        "purpose": "Reusable field extraction, staging template va analytics aggregation tekshiriladi.",
        "facts": "14 template candidate: parties, number, value, dates, renewal, payment, breach hours, uptime, retention, service-credit conflict va regions.",
        "expected": "Staging template, kamida 10 field, risk/status/workload analytics non-zero.",
    },
    {
        "page": 11,
        "title": "Staff Lab, governance va accessibility",
        "purpose": "Domain/template proposal, approval workflow va UI guardraillar tekshiriladi.",
        "facts": "STAFF-LAB-AUTHORING-PROPOSAL; Draft -> Testing -> Approved -> Promoted; no free consumer AI; keyboard focus markerlari.",
        "expected": "Testing proposal, auditability, long token wrapping va keyboard-accessible controls.",
    },
    {
        "page": 12,
        "title": "Taqqoslash matnlari, signatures va acceptance",
        "purpose": "Manual comparison, final route checklist va signing deadline tekshiriladi.",
        "facts": "30 vs 45 payment days; written renewal vs auto-renewal; Uzbekistan vs English law; signatures 2026-07-25.",
        "expected": "Comparisonda payment=medium, auto-renewal=high, English law=high; signing obligation/alert va final acceptance markerlari.",
    },
]


MODULE_STEPS = [
    ("Kirish va layout", "http://localhost:5174/login manzilida admin / legal123 bilan kiring. Ikkinchi auth bosqichini tasdiqlang. UZ/RU/EN va sidebar toggle holatlarini tekshiring."),
    ("AI tahlil", "20 MiB PDFni tanlang. Badge taxminan 20.00 MiB ko'rsatadi. Yuklandi -> Tasnif -> Ajratish -> Tayyor bosqichlari va natija panelining ichki scrollini tekshiring."),
    ("Natija gate", "model=gemini-2.5-pro, transport=gcs, processing <=60000 ms, language=MIXED. Kamida 10 field, 7 risk, 7 obligation, 5 review item va 5 alert bo'lishi kerak."),
    ("Reyestr", "Bir obligation checkboxini olib tashlang, qolgan ownerlarni tekshiring va Reyestrga saqlash tugmasini bosing. Shartnomalar bo'limida Nova LegalTech va UZS 1,250,000,000 ni qidiring."),
    ("Majburiyat va vazifa", "All/Active/Overdue/Review filtrlarini sinang. Bittasini Completed, bittasini Archive qiling, bittasidan task yarating. Vazifani Pending -> Progress -> Done o'tkazing."),
    ("Taqqoslash", "12-sahifadagi reference va candidate matnlarini kiriting. Payment farqi medium, auto-renewal high, English law high chiqishi kerak."),
    ("Shablonlar", "Save'dan keyin staging template va extracted fieldlar ko'rinsin. Audit evidence nomli yangi field qo'shib ko'ring."),
    ("Bilim bazasi", "Companion LegalAI_Grounding_Playbook.md faylini domain=Compliance, language=mixed bilan yuklang. Baseline natijadan keyin qayta tahlil qilib 12-month liability cap, 12-hour breach va Tashkent seat policy farqlarini tekshiring."),
    ("Analytics", "Risk, status va workload qiymatlari nol bo'lmasin; completed/archive amallari chartlarga mos aks etsin."),
    ("AI Lab", "PDFni reference sifatida yuklang. Proposal Draft -> Testing -> Approved -> Promoted oqimini sinang; discarded proposal global template'ni o'zgartirmasligi kerak."),
    ("Global qidiruv", "Nova LegalTech, ISO 27001, UZS 1,250,000,000, auto-renewal, OVERDUE-ISO-CERTIFICATE va TEMPLATE-FIELD-LIBRARY-COMPLETE ni qidiring."),
    ("Dashboard va tizim", "KPI, top risk, deadline va task kartalari yangilansin. Test tugamaguncha refresh qilmang: workspace state hozir frontend session-memory'da."),
]


def register_fonts():
    regular = Path("/System/Library/Fonts/Supplemental/Arial.ttf")
    bold = Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf")
    if regular.exists() and bold.exists():
        pdfmetrics.registerFont(TTFont("GuideArial", str(regular)))
        pdfmetrics.registerFont(TTFont("GuideArialBold", str(bold)))
        return "GuideArial", "GuideArialBold"
    return "Helvetica", "Helvetica-Bold"


def make_styles(font, bold_font):
    sample = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("Title", parent=sample["Title"], fontName=bold_font, fontSize=26, leading=31, textColor=TEXT, alignment=TA_LEFT, spaceAfter=8),
        "subtitle": ParagraphStyle("Subtitle", parent=sample["Normal"], fontName=font, fontSize=11, leading=16, textColor=MUTED, spaceAfter=18),
        "h1": ParagraphStyle("H1", parent=sample["Heading1"], fontName=bold_font, fontSize=18, leading=22, textColor=PURPLE_DARK, spaceBefore=8, spaceAfter=10),
        "h2": ParagraphStyle("H2", parent=sample["Heading2"], fontName=bold_font, fontSize=13, leading=17, textColor=PURPLE, spaceBefore=8, spaceAfter=5),
        "body": ParagraphStyle("Body", parent=sample["BodyText"], fontName=font, fontSize=9.3, leading=13.2, textColor=TEXT, spaceAfter=6),
        "small": ParagraphStyle("Small", parent=sample["BodyText"], fontName=font, fontSize=8, leading=11, textColor=MUTED, spaceAfter=4),
        "callout": ParagraphStyle("Callout", parent=sample["BodyText"], fontName=font, fontSize=9.2, leading=13, textColor=PURPLE_DARK),
        "center": ParagraphStyle("Center", parent=sample["BodyText"], fontName=bold_font, fontSize=10, leading=14, textColor=PURPLE, alignment=TA_CENTER),
    }


def page_decor(canvas, doc, font, bold_font):
    width, height = A4
    canvas.saveState()
    canvas.setFillColor(SOFT)
    canvas.rect(0, 0, width, height, stroke=0, fill=1)
    canvas.setFillColor(colors.white)
    canvas.roundRect(14 * mm, 13 * mm, width - 28 * mm, height - 26 * mm, 5 * mm, stroke=0, fill=1)
    canvas.setFillColor(PURPLE)
    canvas.rect(14 * mm, height - 17 * mm, (width - 28 * mm) * 0.34, 2.2 * mm, stroke=0, fill=1)
    canvas.setFillColor(PINK)
    canvas.rect(14 * mm + (width - 28 * mm) * 0.34, height - 17 * mm, (width - 28 * mm) * 0.33, 2.2 * mm, stroke=0, fill=1)
    canvas.setFillColor(CYAN)
    canvas.rect(14 * mm + (width - 28 * mm) * 0.67, height - 17 * mm, (width - 28 * mm) * 0.33, 2.2 * mm, stroke=0, fill=1)
    canvas.setFont(bold_font, 9)
    canvas.setFillColor(PURPLE_DARK)
    canvas.drawString(20 * mm, height - 24 * mm, "LegalAI QA Guide")
    canvas.setFont(font, 8)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(width - 20 * mm, height - 24 * mm, "20 MiB Full Capability Test")
    canvas.setStrokeColor(LINE)
    canvas.line(20 * mm, 18 * mm, width - 20 * mm, 18 * mm)
    canvas.setFont(font, 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(20 * mm, 12.5 * mm, "Fictional authorized QA artifact - not a production agreement")
    canvas.drawRightString(width - 20 * mm, 12.5 * mm, f"Page {doc.page}")
    canvas.restoreState()


def info_box(text, styles, tone="info"):
    color = {"info": PURPLE, "success": GREEN, "warning": AMBER, "danger": RED}[tone]
    bg = {"info": colors.HexColor("#F1F0FB"), "success": colors.HexColor("#E8FAF6"), "warning": colors.HexColor("#FFF6E4"), "danger": colors.HexColor("#FFF0F2")}[tone]
    table = Table([[Paragraph(text, styles["callout"])]], colWidths=[160 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("BOX", (0, 0), (-1, -1), 0.8, color),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return table


def build_guide(test_pdf, guide_pdf, sha256):
    font, bold_font = register_fonts()
    styles = make_styles(font, bold_font)
    size_bytes = test_pdf.stat().st_size
    doc = SimpleDocTemplate(
        str(guide_pdf),
        pagesize=A4,
        rightMargin=22 * mm,
        leftMargin=22 * mm,
        topMargin=31 * mm,
        bottomMargin=24 * mm,
        title="LegalAI 20 MiB Test Guide",
        author="LegalAI QA",
    )
    story = []
    story.append(Spacer(1, 10 * mm))
    story.append(Paragraph("LegalAI 20 MiB Full Capability Test", styles["title"]))
    story.append(Paragraph("Sahifa-bay-sahifa tahlil qo'llanmasi va end-to-end QA checklist", styles["subtitle"]))
    summary = [
        ["Test PDF", TEST_PDF_NAME],
        ["Hajm", f"{size_bytes:,} bytes / {size_bytes / 1024 / 1024:.4f} MiB"],
        ["Sahifa", "12 total; 3 va 6-sahifalar OCR-only raster"],
        ["Model gate", "gemini-2.5-pro"],
        ["Transport gate", "gcs"],
        ["Latency gate", "processing_ms <= 60000"],
        ["Real benchmark", "PASS 90.63%; 54,892 ms; 14/10/10/7/11"],
        ["SHA-256", sha256],
    ]
    table = Table(summary, colWidths=[38 * mm, 122 * mm])
    table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), bold_font),
        ("FONTNAME", (1, 0), (1, -1), font),
        ("FONTSIZE", (0, 0), (-1, -1), 8.4),
        ("TEXTCOLOR", (0, 0), (0, -1), PURPLE_DARK),
        ("TEXTCOLOR", (1, 0), (1, -1), TEXT),
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.6, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(table)
    story.append(Spacer(1, 7 * mm))
    story.append(info_box("<b>Muhim:</b> fayl hajmining asosiy qismi PDF parser e'tiborsiz qoldiradigan inert comment padding. Backend 20 MiB uploadni tekshiradi, keyin attachment/catalog ma'lumotlarini tashlab, faqat 12 sahifani page-only nusxaga ko'chiradi. Shu sabab Vertex tahlili 60 soniyalik gate ichida qoladi.", styles, "warning"))
    story.append(Spacer(1, 5 * mm))
    story.append(info_box("Barcha kompaniya, shaxs, email va shartlar sintetik. Hujjat faqat ruxsat etilgan QA uchun; real yuridik bitim emas.", styles, "danger"))
    story.append(PageBreak())

    story.append(Paragraph("1. Tezkor ishga tushirish", styles["h1"]))
    quick = [
        "LegalAI server ishlayotganini tekshiring: <b>http://localhost:5174</b>.",
        "Login: <b>admin</b>; parol: <b>legal123</b>; ikkinchi xavfsizlik bosqichini tasdiqlang.",
        "AI tahlil bo'limida 20 MiB PDFni tanlang va PDF tahlilni boshlash tugmasini bosing.",
        "Tahlil odatda 40-60 soniya. 60 soniyadan oshsa hard timeout qaytishi mumkin.",
        "Natija chiqqach ichki scroll bilan barcha field, summary, risk, obligation va alert kartalarini ko'ring.",
        "E2E test tugamaguncha browser refresh qilmang: workspace ma'lumoti session-memory'da saqlanadi.",
    ]
    for index, item in enumerate(quick, 1):
        story.append(Paragraph(f"<b>{index}.</b> {item}", styles["body"]))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("Asosiy pass gate", styles["h2"]))
    gates = [
        ["Gate", "PASS sharti"],
        ["Model", "gemini-2.5-pro"],
        ["Transport", "gcs"],
        ["Vaqt", "processing_ms <= 60000"],
        ["Fields", ">=10; aniq qiymatlar va page citation"],
        ["Risks", ">=7; severity va recommendation"],
        ["Obligations", ">=7; owner, due/deadline, category"],
        ["Review queue", ">=5; generic emas, aniq conflict/OCR sababi"],
        ["Alerts", ">=5; trigger, owner, days_before, source"],
        ["Citation", ">=75% field/risk/obligation sahifa bilan"],
    ]
    gate_table = Table(gates, colWidths=[44 * mm, 116 * mm], repeatRows=1)
    gate_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), bold_font),
        ("FONTNAME", (0, 1), (-1, -1), font),
        ("BACKGROUND", (0, 0), (-1, 0), PURPLE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("GRID", (0, 0), (-1, -1), 0.5, LINE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SOFT]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(gate_table)
    story.append(PageBreak())

    story.append(Paragraph("2. Har bir sahifa nimani test qiladi", styles["h1"]))
    for item in PAGE_GUIDE:
        block = [
            Paragraph(f"Sahifa {item['page']}: {item['title']}", styles["h2"]),
            Paragraph(f"<b>Maqsad:</b> {item['purpose']}", styles["body"]),
            Paragraph(f"<b>Aniq faktlar:</b> {item['facts']}", styles["body"]),
            Paragraph(f"<b>Kutilgan AI natijasi:</b> {item['expected']}", styles["body"]),
            Spacer(1, 2 * mm),
        ]
        story.append(KeepTogether(block))
    story.append(Spacer(1, 4 * mm))

    story.append(Paragraph("3. Barcha LegalAI modullarini sinash", styles["h1"]))
    for index, (title, body) in enumerate(MODULE_STEPS, 1):
        story.append(KeepTogether([
            Paragraph(f"{index}. {title}", styles["h2"]),
            Paragraph(body, styles["body"]),
        ]))
    story.append(Spacer(1, 4 * mm))

    story.append(Paragraph("4. Golden qiymatlar va qidiruv markerlari", styles["h1"]))
    fields = [
        ["Field", "Kutilgan qiymat", "Sahifa"],
        ["Contract number", "LAI-TEST-2026-07-06", "1"],
        ["Customer", "Tashkent Retail Systems LLC", "1"],
        ["Provider", "Nova LegalTech Solutions Ltd.", "1"],
        ["Effective date", "2026-08-01", "1"],
        ["End date", "2027-07-31", "1"],
        ["Total value", "UZS 1,250,000,000 incl. VAT", "2"],
        ["Usage cap", "USD 98,500", "2"],
        ["Penalty", "0.15% daily; cap 10%", "2"],
        ["Non-renewal", "60 days; final 2027-06-01", "3 OCR"],
        ["Breach notice", "24 hours", "4/7"],
        ["Uptime", "99.5% monthly", "4"],
        ["Log retention", "36 months", "4"],
    ]
    field_table = Table(fields, colWidths=[42 * mm, 91 * mm, 27 * mm], repeatRows=1)
    field_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), bold_font),
        ("FONTNAME", (0, 1), (-1, -1), font),
        ("BACKGROUND", (0, 0), (-1, 0), PURPLE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, LINE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SOFT]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(field_table)
    story.append(Spacer(1, 5 * mm))
    story.append(Paragraph("Qidiruv markerlari", styles["h2"]))
    markers = "Nova LegalTech | UZS 1,250,000,000 | USD 98,500 | RISK-AUTO-RENEWAL-60 | OVERDUE-ISO-CERTIFICATE | CONFLICT-SERVICE-CREDIT-5-VS-15 | TEMPLATE-FIELD-LIBRARY-COMPLETE | STAFF-LAB-AUTHORING-PROPOSAL"
    story.append(info_box(markers, styles, "info"))
    story.append(Spacer(1, 5 * mm))
    story.append(Paragraph("Kritik false-positive tekshiruvi", styles["h2"]))
    story.append(Paragraph("8-sahifa <b>NON-BINDING QA APPENDIX</b>. Undagi checklist alohida yangi obligation sifatida saqlansa, bu false positive. 3 va 6-sahifadagi OCR qiymatlari silent ravishda to'g'rilanmasdan reviewga yuborilishi kerak.", styles["body"]))
    story.append(Spacer(1, 4 * mm))

    story.append(Paragraph("5. Texnik va yakuniy checklist", styles["h1"]))
    checks = [
        "PDF 20-30 MiB oralig'ida va 50 MiB upload limitidan kichik.",
        "12 sahifa; 3 va 6 OCR-only; boshqa sahifalar selectable text.",
        "Encrypted=no, JavaScript=no, PDF header va EOF valid.",
        "Upload paytida local temp va GCS temporary object requestdan keyin o'chadi.",
        "Health: ready=true, gcsAvailable=true, inlineFallbackEnabled=false.",
        "Natija paneli viewport bottomidan 20px yuqorida tugaydi va ichki scroll ishlaydi.",
        "Main max-width 1250px; expanded/collapsed sidebar holatida markazda.",
        "Desktop, 125% zoom va tor viewportda review grid ichki strukturasi buzilmaydi.",
        "E2E tugagach npm run build, npm audit va evaluator reportini saqlang.",
    ]
    for item in checks:
        story.append(Paragraph(f"[ ] {item}", styles["body"]))
    story.append(Spacer(1, 5 * mm))
    story.append(Paragraph("Terminal verification", styles["h2"]))
    commands = f"pdfinfo ~/Desktop/{TEST_PDF_NAME}<br/>shasum -a 256 ~/Desktop/{TEST_PDF_NAME}<br/>npm run eval:ml"
    story.append(info_box(commands, styles, "success"))
    story.append(Spacer(1, 8 * mm))
    record = [
        ["Test yozuvi", "Qiymat"],
        ["Sana / tester", "____________________________"],
        ["processing_ms", "____________________________"],
        ["quality score", "____________________________"],
        ["model / transport", "____________________________"],
        ["field / risk / obligation", "____________________________"],
        ["review / alert", "____________________________"],
        ["Final status", "PASS / FAIL"],
    ]
    record_table = Table(record, colWidths=[54 * mm, 106 * mm])
    record_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), bold_font),
        ("FONTNAME", (0, 1), (-1, -1), font),
        ("BACKGROUND", (0, 0), (-1, 0), PURPLE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("GRID", (0, 0), (-1, -1), 0.6, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(record_table)
    doc.build(story, onFirstPage=lambda c, d: page_decor(c, d, font, bold_font), onLaterPages=lambda c, d: page_decor(c, d, font, bold_font))


def build_markdown(test_pdf, sha256):
    lines = [
        "# LegalAI 20 MiB Full Capability Test Guide",
        "",
        f"- Test PDF: `{TEST_PDF_NAME}`",
        f"- Hajm: `{test_pdf.stat().st_size:,}` bytes (`{test_pdf.stat().st_size / 1024 / 1024:.4f} MiB`)",
        "- Sahifa: `12`; 3 va 6-sahifalar OCR-only raster",
        "- Model gate: `gemini-2.5-pro`",
        "- Transport gate: `gcs`",
        "- Latency gate: `processing_ms <= 60000`",
        f"- SHA-256: `{sha256}`",
        "",
        "> Hajmning asosiy qismi inert PDF comment padding. Backend uploadni 20 MiB holida validatsiya qiladi, Vertex uchun esa faqat sahifalarni 1.85 MiB page-only nusxaga repack qiladi.",
        "",
        "> Validated benchmark: PASS 90.63%, gemini-2.5-pro, GCS, processing 54,892 ms; 14 field, 10 risk, 10 obligation, 7 review, 11 alert, 100% page citation.",
        "",
        "## Page-by-page",
        "",
    ]
    for item in PAGE_GUIDE:
        lines.extend([
            f"### {item['page']}-sahifa - {item['title']}",
            "",
            f"- Maqsad: {item['purpose']}",
            f"- Faktlar: {item['facts']}",
            f"- Kutilgan: {item['expected']}",
            "",
        ])
    lines.extend(["## End-to-end modullar", ""])
    for index, (title, body) in enumerate(MODULE_STEPS, 1):
        lines.append(f"{index}. **{title}:** {body}")
    lines.extend([
        "",
        "## PASS gate",
        "",
        "- Fields >= 10",
        "- Risks >= 7",
        "- Obligations >= 7",
        "- Review queue >= 5",
        "- Alerts >= 5",
        "- Page citation >= 75%",
        "- Model = gemini-2.5-pro",
        "- Transport = gcs",
        "- processing_ms <= 60000",
        "",
        "Test tugamaguncha browser refresh qilmang; workspace state session-memory'da.",
    ])
    return "\n".join(lines) + "\n"


def build_expected(sha256, size_bytes):
    return {
        "artifact": {
            "fileName": TEST_PDF_NAME,
            "sha256": sha256,
            "sizeBytes": size_bytes,
            "sizeMiB": round(size_bytes / 1024 / 1024, 4),
            "pages": 12,
            "ocrOnlyPages": [3, 6],
            "sizePadding": "inert PDF comments before startxref",
        },
        "gates": {
            "model": "gemini-2.5-pro",
            "transport": "gcs",
            "maxProcessingMs": 60000,
            "minimums": {"fields": 10, "risks": 7, "obligations": 7, "review_queue": 5, "alerts": 5, "pageCitationRate": 0.75},
        },
        "validatedBenchmark": VALIDATED_BENCHMARK,
        "document": {
            "document_class": "contract",
            "language": "mixed",
            "contract_number": "LAI-TEST-2026-07-06",
            "customer": "Tashkent Retail Systems LLC",
            "provider": "Nova LegalTech Solutions Ltd.",
            "effective_date": "2026-08-01",
            "end_date": "2027-07-31",
            "value": "UZS 1,250,000,000",
            "usage_cap": "USD 98,500",
        },
        "requiredRisks": [
            "service credit 5 percent vs 15 percent",
            "auto-renewal 60-day notice",
            "overdue ISO 27001 certificate",
            "unilateral price change",
            "broad indemnity",
            "high confidentiality penalty",
            "London arbitration",
            "affiliate assignment without consent",
        ],
        "requiredReview": [
            "2O26-09-l5 OCR ambiguity",
            "UZS 1,150,000,000 vs UZS 1,250,000,000",
            "service credit 5 percent vs 15 percent",
            "ISO 27001 overdue since 2026-07-01",
            "auto-renewal 60-day deadline",
        ],
        "requiredAlerts": ["2026-07-01", "2026-07-20", "2026-07-25", "2026-08-02", "2026-08-05", "2026-08-15", "2026-08-30"],
        "searchTokens": [
            "RISK-AUTO-RENEWAL-60",
            "OVERDUE-ISO-CERTIFICATE",
            "CONFLICT-SERVICE-CREDIT-5-VS-15",
            "TEMPLATE-FIELD-LIBRARY-COMPLETE",
            "STAFF-LAB-AUTHORING-PROPOSAL",
        ],
    }


def build_playbook():
    return """---
id: legalai-client-grounding-playbook
language: mixed
domain: compliance
authority: client-policy
---

# LegalAI Client Grounding Playbook

Bu qo'llanma synthetic QA uchun. Uni baseline PDF tahlilidan keyin Bilim bazasiga yuklang va PDFni qayta tahlil qilib RAG grounding farqini tekshiring.

## Liability policy

Provider liability cap odatda kamida oxirgi 12 oylik fees miqdorida bo'lishi kerak. Uch oylik fee cap legal review va Management approval talab qiladi.

## Incident policy

Confirmed yoki suspected personal-data incident haqida ichki Legal va Security guruhlariga 12 soat ichida xabar berilishi kerak. Contractdagi 24-hour notice policy gap sifatida ko'rsatiladi.

## Arbitration policy

Preferred governing law - Republic of Uzbekistan. Preferred arbitration seat - Tashkent. London yoki boshqa xorijiy forum Legal approval talab qiladi.

## Renewal policy

Auto-renewal faqat 90-day reminder, documented owner va opt-out evidence bo'lsa qabul qilinadi. 60-day notice window high-priority alert yaratishi kerak.

## AI guardrail

Customer hujjatlari faqat paid enterprise AI yoki Vertex-class service bilan qayta ishlanadi. Free consumer accounts, shared public accounts va default persistent memory taqiqlanadi. Confidence 85 foizdan past bo'lsa human review majburiy.
"""


def build_benchmark(sha256, size_bytes):
    return {
        "artifact": {
            "fileName": TEST_PDF_NAME,
            "sha256": sha256,
            "sizeBytes": size_bytes,
            "sizeMiB": round(size_bytes / 1024 / 1024, 4),
        },
        "backendPreparation": {
            "repacked": True,
            "uploadedBytes": size_bytes,
            "analysisBytes": VALIDATED_BENCHMARK["analysisBytes"],
        },
        "result": VALIDATED_BENCHMARK,
        "report": "reports/evaluation/evaluation-1784345278386.json",
    }


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    test_pdf = OUTPUT_DIR / TEST_PDF_NAME
    if not test_pdf.exists():
        desktop_pdf = DESKTOP / TEST_PDF_NAME
        if not desktop_pdf.exists():
            raise SystemExit(f"Test PDF topilmadi: {test_pdf}")
        shutil.copy2(desktop_pdf, test_pdf)
    sha256 = hashlib.sha256(test_pdf.read_bytes()).hexdigest()

    guide_pdf = OUTPUT_DIR / GUIDE_PDF_NAME
    build_guide(test_pdf, guide_pdf, sha256)
    guide_md = build_markdown(test_pdf, sha256)
    expected = build_expected(sha256, test_pdf.stat().st_size)
    benchmark = build_benchmark(sha256, test_pdf.stat().st_size)
    playbook = build_playbook()

    (OUTPUT_DIR / GUIDE_MD_NAME).write_text(guide_md, encoding="utf-8")
    (OUTPUT_DIR / EXPECTED_NAME).write_text(json.dumps(expected, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUTPUT_DIR / BENCHMARK_NAME).write_text(json.dumps(benchmark, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUTPUT_DIR / PLAYBOOK_NAME).write_text(playbook, encoding="utf-8")

    for name in [TEST_PDF_NAME, GUIDE_PDF_NAME, GUIDE_MD_NAME, EXPECTED_NAME, BENCHMARK_NAME, PLAYBOOK_NAME]:
        shutil.copy2(OUTPUT_DIR / name, DESKTOP / name)

    print(json.dumps({
        "testPdf": str(DESKTOP / TEST_PDF_NAME),
        "guidePdf": str(DESKTOP / GUIDE_PDF_NAME),
        "guideMarkdown": str(DESKTOP / GUIDE_MD_NAME),
        "expectedFindings": str(DESKTOP / EXPECTED_NAME),
        "validatedBenchmark": str(DESKTOP / BENCHMARK_NAME),
        "groundingPlaybook": str(DESKTOP / PLAYBOOK_NAME),
        "sha256": sha256,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
