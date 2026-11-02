#!/usr/bin/env python3
"""Print the exact prompt for one page (system prompt + filled user template), for pasting into a
chat app or for the live walk-through. The same text is what run_extract_api.py sends.

Usage:
  python3 -I scripts/make_page_prompt.py CHNA 23            # doc label as used in work/pages/
  python3 -I scripts/make_page_prompt.py IS 11 --user-only  # just the user message
"""
import argparse
import pathlib

DOC_NAMES = {"CHNA": "CHNA", "IS": "implementation strategy"}


def build_user_message(label: str, page: int, pages_root="work/pages") -> str:
    text = (pathlib.Path(pages_root) / label / f"p{page:03d}.txt").read_text(encoding="utf-8")
    tmpl = pathlib.Path("prompts/user_prompt_template.md").read_text(encoding="utf-8")
    return tmpl.format(doc=DOC_NAMES.get(label, label), pdf_page=page, page_text=text.strip())


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("label")
    ap.add_argument("page", type=int)
    ap.add_argument("--user-only", action="store_true")
    a = ap.parse_args()
    if not a.user_only:
        print("===== SYSTEM PROMPT =====")
        print(pathlib.Path("prompts/system_prompt.md").read_text(encoding="utf-8"))
        print("===== USER MESSAGE =====")
    print(build_user_message(a.label, a.page))


if __name__ == "__main__":
    main()
