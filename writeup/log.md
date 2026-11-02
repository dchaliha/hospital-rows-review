# Log (kept as I go)

- Model and version: Claude Fable 5.1 (`claude-fable-5-1`), via Claude Code CLI (coding tool). [add any chat-app or API runs with their model id]
- Interface: Claude Code in the terminal; the agent reads `work/pages/<DOC>/pNNN.txt` and writes `work/runs/<run>/<DOC>_pNNN.json`. Scripts in `scripts/` do extraction and verification.
- Prompts verbatim: `prompts/system_prompt.md` (system), `prompts/user_prompt_template.md` (user), `prompts/output_schema.json` (output schema). Few-shot examples: none unless listed below.
- Working files / transcript: ____ (shared link or exported transcript)

## Setup (before the clock / first 20 min)
- Scaffold (prompts, schema, scripts, templates) drafted with Claude Code at 2026-11-01 18:10 EST, before the documents were opened.
- Accepted unchanged: ____   Edited: ____

## Step 1 (sketch)
- Accepted unchanged: ____
- Edited: ____

## Step 2 (try it)
- Pages run: ____
- Prompt changes between pages (if any): ____
- Accepted unchanged: ____   Edited: ____
- Verified by hand: ____

## Step 3 (check it)
- Command(s) run: ____
- Caught: ____ (including my own errors)

## Step 4
- ____

## Step 5
- ____

## Step 2 run (in-chat extraction), 2026-11-01 20:23 EST
- Model: Claude Fable 5.1 (claude-fable-5-1) via Claude Code, acting as the extraction model. Input per page: the text in work/pages/<DOC>/pNNN.txt (PyMuPDF). System prompt applied: prompts/system_prompt.md; output written to match prompts/output_schema.json (validated with jsonschema).
- Pages: CHNA 23, 24, 25, 33, 35, 46; implementation strategy 10, 11, 12.
- Output: work/runs/run1/*.json -> rows/rows_run1.csv (collect_rows.py) -> rows/rows_run1_verified.csv + work/verify_rows_run1.md (verify_quotes.py) -> review-ui/public/data/batch.real.json (build_review_batch.py).
- No few-shot examples. No prompt changes between pages.
