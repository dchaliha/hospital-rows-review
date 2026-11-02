#!/usr/bin/env python3
"""Merge per-page JSON codings into one rows CSV.

Usage:
  python3 -I scripts/collect_rows.py run1                 # reads work/runs/run1/*.json
  python3 -I scripts/collect_rows.py run1 --out rows/rows.csv

Each JSON file must match prompts/output_schema.json (one file per page, any filename).
Also writes work/runs/<run>/uncovered_topics.tsv and pages_coded.tsv.
"""
import argparse
import csv
import json
import pathlib
import sys

COLUMNS = ["row_id", "doc", "pdf_page", "code", "role", "quote",
           "speaker", "entity", "inferred", "note", "confidence", "run"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("run", help="run name under work/runs/")
    ap.add_argument("--out", default=None, help="default rows/rows_<run>.csv")
    a = ap.parse_args()

    run_dir = pathlib.Path("work/runs") / a.run
    files = sorted(run_dir.glob("*.json"))
    if not files:
        sys.exit(f"no JSON files in {run_dir}")

    rows, topics, pages = [], [], []
    for f in files:
        d = json.loads(f.read_text(encoding="utf-8"))
        for k in ("doc", "pdf_page", "rows"):
            if k not in d:
                sys.exit(f"{f.name}: missing key {k!r}")
        pages.append((d["doc"], d["pdf_page"], len(d["rows"]), d.get("page_summary", "")))
        for t in d.get("uncovered_topics", []):
            topics.append((d["doc"], d["pdf_page"], t))
        for r in d["rows"]:
            rows.append({
                "row_id": "",
                "doc": d["doc"],
                "pdf_page": d["pdf_page"],
                "code": r.get("code", ""),
                "role": r.get("role", ""),
                "quote": " ".join(str(r.get("quote", "")).split()),
                "speaker": r.get("speaker", ""),
                "entity": r.get("entity", ""),
                "inferred": r.get("inferred", ""),
                "note": r.get("note", ""),
                "confidence": r.get("confidence", ""),
                "run": a.run,
            })

    rows.sort(key=lambda r: (r["doc"], int(r["pdf_page"])))
    for i, r in enumerate(rows, start=1):
        r["row_id"] = f"{a.run}-{i:03d}"

    out = pathlib.Path(a.out or f"rows/rows_{a.run}.csv")
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(rows)

    (run_dir / "uncovered_topics.tsv").write_text(
        "doc\tpdf_page\ttopic\n" + "".join(f"{d}\t{p}\t{t}\n" for d, p, t in topics), encoding="utf-8")
    (run_dir / "pages_coded.tsv").write_text(
        "doc\tpdf_page\tn_rows\tpage_summary\n" + "".join(f"{d}\t{p}\t{n}\t{s}\n" for d, p, n, s in pages),
        encoding="utf-8")
    print(f"{len(rows)} rows from {len(files)} pages -> {out}")
    print(f"{len(topics)} uncovered-topic mentions -> {run_dir/'uncovered_topics.tsv'}")


if __name__ == "__main__":
    main()
