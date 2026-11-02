#!/usr/bin/env python3
"""Local extraction server for the review UI (Flask, port 8787; Vite proxies /api here).

  POST /api/extract        multipart: file (PDF), docType, sourceName?, year?, pages? ("1,3")
                           -> page text + images via PyMuPDF, one model call per page with the
                              exercise's prompt and JSON schema, quote verification, saved under
                              review-ui/public/uploads/<doc id>/ and returned as review-ui rows
  GET  /api/uploads        -> everything uploaded so far, as a review-ui batch
  GET  /api/health         -> {ok, model, hasApiKey}
  DELETE /api/uploads/<id>

Run from the exercise folder:   python3 review-ui/server/extract_server.py
Needs ANTHROPIC_API_KEY (env, or a line in <exercise>/.env). Without it, uploads still render
their pages but carry zero rows, so rows can be added by hand.
Model: REVIEW_MODEL env var, default claude-opus-5-5.
"""
import base64
import hashlib
import importlib.util
import json
import os
import pathlib
import re
import shutil
import time

import jsonschema
import pymupdf
from flask import Flask, jsonify, request

ROOT = pathlib.Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "review-ui" / "public"
UPLOADS = PUBLIC / "uploads"
SYSTEM = (ROOT / "prompts" / "system_prompt.md").read_text(encoding="utf-8")
TEMPLATE = (ROOT / "prompts" / "user_prompt_template.md").read_text(encoding="utf-8")
SCHEMA = json.loads((ROOT / "prompts" / "output_schema.json").read_text(encoding="utf-8"))
LABEL_VERSION = "codebook-sample-14-v1"
MAX_PAGES = 6
WORD_LIMIT = 40
IMAGE_IF_FEWER_WORDS = 120  # sparse pages (charts, tables) also get the page image
SPEAKER_TO_SECTION = {"hospital": "", "key_informant": "Key informant interview", "survey_respondent": "Survey", "resource_list": "Resource list", "other": ""}

# Same normalization as the batch verifier, imported from the pipeline script.
_spec = importlib.util.spec_from_file_location("verify_quotes", ROOT / "scripts" / "verify_quotes.py")
vq = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(vq)


def load_env() -> None:
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"'))


load_env()
MODEL = os.environ.get("REVIEW_MODEL", "claude-opus-5-5")
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 30 * 1024 * 1024


def get_client():
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return None
    import anthropic
    return anthropic.Anthropic()


def norm_box(rect, page_rect):
    w, h = page_rect.width, page_rect.height
    return {"x": round(rect.x0 / w, 4), "y": round(rect.y0 / h, 4), "w": round((rect.x1 - rect.x0) / w, 4), "h": round((rect.y1 - rect.y0) / h, 4)}


def quote_boxes(page, quote):
    q = quote.strip().strip('"“”‘’\'')
    for cand in (q, q.rstrip(".,;:"), q.replace("’", "'"), q.replace("'", "’")):
        rects = page.search_for(cand) if cand else []
        if rects:
            return [norm_box(r, page.rect) for r in rects]
    return None


def on_page(qn: str, text: str) -> bool:
    return qn in vq.norm(text, True) or qn in vq.norm(text, False)


def code_page(client, doc_label, page_no, text, png_bytes):
    """One model call for one page. Tries structured output with server-side fallbacks first,
    then without the beta, then plain JSON; validates against the schema either way."""
    import anthropic
    schema = SCHEMA
    if doc_label not in schema["properties"]["doc"]["enum"]:
        schema = json.loads(json.dumps(SCHEMA))
        schema["properties"]["doc"]["enum"] = [doc_label]
    content = []
    if png_bytes is not None:
        content.append({"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": base64.b64encode(png_bytes).decode()}})
    content.append({"type": "text", "text": TEMPLATE.format(doc=doc_label, pdf_page=page_no, page_text=text.strip())})
    fmt = {"type": "json_schema", "schema": schema}
    attempts = [
        dict(extra_body={"output_config": {"effort": "medium", "format": fmt}, "fallbacks": "default"},
             extra_headers={"anthropic-beta": "server-side-fallback-2026-07-01"}),
        dict(extra_body={"output_config": {"effort": "medium", "format": fmt}}),
        dict(extra_body={}),
    ]
    err = None
    for kw in attempts:
        try:
            resp = client.messages.create(model=MODEL, max_tokens=8000, system=SYSTEM,
                                          messages=[{"role": "user", "content": content}], **kw)
            break
        except anthropic.BadRequestError as e:  # feature not accepted: try the simpler request shape
            err = e
    else:
        raise err
    if resp.stop_reason == "refusal":
        raise RuntimeError("the model declined this page")
    txt = next(b.text for b in resp.content if b.type == "text").strip()
    if txt.startswith("```"):
        txt = txt.strip("`")
        txt = txt[txt.find("{"): txt.rfind("}") + 1]
    data = json.loads(txt)
    jsonschema.validate(data, schema)
    usage = {"input_tokens": resp.usage.input_tokens, "output_tokens": resp.usage.output_tokens}
    return data, usage, getattr(resp, "model", MODEL)


