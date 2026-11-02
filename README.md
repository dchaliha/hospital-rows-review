# Hospital reports → coded rows (final-round exercise)

**Live review tool:** https://dchaliha.github.io/hospital-rows-review/ (static build: mock batch and the Providence Valdez pages; the upload-and-extract server runs locally only). Write-up: `writeup/writeup.md`.

Exercise prompt: `exercise/Final Exercise.docx.pdf`. Deadline: Mon Nov 2, 8am ET. Two-hour hard stop; note start/stop times in `writeup/log.md`.

## Layout
- `docs/`                 the two PDFs: `1_4_CHNA.pdf` (CHNA 2023), `1_4_IS.pdf` (implementation strategy 2024–26) (untrusted downloads; nothing executes from here)
- `prompts/`              codebook (verbatim), system prompt, user template, JSON output schema
- `scripts/`              extract pages → (LLM codes pages) → collect rows → verify quotes → compare runs
- `work/pages/<DOC>/`     per-page text (`pNNN.txt`), optional `pNNN.png`, `index.tsv`
- `work/runs/<run>/`      one JSON per coded page
- `rows/`                 CSV deliverable(s)
- `writeup/`              write-up and running log
- `review-ui/`            human-review web app (React) + local extraction server (Flask): upload a page PDF, extract, review, export. See review-ui/README.md
- `pages_pdf/`            single-page PDFs to upload: required/ (CHNA 23, 24; IS 11, 12), extra/ (my picks), optional/. See pages_pdf/README.md

## Run order
```bash
# 1. page text (PDF page numbers, 1-based). --render saves PNGs for chart-like pages.
python3 -I scripts/extract_pages.py docs/1_4_CHNA.pdf CHNA --render 23,24
python3 -I scripts/extract_pages.py docs/1_4_IS.pdf IS --render 11,12
cat work/pages/CHNA/index.tsv        # pick extra pages; spot low-text (chart) pages

# 2. code pages (LLM). In Claude Code: "code CHNA page 23 with prompts/system_prompt.md,
#    write work/runs/run1/CHNA_p023.json". Or print the exact prompt for a chat app:
python3 -I scripts/make_page_prompt.py CHNA 23
#    Or, with ANTHROPIC_API_KEY set, run the same prompt through the API:
python3 -I scripts/run_extract_api.py run2 CHNA 23 24

# 3. merge page JSONs into the CSV deliverable
python3 -I scripts/collect_rows.py run1              # -> rows/rows_run1.csv

# 4. check every quote against its cited page
python3 -I scripts/verify_quotes.py rows/rows_run1.csv   # -> rows/rows_run1_verified.csv, work/verify_rows_run1.md

# 5. optional: agreement between two runs (or run vs. hand-coding)
python3 -I scripts/compare_runs.py rows/rows_run1.csv rows/rows_run2.csv

# 6. optional: human review in the browser (real pages + your rows), then export the reviewed CSV
python3 -I scripts/build_review_batch.py --rows rows/rows_run1_verified.csv --run run1
cd review-ui && npm install && npm run dev    # http://localhost:5173, pick "Providence Valdez pages" in the Batch menu

# 7. optional: upload single pages and extract them from the browser (needs ANTHROPIC_API_KEY)
python3 review-ui/server/extract_server.py   # then Overview -> Upload a page -> pages_pdf/required/CHNA_p023.pdf
```

## Deliverables (email by Mon 8am ET)
1. `writeup/writeup.md` (steps 1–5, times, log)
2. `rows/rows_run1_verified.csv` (five required columns + extras)
3. working files: transcript link/export, `prompts/`, `scripts/`
