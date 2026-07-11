#!/usr/bin/env python3
from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "test-fixtures" / "legalai-full-feature-test-contract.txt"
OUTPUT = Path("/Users/amirxon/Desktop/LegalAI_Full_System_Test_Contract.pdf")
FONT_PATH = Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf")
FONT_NAME = "ArialUnicode"


def split_pages(text: str) -> list[str]:
    return [part.strip("\n") for part in text.split("\n=== PAGE BREAK ===\n")]


def wrap_line(text: str, max_width: float, font_size: float) -> list[str]:
    if not text:
        return [""]
    indent = len(text) - len(text.lstrip(" "))
    prefix = " " * indent
    words = text.split(" ")
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if pdfmetrics.stringWidth(candidate, FONT_NAME, font_size) <= max_width:
            current = candidate
            continue
        if current:
            lines.append(current)
        current = f"{prefix}{word}" if lines else word
    if current:
        lines.append(current)
    return lines


def draw_page(pdf: canvas.Canvas, page_text: str, page_number: int, total_pages: int) -> None:
    width, height = letter
    margin_x = 36
    top = height - 36
    bottom = 34
    font_size = 7.8
    leading = 9.4
    max_width = width - margin_x * 2

    pdf.setFont(FONT_NAME, 8.2)
    pdf.drawString(margin_x, height - 22, "LegalAI Full System Test Contract")
    pdf.drawRightString(width - margin_x, height - 22, f"Page {page_number} of {total_pages}")
    pdf.line(margin_x, height - 28, width - margin_x, height - 28)

    y = top - 12
    pdf.setFont(FONT_NAME, font_size)
    for raw_line in page_text.splitlines():
        for line in wrap_line(raw_line, max_width, font_size):
            if y < bottom:
                pdf.showPage()
                pdf.setFont(FONT_NAME, font_size)
                y = top
            pdf.drawString(margin_x, y, line)
            y -= leading

    pdf.setFont(FONT_NAME, 7)
    pdf.drawString(margin_x, 18, "Synthetic QA PDF for LegalAI routing, extraction, obligations, tasks, templates, analytics and staff lab.")
    pdf.showPage()


def main() -> None:
    if not FONT_PATH.exists():
        raise SystemExit(f"Font not found: {FONT_PATH}")
    pdfmetrics.registerFont(TTFont(FONT_NAME, str(FONT_PATH)))

    pages = split_pages(SOURCE.read_text(encoding="utf-8"))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    pdf = canvas.Canvas(str(OUTPUT), pagesize=letter)
    pdf.setTitle("LegalAI Full System Test Contract")
    pdf.setAuthor("LegalAI QA")
    for index, page in enumerate(pages, start=1):
        draw_page(pdf, page, index, len(pages))
    pdf.save()
    print(f"created {OUTPUT} with {len(pages)} logical pages")


if __name__ == "__main__":
    main()
