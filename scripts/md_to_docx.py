#!/usr/bin/env python3
"""Convert a markdown file (headings, paragraphs, bullet/numbered lists, pipe tables, bold, italic,
inline code) to .docx with python-docx.  Usage: python3 scripts/md_to_docx.py writeup/writeup.md writeup/writeup.docx"""
import re
import sys

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt, RGBColor

INLINE = re.compile(r"(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)")


def add_runs(par, text):
    for part in INLINE.split(text):
        if not part:
            continue
        if part.startswith("**") and part.endswith("**"):
            r = par.add_run(part[2:-2]); r.bold = True
        elif part.startswith("*") and part.endswith("*"):
            r = par.add_run(part[1:-1]); r.italic = True
        elif part.startswith("`") and part.endswith("`"):
            r = par.add_run(part[1:-1]); r.font.name = "Menlo"; r.font.size = Pt(9.5); r.font.color.rgb = RGBColor(0x33, 0x33, 0x33)
        else:
            par.add_run(part)


def flush_table(doc, rows):
    cells = [[c.strip() for c in r.strip().strip("|").split("|")] for r in rows if not re.match(r"^\s*\|?\s*:?-{2,}", r)]
    if not cells:
        return
    ncol = max(len(r) for r in cells)
    t = doc.add_table(rows=len(cells), cols=ncol)
    t.style = "Light Grid Accent 1"
    for i, r in enumerate(cells):
        for j in range(ncol):
            cell = t.cell(i, j)
            cell.text = ""
            p = cell.paragraphs[0]
            add_runs(p, r[j] if j < len(r) else "")
            for run in p.runs:
                run.font.size = Pt(9.5)
                if i == 0:
                    run.bold = True
    doc.add_paragraph()


def convert(src, dst):
    doc = Document()
    st = doc.styles["Normal"]; st.font.name = "Calibri"; st.font.size = Pt(11)
    lines = open(src, encoding="utf-8").read().splitlines()
    table, para = [], []

    def flush_para():
        if para:
            p = doc.add_paragraph(); add_runs(p, " ".join(s.strip() for s in para)); para.clear()

    for line in lines + [""]:
        if line.strip().startswith("|"):
            flush_para(); table.append(line); continue
        if table:
            flush_table(doc, table); table = []
        if not line.strip() or line.strip() == "---":
            flush_para(); continue
        m = re.match(r"^(#{1,6})\s+(.*)", line)
        if m:
            flush_para(); doc.add_heading(m.group(2).strip(), level=min(len(m.group(1)), 4)); continue
        m = re.match(r"^\s*[-*]\s+(.*)", line)
        if m:
            flush_para(); p = doc.add_paragraph(style="List Bullet"); add_runs(p, m.group(1)); continue
        m = re.match(r"^\s*\d+\.\s+(.*)", line)
        if m:
            flush_para(); p = doc.add_paragraph(style="List Number"); add_runs(p, m.group(1)); continue
        para.append(line)
    doc.save(dst)
    print(f"wrote {dst}")


if __name__ == "__main__":
    convert(sys.argv[1], sys.argv[2])