def rows_from(data, page, page_no, doc_id, run_id, texts):
    text = texts[str(page_no)]
    rows = []
    for i, r in enumerate(data["rows"], start=1):
        q = " ".join(str(r["quote"]).split())
        qn = vq.norm_quote(q)
        flags, notes = [], {}
        if not on_page(qn, text):
            flags.append("quote_not_on_page")
            others = [p for p, t in texts.items() if p != str(page_no) and on_page(qn, t)]
            notes["quote_not_on_page"] = f"Not on page {page_no}; found on page {others[0]}" if others else "Quote not found verbatim on this page"
        if len(qn.split()) > WORD_LIMIT:
            flags.append("over_limit")
        if r.get("confidence") in ("medium", "low"):
            flags.append("needs_look")
            notes["needs_look"] = f"Marked as less certain: {r['note']}" if r.get("note") and not r.get("inferred") else "Marked as less certain"
        if r.get("inferred"):
            flags.append("inferred")
        row = {
            "id": f"{run_id}-p{page_no:03d}-{i:02d}", "docId": doc_id, "pdfPage": page_no,
            "label": r["code"], "role": r["role"], "quote": q,
            "evidenceType": "inferred" if r.get("inferred") else "stated",
            "inferredNote": r.get("note", "") if r.get("inferred") else "",
            "entityNamed": r.get("entity", ""), "population": "",
            "section": SPEAKER_TO_SECTION.get(r.get("speaker", ""), ""),
            "flags": flags, "status": "pending", "labelSetVersion": LABEL_VERSION, "runId": run_id,
        }
        if notes:
            row["flagNotes"] = notes
        boxes = quote_boxes(page, q)
        if boxes:
            row["quoteBoxes"] = boxes
        rows.append(row)
    return rows


