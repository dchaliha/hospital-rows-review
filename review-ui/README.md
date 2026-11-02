# Row review UI

Human review surface for LLM-extracted document rows. One finding = one label, one role, one verbatim quote from one PDF page. A reviewer confirms, edits, or rejects every row before it enters the database.

Single-page React app (Vite + TypeScript + Tailwind). Reads a batch from a local JSON file; writes decisions to `localStorage`, keyed by (document, run). No backend.

## Run

```bash
npm install
npm run mock      # regenerates public/data/batch.json + labels.json (already checked in)
npm run dev       # http://localhost:5173
npm run build     # type-check + production build
```

Three batches are selectable on the overview screen:

- **Mock batch**: two placeholder documents (75 and 15 pages), 28 rows across 10 pages, with planted problems: 3 quotes not on their page (a paraphrase, a one-word change, and a page-number error), 4 inferred rows, 2 "no fit", 1 run disagreement, 1 over-limit quote, 1 duplicate, 2 "needs a look".
- **Providence Valdez pages**: the real CHNA and implementation strategy, rendered page images plus word boxes. Build it from the exercise folder with `python3 -I scripts/build_review_batch.py [--rows rows/rows_run1_verified.csv --run run1]`. Without `--rows` it loads pages only, so you can browse the PDFs and add rows by hand.
- **Uploaded pages**: whatever you upload through **Upload a page**. Needs the extraction server (below).

## Upload a page and extract

```bash
# terminal 1, from the exercise folder
export ANTHROPIC_API_KEY=sk-ant-...        # or put ANTHROPIC_API_KEY=... in <exercise>/.env
python3 review-ui/server/extract_server.py  # Flask on :8787; Vite proxies /api to it
# terminal 2
cd review-ui && npm run dev
```

Overview → **Upload a page** → drop a PDF (single page is best; up to 6 pages per upload) → **Extract rows**. The server extracts text and word boxes with PyMuPDF, sends each page once through `prompts/system_prompt.md` + `output_schema.json` (adding the page image when a page has little text), checks every quote against the page with the same normalization as `scripts/verify_quotes.py`, and saves everything under `public/uploads/<doc id>/` (page PNGs, word boxes, raw model JSON, `doc.json`). The result opens straight in the wizard. Model: `REVIEW_MODEL` env var, default `claude-opus-5-5`. Without an API key the page still loads, with zero rows and a note, so rows can be added by hand.

Ready-made single-page PDFs for this exercise are in `../pages_pdf/` (required, extra, optional), with a README explaining each pick.

## Review flow

1. **Overview**: one card per document with "N rows · M flagged · K reviewed" and the count that still needs a human. Review opens the wizard at the first page with a pending flagged row.
2. **Page wizard**: left, the whole page fitted to the pane (the size button cycles Fit, 125%, 150%, 200%) with every row's quote highlighted; hover a card to light its quote, click a highlight to select the card; the extracted text sits behind **Text**. Right, one compact card per row, flagged first, then inferred, then clean: label, role, quote, and Accept / Reject / Edit. **Edit** (or E) opens the full form: label, role, quote with live word count, evidence type, named entity, population, section, reviewer note. Move between pages with the arrows, the page box in the header (G to focus it), or the "Pages with rows" pills at the bottom.
3. **Add a row**: select text in the text pane, or drag a box over words on a real page image. The quote fills in; pick label and role.
4. **Footer**: Back, "Accept all clean rows on this page", Next. Next is held while any flagged row on the page is still pending. Clean rows may stay pending.
5. **Completion**: counts of accepted / edited / rejected / added, every "no fit" row with its quote, logged router misses, and CSV export (all edits included; optionally pending and rejected rows too).
6. **All rows**: a table of every row in the batch with filters (document, status, flagged only, search); click a row to open its page with that row selected; export from there too.

## Guards

- Nothing is auto-accepted. Clean rows start pending with one-click accept.
- Flagged and inferred rows can never be bulk-accepted; the bulk action only touches rows with zero flags.
- Quote edits re-run the on-page check client-side (same normalization as the pipeline's `verify_quotes.py`), so "Quote not found on this page" clears or appears as you type.
- Every change autosaves. On reload the app restores and shows "Restored your progress"; "Start fresh" discards.
- Undo returns a row to exactly what the pipeline produced.

## Flags and wording

Flags shown to reviewers in plain words: `quote_not_on_page` ("Quote not found on this page"), `over_limit`, `runs_disagree` ("Two runs disagreed: A vs B"), `no_fit`, `needs_look` (the pipeline was only somewhat sure; added so slightly unsure rows get a human), `dup`, `inferred`. Summary chip per row: **Likely**, **Needs a look**, or **Unsupported**. No model names, no confidence numbers.

## Keyboard

| Key | Action |
|---|---|
| J / K | next / previous row |
| A | accept the selected row |
| R | reject the selected row, then 1–4 picks the reason (wrong page, not supported, duplicate, label misfit) |
| E | open the selected row for editing |
| G | focus the page box, type a number, Enter |
| N | next page (only when no flagged row on the page is pending) |
| B | back one page |
| ? | show the shortcut list |
| Esc | close a dialog, stop editing, or leave a text field |

## Data shapes

`src/types.ts` holds `Document`, `Row`, `Flag`, `Decision`. The JSON on disk (`src/data/load.ts`, `DocumentJson`) replaces the two page accessors with `pageTexts` and a `pageImage` descriptor (`placeholder`, or a `template` URL for rendered pages). Reviewer decisions are stored apart from the model's rows, so an edited row still carries its original.

## What changes for thousands of documents and several reviewers

1. Decisions move from localStorage to a server with one record per (row, reviewer, run); the UI shape stays.
2. Work is assigned in units of one document; a document is locked to one reviewer while open, with a visible owner and a 30-minute lease that expires.
3. A fixed share of documents (5–10%) is secretly assigned to two reviewers; disagreement by (page, label, role) is the inter-rater number tracked per label.
4. Row-level flags get a priority queue: quote_not_on_page and runs_disagree first, since they are cheap to resolve and most often wrong.
5. "Accept all clean" stays per page; there is still no document-level bulk accept.
6. Reviewer edits are written back as few-shot examples, tagged by prompt and codebook version, so the next run learns from them.
7. Every decision stores codebook version and run id; a codebook change re-queues only rows whose label was added, split, or redefined.
8. Router-miss logs feed a weekly check of the skip rules; a page type that is missed twice stops being skipped.
9. Page images come from object storage with signed URLs; word boxes are precomputed once per page at ingest.
10. The export becomes a database view, not a file; the CSV button remains for audits.
