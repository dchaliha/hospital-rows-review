#!/usr/bin/env python3
"""Validate a rows CSV against the per-page text in work/pages/.

Usage:
  python3 -I scripts/verify_quotes.py rows/rows_run1.csv
  python3 -I scripts/verify_quotes.py rows/rows_run1.csv --out rows/rows_run1_verified.csv --report work/verify_run1.md

Per row it checks:
  1. required columns present; doc / code / role are valid values
  2. quote is at most 40 words
  3. quote appears verbatim on the cited PDF page (after normalizing whitespace, curly quotes,
     dashes, ligatures, and hyphenated line breaks)
  4. if not found on the cited page: which other pages of the same document contain it
     (catches wrong page numbers), and the longest matching fragment as a share of the quote
     (distinguishes a one-word edit from a paraphrase)

Writes a copy of the CSV with added columns: n_words, verified, found_on_pages, match_ratio, issues.
"""
import argparse
import csv
import difflib
import pathlib
import re
import sys

DOC_DIRS = {"CHNA": "CHNA", "implementation strategy": "IS"}
CODES = {
    "Food assistance", "Housing assistance", "Education and Workforce", "Vaccine Access",
    "Mental Health, Substance Use Disorder, Addiction Services", "Crime/Violence", "Smoking/Vaping",
    "Weight Management and Obesity", "Mobile/Remote Clinics", "Rural Health/Rural Clinics",
    "Immigrant Health Access", "Women's Health", "Financial/Insurance Assistance", "Safety Net Assistance",
}
ROLES = {"runs it", "partners", "funds it", "names it a priority"}
REQUIRED = ["doc", "pdf_page", "code", "role", "quote"]
MAX_WORDS = 40

_SUBS = {
    "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-",
    " ": " ", "ﬁ": "fi", "ﬂ": "fl", "•": " ", "­": "",
}


def norm(s: str, join_hyphen_breaks: bool) -> str:
    for k, v in _SUBS.items():
        s = s.replace(k, v)
    s = re.sub(r"-\s*\n\s*", "" if join_hyphen_breaks else "-", s)  # "commu-\nnity" -> "community" or "commu-nity"
    s = re.sub(r"\s+", " ", s)
    return s.strip().lower()


def norm_quote(q: str) -> str:
    q = q.strip().strip('"“”‘’\'')
    return norm(q, join_hyphen_breaks=False)


def load_pages(pages_root: pathlib.Path, doc: str) -> dict[int, str]:
    d = pages_root / DOC_DIRS.get(doc, doc)
    out = {}
    for f in sorted(d.glob("p*.txt")):
        out[int(f.stem[1:])] = f.read_text(encoding="utf-8")
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("csv")
    ap.add_argument("--pages", default="work/pages")
    ap.add_argument("--out", default=None)
    ap.add_argument("--report", default=None)
    a = ap.parse_args()

    src = pathlib.Path(a.csv)
    out = pathlib.Path(a.out or src.with_name(src.stem + "_verified.csv"))
    report = pathlib.Path(a.report or f"work/verify_{src.stem}.md")
    pages_root = pathlib.Path(a.pages)

    with src.open(encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        rows = list(reader)
        fields = reader.fieldnames or []
    missing = [c for c in REQUIRED if c not in fields]
    if missing:
        sys.exit(f"CSV is missing required columns: {missing}")

    cache: dict[str, dict[int, str]] = {}
    n_ok = 0
    failures = []
    for r in rows:
        issues = []
        doc, code, role = r["doc"].strip(), r["code"].strip(), r["role"].strip()
        if doc not in DOC_DIRS:
            issues.append(f"bad doc {doc!r}")
        if code not in CODES:
            issues.append(f"code not in codebook: {code!r}")
        if role not in ROLES:
            issues.append(f"bad role {role!r}")
        try:
            page_no = int(str(r["pdf_page"]).strip())
        except ValueError:
            page_no = -1
            issues.append(f"bad pdf_page {r['pdf_page']!r}")

        q = norm_quote(r["quote"])
        n_words = len(q.split())
        if n_words == 0:
            issues.append("empty quote")
        elif n_words > MAX_WORDS:
            issues.append(f"{n_words} words > {MAX_WORDS}")
        if "..." in q or "…" in r["quote"]:
            issues.append("quote contains an ellipsis (must be one contiguous span)")

        found_on, ratio = [], 0.0
        if doc in DOC_DIRS and q:
            if doc not in cache:
                cache[doc] = load_pages(pages_root, doc)
            pages = cache[doc]
            if not pages:
                issues.append(f"no page texts for {doc} under {pages_root}; run extract_pages.py")
            else:
                for p, text in pages.items():
                    if q in norm(text, True) or q in norm(text, False):
                        found_on.append(p)
                if page_no in pages:
                    pt = norm(pages[page_no], True)
                    m = difflib.SequenceMatcher(None, pt, q, autojunk=False).find_longest_match(0, len(pt), 0, len(q))
                    ratio = round(m.size / max(len(q), 1), 2)
                else:
                    issues.append(f"pdf_page {page_no} not in document (1..{max(pages)})")
                if page_no in found_on:
                    pass
                elif found_on:
                    issues.append(f"quote NOT on page {page_no}; found on page(s) {found_on}")
                else:
                    issues.append(f"quote not found verbatim anywhere in {doc}; longest match on cited page = {ratio:.0%} of quote")

        verified = not issues
        n_ok += verified
        r["n_words"] = n_words
        r["verified"] = "yes" if verified else "no"
        r["found_on_pages"] = ";".join(map(str, found_on))
        r["match_ratio"] = ratio
        r["issues"] = "; ".join(issues)
        if issues:
            failures.append(r)

    extra = ["n_words", "verified", "found_on_pages", "match_ratio", "issues"]
    with out.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fields + [c for c in extra if c not in fields])
        w.writeheader()
        w.writerows(rows)

    lines = [f"# Verification report for `{src}`", "",
             f"- rows checked: {len(rows)}", f"- passed all checks: {n_ok}", f"- failed: {len(failures)}", ""]
    if failures:
        lines += ["| row_id | doc | pdf_page | code | role | issue |", "|---|---|---|---|---|---|"]
        for r in failures:
            lines.append(f"| {r.get('row_id','')} | {r['doc']} | {r['pdf_page']} | {r['code']} | {r['role']} | {r['issues']} |")
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    print(f"\nwrote {out} and {report}")


if __name__ == "__main__":
    main()
