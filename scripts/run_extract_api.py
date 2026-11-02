#!/usr/bin/env python3
"""OPTIONAL: code pages through the Claude API instead of in-chat. Same system prompt, same
template, same JSON schema as the in-chat run, so the two runs can be compared with compare_runs.py.

Needs ANTHROPIC_API_KEY in the environment (or an `ant auth login` profile) and `pip install anthropic`.

Usage:
  python3 -I scripts/run_extract_api.py run2 CHNA 23 24 --model claude-opus-5-5
  python3 -I scripts/run_extract_api.py run2 IS 11 12 13
Writes work/runs/<run>/<LABEL>_p<NNN>.json (schema-validated) and <LABEL>_p<NNN>.raw.txt.
"""
import argparse
import json
import pathlib
import sys

import anthropic
import jsonschema

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from make_page_prompt import build_user_message  # noqa: E402

SYSTEM = pathlib.Path("prompts/system_prompt.md").read_text(encoding="utf-8")
SCHEMA = json.loads(pathlib.Path("prompts/output_schema.json").read_text(encoding="utf-8"))


def code_page(client: anthropic.Anthropic, model: str, label: str, page: int, structured: bool) -> tuple[dict, str]:
    user = build_user_message(label, page)
    extra = {"output_config": {"effort": "medium"}}
    if structured:
        # Structured outputs: the server guarantees the text block is valid JSON for this schema.
        extra["output_config"]["format"] = {"type": "json_schema", "schema": SCHEMA}
    resp = client.messages.create(
        model=model,
        max_tokens=16000,
        system=SYSTEM,
        messages=[{"role": "user", "content": user}],
        extra_body=extra,  # passed straight through to the request body, independent of SDK version
    )
    if resp.stop_reason == "refusal":
        raise RuntimeError(f"model declined page {label} p{page}: {getattr(resp, 'stop_details', None)}")
    text = next(b.text for b in resp.content if b.type == "text").strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text[text.find("{"):text.rfind("}") + 1]
    data = json.loads(text)
    jsonschema.validate(data, SCHEMA)
    return data, text


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("run")
    ap.add_argument("label", help="CHNA or IS (dir under work/pages)")
    ap.add_argument("pages", type=int, nargs="+")
    ap.add_argument("--model", default="claude-opus-5-5")
    ap.add_argument("--no-structured", action="store_true", help="skip output_config.format; rely on prompt + jsonschema")
    a = ap.parse_args()

    out = pathlib.Path("work/runs") / a.run
    out.mkdir(parents=True, exist_ok=True)
    client = anthropic.Anthropic()
    for p in a.pages:
        try:
            data, raw = code_page(client, a.model, a.label, p, structured=not a.no_structured)
        except (json.JSONDecodeError, jsonschema.ValidationError) as e:
            print(f"{a.label} p{p}: invalid JSON from model ({e.__class__.__name__}); raw saved")
            (out / f"{a.label}_p{p:03d}.raw.txt").write_text(str(e), encoding="utf-8")
            continue
        (out / f"{a.label}_p{p:03d}.json").write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        (out / f"{a.label}_p{p:03d}.raw.txt").write_text(raw, encoding="utf-8")
        print(f"{a.label} p{p}: {len(data['rows'])} rows, {len(data['uncovered_topics'])} uncovered topics")


if __name__ == "__main__":
    main()
