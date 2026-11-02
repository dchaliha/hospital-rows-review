# From hospital reports to coded rows: write-up

Hospital: Providence Valdez Medical Center, Valdez, Alaska. Documents: CHNA 2023 (77 pp) and the 2024–2026 Community Health Improvement Plan (14 pp; this is the "implementation strategy"). All page numbers below are PDF page numbers.

Start: [__:__]  Stop: [__:__]  (two-hour hard stop; minutes per step in the Times table at the end)

---

## Step 1. Sketch

[Insert my pipeline sketch here: input to output, which steps are code and which are the model, where a person checks.]

**Scale.** 1,700 documents at roughly 50 pages each is about 85,000 page calls (this hospital: 77 + 14; tax filings run longer). At 20 to 30 seconds per call and 10 to 20 concurrent requests, extraction is one to two days of wall-clock; the Batch API halves the cost and nothing is latency-sensitive. Verification takes seconds per hospital. Human review is the real budget: at about one minute per row on a 10 percent sample of, say, 40,000 rows, roughly 65 person-hours.

**If the codebook changes halfway.** Page text, images, and word boxes are cached and never change, so a codebook change re-runs only step 3 with a bumped `codebook_version`, then diffs old and new rows per hospital. Every row stores `codebook_version` and `prompt_version`. For an added code, mine the stored `uncovered_topics` first so only candidate pages re-run. For a split or redefined code, re-run only the pages that produced the old code. Human-reviewed rows for untouched codes are kept.

**Columns of one row.** Required: `doc, pdf_page, code, role, quote`. Added: `hospital_id, doc_year, speaker` (hospital / key_informant / survey_respondent / resource_list), `entity` (named program or partner), `inferred` (true/false), `note` (what was inferred or why confidence is not high), `confidence`, `model, prompt_version, codebook_version, run_id`, `verified_quote` (set by the script), `reviewer_decision, reviewer_note` (set by a person).

**Chart.** A heatmap of code by role where each cell is the number of hospitals (not rows) with at least one verified row, drawn twice: once from CHNAs and once from implementation strategies. The question it answers: which needs do hospitals name as priorities but rarely run, partner on, or fund, and does naming a need in the CHNA predict acting on it in the strategy? A second cut, by rural versus urban hospitals, would show whether the gap differs by setting.

**Questions for you.**
1. Unit of analysis: hospital or hospital system? Providence files one CHNA style across many facilities. Does a system-wide statement count for each facility?
2. Does a key informant's or survey respondent's statement count as the hospital "naming it a priority", or only hospital-authored text such as the ranked priority list?
3. How formal is "partners"? Does "collaborating with law enforcement" (IS p11) count, or only named agreements and co-funded programs?
4. Granularity: one row per supporting passage, or one row per (hospital, doc, code, role) with the best quote?

---

## Step 2. Try it

**Pages run.** Required: CHNA pp. 23–24, implementation strategy pp. 11–12. Chosen: CHNA pp. 25, 33, 35, 46 and implementation strategy p. 10.

**Why (two sentences).** CHNA pp. 30–34 are key-informant testimony, which stress-tests how the model handles informally phrased statements where the speaker is the community rather than the hospital, so p. 33 was taken from that range (substance use content that is codable, plus a quote that runs onto p. 34), and p. 35 because it straddles two sub-sections and contains almost nothing the 14 codes cover, which tests restraint and the uncovered-topics channel. The others each stress a different failure: p. 25 continues the evaluation table across a page break with its header on the previous page, p. 46 is a directory of another organization's services (a false-positive trap for "runs it"), and IS p. 10 holds the priority list and the start of the strategy table that spills onto the required p. 11.

