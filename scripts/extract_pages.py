#!/usr/bin/env python3
"""Dump every page of a PDF to its own text file, numbered by PDF page (1 = first page in the viewer).

Usage:
  python3 -I scripts/extract_pages.py docs/chna.pdf CHNA --render 23,24
  python3 -I scripts/extract_pages.py docs/implementation_strategy.pdf IS --render 11,12

Writes work/pages/<LABEL>/p<NNN>.txt for every page, p<NNN>.png for --render pages
(useful for chart / infographic pages), and index.tsv (pdf_page, n_words, first_line)
so you can see printed-vs-PDF page offsets and find low-text (chart) pages.
"""
import argparse
import pathlib

try:
    import pymupdf as fitz  # PyMuPDF >= 1.24
except ImportError:  # older PyMuPDF
    import fitz


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("label", help="short label used in work/pages/<label>, e.g. CHNA or IS")
    ap.add_argument("--render", default="", help="comma-separated PDF pages to also save as PNG")
    ap.add_argument("--dpi", type=int, default=130)
    ap.add_argument("--out", default="work/pages")
    a = ap.parse_args()

    out = pathlib.Path(a.out) / a.label
    out.mkdir(parents=True, exist_ok=True)
    render = {int(x) for x in a.render.split(",") if x.strip()}

    doc = fitz.open(a.pdf)
    index = []
    for i, page in enumerate(doc, start=1):  # PDF page numbers are 1-based
        text = page.get_text("text")
        (out / f"p{i:03d}.txt").write_text(text, encoding="utf-8")
        first = next((ln.strip() for ln in text.splitlines() if ln.strip()), "")
        index.append((i, len(text.split()), first[:90].replace("\t", " ")))
        if i in render:
            page.get_pixmap(dpi=a.dpi).save(out / f"p{i:03d}.png")

    (out / "index.tsv").write_text(
        "pdf_page\tn_words\tfirst_line\n" + "\n".join(f"{p}\t{n}\t{f}" for p, n, f in index) + "\n",
        encoding="utf-8",
    )
    low = [str(p) for p, n, _ in index if n < 40]
    print(f"{a.label}: {len(doc)} pages -> {out}/")
    print(f"low-text pages (<40 words; likely charts, images, or blank): {', '.join(low) or 'none'}")
    if render:
        print(f"rendered PNG for pages: {sorted(render)}")


if __name__ == "__main__":
    main()