def parse_pages(spec: str, n: int):
    if not spec.strip():
        return list(range(1, min(n, MAX_PAGES) + 1))
    out = []
    for part in re.split(r"[,\s]+", spec.strip()):
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            out.extend(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    return [p for p in sorted(set(out)) if 1 <= p <= n][:MAX_PAGES]


@app.get("/api/health")
def health():
    return jsonify({"ok": True, "model": MODEL, "hasApiKey": bool(os.environ.get("ANTHROPIC_API_KEY")), "maxPages": MAX_PAGES})


@app.get("/api/uploads")
def list_uploads():
    docs, rows = [], []
    for f in sorted(UPLOADS.glob("up-*/doc.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        d = json.loads(f.read_text(encoding="utf-8"))
        docs.append(d["document"])
        rows.extend(d["rows"])
    return jsonify({"runId": "uploads", "documents": docs, "rows": rows})


@app.delete("/api/uploads/<doc_id>")
def delete_upload(doc_id):
    if not re.fullmatch(r"up-[0-9a-f]{10}", doc_id):
        return jsonify({"error": "bad id"}), 400
    d = UPLOADS / doc_id
    if d.exists():
        shutil.rmtree(d)
    return jsonify({"ok": True})


@app.post("/api/extract")
def extract():
    f = request.files.get("file")
    if not f:
        return jsonify({"error": "no file"}), 400
    data = f.read()
    try:
        pdf = pymupdf.open(stream=data, filetype="pdf")
    except Exception as e:  # not a PDF
        return jsonify({"error": f"could not open PDF: {e}"}), 400
    n = len(pdf)
    if n == 0:
        return jsonify({"error": "empty PDF"}), 400

    doc_type = request.form.get("docType", "CHNA").strip() or "CHNA"
    name = (request.form.get("sourceName") or "").strip() or re.sub(r"\.pdf$", "", f.filename or "upload", flags=re.I)
    try:
        year = int(request.form.get("year") or 0) or (2024 if doc_type == "implementation strategy" else 2023)
    except ValueError:
        year = 2023
    wanted = parse_pages(request.form.get("pages", ""), n)
    warnings = []
    if n > MAX_PAGES and not request.form.get("pages", "").strip():
        warnings.append(f"Only the first {MAX_PAGES} of {n} pages were sent to the model.")

    doc_id = "up-" + hashlib.sha1(data).hexdigest()[:10]
    run_id = "upload-" + time.strftime("%Y%m%d-%H%M%S")
    ddir = UPLOADS / doc_id
    ddir.mkdir(parents=True, exist_ok=True)

    texts, pngs = {}, {}
    for i, page in enumerate(pdf, start=1):
        texts[str(i)] = page.get_text("text")
        words = [{**norm_box(pymupdf.Rect(w[:4]), page.rect), "text": w[4]} for w in page.get_text("words")]
        (ddir / f"p{i:03d}.words.json").write_text(json.dumps(words, ensure_ascii=False), encoding="utf-8")
        pix = page.get_pixmap(dpi=100)
        pix.save(ddir / f"p{i:03d}.png")
        pngs[i] = pix.tobytes("png")

    client = get_client()
    rows, uncovered, per_page = [], [], []
    usage = {"input_tokens": 0, "output_tokens": 0}
    model_used = MODEL
    t0 = time.time()
    if client is None:
        warnings.append("No ANTHROPIC_API_KEY is set, so no rows were extracted. Add rows by hand, or set the key in .env and upload again.")
    else:
        for p in wanted:
            t1 = time.time()
            text = texts[str(p)]
            png = pngs[p] if len(text.split()) < IMAGE_IF_FEWER_WORDS else None
            try:
                out, u, model_used = code_page(client, doc_type, p, text, png)
                (ddir / f"p{p:03d}.model.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
                rows.extend(rows_from(out, pdf[p - 1], p, doc_id, run_id, texts))
                uncovered.extend({"page": p, "topic": t} for t in out.get("uncovered_topics", []))
                usage = {k: usage[k] + u[k] for k in usage}
                per_page.append({"page": p, "rows": len(out["rows"]), "seconds": round(time.time() - t1, 1), "withImage": png is not None, "summary": out.get("page_summary", "")})
            except Exception as e:  # keep going; the page can still be reviewed by hand
                warnings.append(f"Page {p}: extraction failed ({e.__class__.__name__}: {str(e)[:200]})")
                per_page.append({"page": p, "rows": 0, "seconds": round(time.time() - t1, 1), "error": str(e)[:200]})

    document = {
        "id": doc_id, "sourceName": name, "docType": doc_type, "year": year, "pageCount": n,
        "pageImage": {"kind": "template", "template": f"/uploads/{doc_id}/p{{page}}.png", "pad": 3},
        "wordsTemplate": f"/uploads/{doc_id}/p{{page}}.words.json",
        "pageTexts": texts, "skippedPages": [p for p in range(1, n + 1) if p not in wanted],
        "notes": warnings,
    }
    extraction = {
        "model": model_used, "runId": run_id, "pagesCoded": wanted, "perPage": per_page, "usage": usage,
        "uncoveredTopics": uncovered, "durationSeconds": round(time.time() - t0, 1),
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%S"), "fileName": f.filename,
        "promptFiles": ["prompts/system_prompt.md", "prompts/user_prompt_template.md", "prompts/output_schema.json"],
    }
    (ddir / "doc.json").write_text(json.dumps({"document": document, "rows": rows, "extraction": extraction}, indent=1, ensure_ascii=False), encoding="utf-8")
    return jsonify({"document": document, "rows": rows, "extraction": extraction, "warnings": warnings})


if __name__ == "__main__":
    print(f"extraction server on http://localhost:8787  model={MODEL}  api_key={'set' if os.environ.get('ANTHROPIC_API_KEY') else 'MISSING'}")
    app.run(host="127.0.0.1", port=8787, debug=False, threaded=True)
