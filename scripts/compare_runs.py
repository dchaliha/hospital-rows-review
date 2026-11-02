#!/usr/bin/env python3
"""Compare two rows CSVs (two model runs, or a model run vs. hand coding).

Usage:
  python3 -I scripts/compare_runs.py rows/rows_run1.csv rows/rows_run2.csv

Agreement is measured on the key (doc, pdf_page, code, role); quote text is reported
separately because two correct runs can pick different spans for the same finding.
"""
import csv
import re
import sys
from collections import Counter


def load(path):
    with open(path, encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    keyed = {}
    for r in rows:
        k = (r["doc"].strip(), int(r["pdf_page"]), r["code"].strip(), r["role"].strip())
        keyed.setdefault(k, []).append(re.sub(r"\s+", " ", r["quote"]).strip().lower())
    return keyed


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    a, b = load(sys.argv[1]), load(sys.argv[2])
    ka, kb = set(a), set(b)
    both, only_a, only_b = ka & kb, ka - kb, kb - ka
    same_quote = sum(1 for k in both if set(a[k]) & set(b[k]))
    print(f"A = {sys.argv[1]}: {len(ka)} distinct (doc, page, code, role) findings")
    print(f"B = {sys.argv[2]}: {len(kb)} distinct findings")
    print(f"in both: {len(both)}   (same quote span in {same_quote} of them)")
    print(f"only in A: {len(only_a)}   only in B: {len(only_b)}")
    jacc = len(both) / max(len(ka | kb), 1)
    print(f"Jaccard agreement on findings: {jacc:.2f}")
    for label, s in (("only in A", only_a), ("only in B", only_b)):
        if s:
            print(f"\n{label}:")
            for k in sorted(s):
                print(f"  {k[0]} p{k[1]}  {k[2]}  [{k[3]}]")
    pages = Counter(k[:2] for k in ka | kb)
    print(f"\npages covered: {len(pages)}")


if __name__ == "__main__":
    main()
