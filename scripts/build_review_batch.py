#!/usr/bin/env python3
"""Build the review-ui batch for THIS exercise from the real PDFs and, optionally, a rows CSV.

Usage (from the exercise folder):
  python3 -I scripts/build_review_batch.py                                   # pages only: browse the PDFs, add rows by hand
  python3 -I scripts/build_review_batch.py --rows rows/rows_run1_verified.csv --run run1

Writes, under review-ui/public/:
  pages/<LABEL>/pNNN.png          page images (PDF page numbers, 1-based)
  pages/<LABEL>/pNNN.words.json   word boxes (fractions of page size) for drag-to-select and highlights
  data/batch.real.json            documents + rows in the review-ui shape

Row mapping from the pipeline CSV (collect_rows.py + verify_quotes.py columns):
  code -> label, inferred -> evidenceType/inferredNote, entity -> entityNamed, speaker -> section,
  confidence medium/low -> needs_look flag, verified == no -> quote_not_on_page flag, n_words > 40 -> over_limit.
"""
import argparse
import csv
import json
import pathlib

try:
    import pymupdf
except ImportError:  # older PyMuPDF
    import fitz as pymupdf

DOCS = [
    # label (dir + docId), pdf, docType (matches the exercise's `doc` values), year, display name
    ("CHNA", "docs/1_4_CHNA.pdf", "CHNA", 2023, "Providence Valdez Medical Center CHNA 2023"),
    ("IS", "docs/1_4_IS.pdf", "implementation strategy", 2024, "Providence Valdez Medical Center Implementation Strategy 2024-2026"),
]
DOC_TO_LABEL = {"CHNA": "CHNA", "implementation strategy": "IS"}
SPEAKER_TO_SECTION = {"hospital": "", "key_informant": "Key informant interview", "survey_respondent": "Survey", "resource_list": "Resource list", "other": ""}
TRUE = {"true", "1", "yes", "y"}


def norm_box(rect, page_rect):
    w, h = page_rect.width, page_rect.height
    return {"x": round(rect.x0 / w, 4), "y": round(rect.y0 / h, 4), "w": round((rect.x1 - rect.x0) / w, 4), "h": round((rect.y1 - rect.y0) / h, 4)}


def quote_boxes(page, quote):
    q = quote.strip().strip('"“”‘’\'')
    for cand in (q, q.rstrip(".,;:"), q.replace("’", "'").replace("'", "’")):
        rects = page.search_for(cand) if cand else []
        if rects:
            return [norm_box(r, page.rect) for r in rects]
    return None


def build_doc(label, pdf, doc_type, year, name, out, dpi, render):
    doc = pymupdf.open(pdf)
    pdir = out / "pages" / label
    pdir.mkdir(parents=True, exist_ok=True)
    texts = {}
    for i, page in enumerate(doc, start=1):
        texts[str(i)] = page.get_text("text")
        words = [{**norm_box(pymupdf.Rect(w[:4]), page.rect), "text": w[4]} for w in page.get_text("words")]
        (pdir / f"p{i:03d}.words.json").write_text(json.dumps(words, ensure_ascii=False), encoding="utf-8")
        png = pdir / f"p{i:03d}.png"
        if render or not png.exists():
            page.get_pixmap(dpi=dpi).save(png)
    return doc, {
        "id": label, "sourceName": name, "docType": doc_type, "year": year, "pageCount": len(doc),
        "pageImage": {"kind": "template", "template": f"/pages/{label}/p{{page}}.png", "pad": 3},
        "wordsTemplate": f"/pages/{label}/p{{page}}.words.json",
        "pageTexts": texts, "skippedPages": [],
    }


def build_rows(csv_path, pdfs, run_id, version, limit=40):
    rows = []
    with open(csv_path, encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            label = DOC_TO_LABEL.get(r["doc"].strip())
            if not label:
                continue
            page_no = int(r["pdf_page"])
            inferred = str(r.get("inferred", "")).strip().lower() in TRUE
            conf = str(r.get("confidence", "")).strip().lower()
            note = (r.get("note") or "").strip()
            issues = (r.get("issues") or "").strip()
            flags, flag_notes = [], {}
            if str(r.get("verified", "")).strip().lower() == "no" and ("not found" in issues or "NOT on page" in issues):
                flags.append("quote_not_on_page")
                flag_notes["quote_not_on_page"] = issues.split(";")[0].strip().replace("quote NOT on page", "Not on page").replace("quote not found verbatim anywhere in", "Not found anywhere in")
            if conf in ("medium", "low"):
                flags.append("needs_look")
                flag_notes["needs_look"] = f"Marked as less certain: {note}" if note and not inferred else "Marked as less certain"
            if int(r.get("n_words") or len(r["quote"].split())) > limit:
                flags.append("over_limit")
            if inferred:
                flags.append("inferred")
            page = pdfs[label][page_no - 1]
            row = {
                "id": r.get("row_id") or f"{run_id}-{len(rows) + 1:03d}",
                "docId": label, "pdfPage": page_no, "label": r["code"].strip(), "role": r["role"].strip(),
                "quote": " ".join(r["quote"].split()),
                "evidenceType": "inferred" if inferred else "stated",
                "inferredNote": note if inferred else "",
                "entityNamed": (r.get("entity") or "").strip(),
                "population": "",
                "section": SPEAKER_TO_SECTION.get((r.get("speaker") or "").strip(), ""),
                "flags": flags, "status": "pending", "labelSetVersion": version, "runId": r.get("run") or run_id,
            }
            if flag_notes:
                row["flagNotes"] = flag_notes
            boxes = quote_boxes(page, row["quote"])
            if boxes:
                row["quoteBoxes"] = boxes
            rows.append(row)
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rows", default=None, help="rows CSV from collect_rows.py (verified version preferred)")
    ap.add_argument("--run", default="run1")
    ap.add_argument("--out", default="review-ui/public")
    ap.add_argument("--dpi", type=int, default=100)
    ap.add_argument("--render", action="store_true", help="re-render PNGs even if they exist")
    ap.add_argument("--label-version", default="codebook-sample-14-v1")
    a = ap.parse_args()

    out = pathlib.Path(a.out)
    (out / "data").mkdir(parents=True, exist_ok=True)
    pdfs, documents = {}, []
    for label, pdf, doc_type, year, name in DOCS:
        doc, dj = build_doc(label, pdf, doc_type, year, name, out, a.dpi, a.render)
        pdfs[label] = doc
        documents.append(dj)
        print(f"{label}: {len(doc)} pages -> {out/'pages'/label}/")

    rows = build_rows(a.rows, pdfs, a.run, a.label_version) if a.rows else []
    batch = {"runId": a.run, "documents": documents, "rows": rows}
    (out / "data" / "batch.real.json").write_text(json.dumps(batch, ensure_ascii=False), encoding="utf-8")
    with_boxes = sum(1 for r in rows if r.get("quoteBoxes"))
    print(f"{len(rows)} rows ({with_boxes} with quote boxes) -> {out/'data'/'batch.real.json'}")


if __name__ == "__main__":
    main()