**Rows.** 32 rows in `rows/rows_run1_verified.csv` (five required columns plus speaker, entity, inferred, note, confidence, run, and the verifier's columns). By page: CHNA 23 (5), 24 (7), 25 (3), 33 (5), 35 (1), 46 (0, by design: a resource directory); IS 10 (2), 11 (6), 12 (3). By role: 14 runs it, 9 partners, 9 names it a priority, 0 funds it. 16 rows are marked inferred (actor implicit in a table, or a key informant speaking rather than the hospital); 12 high, 15 medium, 5 low confidence. Per-page model output with uncovered topics is in `work/runs/run1/`.

---

## Step 3. Check it

**Validation run.** `scripts/verify_quotes.py` on every row: (a) quote appears verbatim on the cited page after normalization; (b) if not, whether it appears on any other page of the document (page-number error) and the longest matching fragment as a share of the quote (one-word edit versus paraphrase); (c) code and role are valid; (d) 40-word limit; (e) no ellipses. The review tool re-runs check (a) live as a quote is edited. [Optional, if run: `scripts/compare_runs.py` between two runs, agreement on (doc, page, code, role).]

**What it caught.** The script passed all 32 rows: every quote is on its cited page after normalization, no quote is on a different page, none exceeds 40 words (longest 34), and every code and role is in the list. So the automated check caught nothing in this run. What it did surface, and what I caught myself while coding:
- Two rows have no highlight box on the page image even though the text check passed: both "Initiated co-response with law enforcement…" (CHNA pp. 23 and 24). The quote is split across a line break at the hyphen ("co-" / "response"), so PyMuPDF's exact search fails while the normalized text check succeeds. The review tool falls back to word-box matching for the highlight. This is the kind of mismatch between two "verbatim" checks that matters at scale.
- Near-miss, my own: the virtual intensive outpatient treatment sentence appears on both p. 23 ("Substance Use Disorder") and p. 24 ("Substance Use Disorders"). Copying the p. 23 wording onto the p. 24 row would have failed the check. I caught it while coding because the pages were coded separately; a model working from memory of the prior page would not.
- The same two sentences (virtual IOP, co-response) are listed under two different strategies on consecutive pages, so the run has two pairs of near-duplicate rows across pages. The duplicate flag is per page and did not fire. A cross-page dedupe within (code, role) belongs in the consolidate step.
- What the check cannot catch, and what the human review is for: the 16 inferred rows (who acts: hospital table with implicit subject, or key informant) and the 20 rows at medium or low confidence, which the tool shows first. Recall is also unchecked by the script: p. 46 produced zero rows on purpose, and the childcare partnership on p. 24 produced none because no code covers childcare.
- [FILL after hand review: which rows I accepted, edited, or rejected in the review tool, with reasons; which pages I read in full to look for missed findings.]

---

## Step 4. Find what the codebook misses

**Method, run across all hospitals.**

*Inputs.*
- (My idea: add a prompt channel that returns what we might have missed.) The extraction call already emits `uncovered_topics` and a page summary for every page, so the first input is free: short phrases with hospital, document, and page attached.
- (My idea: a toggle for a discovery prompt.) A `discover` flag on the same call asks the model to also propose candidate codes with a one-line definition and the supporting quote, on a sample of pages rather than all of them, because it adds output tokens.
- (My idea: a full sweep.) Pages with zero rows but many words and hospital-action verbs ("we provide", "in partnership with") are the pages most likely to hide an uncovered activity; they get the discovery prompt too.
- (My idea: adversarial review with different agents.) Disagreement between two runs or two models on the same page is a cheap signal that a passage is ambiguous or outside the codebook; those pages are sampled for a person.

*Tools.* Sentence embeddings of the phrases, clustering (for example BERTopic or HDBSCAN on sentence-transformer embeddings), a model to name each cluster, write a one-line definition and pull three example quotes, and plain code to count hospitals and states per cluster. (My note: existing open-source topic-discovery and evaluation tooling is worth a short survey before building this by hand.)

*Output.* A ranked table: candidate topic, definition, number of hospitals, number of states, number of pages, three example (hospital, page, quote) triples, and the nearest existing code.

*"Real enough" rule.* A cluster becomes a candidate code when it appears in at least about 5 percent of hospitals across at least three states, is not a synonym of an existing code (model check, then a person), and two people can apply its one-sentence definition to ten sample pages with at least 80 percent agreement.

*Where a person reviews.* A reviewer works the ranked table, approving, merging, or rejecting clusters and naming the code. Approved codes bump `codebook_version`, and only pages that fed the cluster re-run.

**Topics already visible in these two documents that no sampled code covers** (from the pages read; to be confirmed by the run):
- Childcare and early childhood education (CHNA p. 35; IS p. 11 "Childcare Task Force")
- Social connection and isolation, bullying (CHNA p. 35)
- Transportation to care and specialty-care access, including podiatry, ENT, consulting psychologist (CHNA pp. 22, 25)
- Health care workforce retention and housing for staff as a hospital problem, as distinct from training (CHNA p. 25)
- Telehealth and virtual services (CHNA p. 23 virtual intensive outpatient treatment; p. 34)
- Hospital expansion and long-term care (IS p. 13)
- Chronic disease and "healthy lifestyle" beyond weight (CHNA p. 23 priority list)
- Emergency preparedness and public-health screening services (CHNA p. 46)
- Crisis response with law enforcement, which is neither clearly "Crime/Violence" nor clearly "Mental Health" (IS p. 11)

**Code that did not fit well.** Seen in the run (16 of 32 rows carry the one mental-health code), and the expected cases held: "Financial/Insurance Assistance" and "Safety Net Assistance" overlap on a single passage about charity care and Medicare/Medicaid application help (IS p. 11), so one sentence yields two rows with a fuzzy boundary; "Crime/Violence" for law-enforcement co-response to mental-health crises, which is about crisis response, not violence; and "Mental Health, Substance Use Disorder, Addiction Services" is one code for most of this hospital's priority #1, so many distinct activities collapse into identical (code, role) pairs.

---

## Step 5. Break it

Two ways this approach would fail on a different hospital, specific to what I saw here:

1. **Tables and quotes that cross page breaks.** The strategy table on IS p. 11 is a continuation of p. 10: strategy "2." sits on p. 11 while the heading that says which priority it belongs to is on p. 10. CHNA p. 25 continues the evaluation table the same way, and a key-informant quote starts on p. 33 and ends on p. 34. A page-at-a-time model never sees the heading, and the no-cross-page quote rule cuts the sentence. A hospital whose strategies are long tables spanning many pages would lose priority attribution on most rows unless the parser carries the last heading forward as context.

2. **Whose action is it: facility, system, or someone else.** This is a Providence facility, and the strategy says "Providence has committed funding, staffing, and equipment" (IS p. 11), a system-level statement. The CHNA's resource appendix (pp. 44–49) lists other organizations' services (immunizations, violence screening on p. 46) in the same visual format as the hospital's own services on p. 44. A system that files one document for a dozen facilities, or a hospital that drops its resource directory into the body of the report, would produce confident "runs it" rows for things the hospital does not run.

**Other break points, given this architecture.**
- *Format.* (My idea.) Documents that are not text PDFs: scanned filings, web pages, or slide decks. The parse step would need OCR, and quote verification against OCR text would need a looser match, which weakens the strongest check in the pipeline.
- *Chart-only pages.* CHNA p. 59 has one word of extractable text; pp. 52–77 are mostly charts. A hospital whose CHNA is largely infographics produces almost nothing from text alone, and image input makes verbatim verification harder because there is no text layer to check against.
- *Printed versus PDF page numbers.* Here they happen to match. In documents with unnumbered front matter the model reads the printed number; the verifier catches it as "found on another page", but at scale that is a steady stream of repairs.
- *Document naming.* This hospital calls its implementation strategy a "Community Health Improvement Plan (CHIP)". Classifying document type by title would misfile it; other hospitals use "action plan" or "strategy report".
- *Two-column layouts.* The pages here are single column, so reading order was clean. A two-column CHNA interleaves lines in the text layer, and quotes that span a column break will not verify.
- *Row explosion on one code.* Priority #1 here maps entirely to one code. A behavioral-health-focused hospital yields dozens of rows with the same (code, role) and different quotes; without the dedupe rule in step 6 the heatmap counts rows, not hospitals, and overstates them.

---

## Times

| Step | Planned | Actual |
|---|---|---|
| Read and set up | 20 | [__] |
| 1. Sketch | 15 | [__] |
| 2. Try it | 35 | [__] |
| 3. Check it | 25 | [__] |
| 4. Codebook misses | 10 | [__] |
| 5. Break it | 5 | [__] |
| Wrap up | 10 | [__] |

Start: [__:__]  Stop: [__:__]

---

## Log

- **Model and version.** Claude Fable 5.1 (`claude-fable-5-1`) through Claude Code (coding tool) for the extraction run and all scripting. [If the upload server was used: Claude Opus 5.5 (`claude-opus-5-5`) through the Anthropic API via `review-ui/server/extract_server.py`.]
- **Interface.** Claude Code in the terminal. For each page the agent read `work/pages/<DOC>/pNNN.txt`, applied the system prompt, and wrote JSON matching the schema to `work/runs/run1/`. Scripts in `scripts/` did page extraction, row collection, and quote verification. The browser review tool in `review-ui/` was used for [FILL: hand checks / none].
- **Prompts, verbatim.** System prompt: `prompts/system_prompt.md`. User template: `prompts/user_prompt_template.md`. Output schema: `prompts/output_schema.json`. Codebook as given: `prompts/codebook.md`. Few-shot examples: none. [Paste the three files inline here at submission.]
- **Accepted unchanged versus edited.** [FILL per step. Setup and Step 1: the pipeline sketch was drafted by the model from my hand sketch; I changed __. Step 2: of N model rows, I accepted __ unchanged, edited __ (what: __), rejected __ (why: __), added __ by hand. Step 4 and 5: text drafted from my notes; I changed __.]
- **Verified by hand.** [FILL: which pages I read in full and compared against the rows; which quotes I checked against the PDF myself rather than trusting the script.]

---

## Deliverables checklist

1. This write-up (steps 1–5, times, log).
2. Rows: `rows/rows_run1_verified.csv` (doc, pdf_page, code, role, quote, plus speaker, entity, inferred, note, confidence, run, verification columns).
3. Working files: exported Claude Code transcript; `prompts/` (system prompt, user template, schema, codebook); `scripts/` (extract_pages.py, collect_rows.py, verify_quotes.py, compare_runs.py, make_page_prompt.py, run_extract_api.py, build_review_batch.py); `review-ui/` (review tool and extraction server); `pages_pdf/` (single-page PDFs used, with README).
