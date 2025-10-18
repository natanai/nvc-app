#!/usr/bin/env python3
"""Extract need claims from the analysis document into structured JSON."""
from __future__ import annotations

import json
import re
import sys
import csv
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DOC_PATH = ROOT / "data" / "Analysis of Psychological and Social Human Needs.docx"
OUTPUT_PATH = ROOT / "data" / "need-claims.json"
NEEDS_CSV_PATH = ROOT / "data" / "Needs.csv"

NAMESPACE = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
SUPPORTING_SOURCE_PATTERN = re.compile(r"[\-\u2013]\s*(https?://[^\s]+)(?:\s+\(([^)]+)\))?", re.IGNORECASE)


def load_valid_need_names() -> dict[str, str]:
    """Load the canonical need titles from the CSV dataset."""
    mapping: dict[str, str] = {}
    with open(NEEDS_CSV_PATH, newline="", encoding="utf-8-sig") as csv_file:
        reader = csv.DictReader(csv_file)
        for row in reader:
            title = (row.get("Title") or "").strip()
            if not title:
                continue
            key = title.lower()
            if key not in mapping:
                mapping[key] = title
    return mapping


VALID_NEED_NAMES = load_valid_need_names()


def load_paragraphs() -> list[str]:
    """Return significant paragraphs from the Word document."""
    if not DOC_PATH.exists():
        raise SystemExit(f"Document not found: {DOC_PATH}")

    with ZipFile(DOC_PATH) as archive:
        try:
            xml_bytes = archive.read("word/document.xml")
        except KeyError as error:
            raise SystemExit("Unable to locate word/document.xml inside the document") from error

    root = ET.fromstring(xml_bytes)
    paragraphs: list[str] = []

    for paragraph in root.findall(".//w:p", NAMESPACE):
        texts = [node.text or "" for node in paragraph.findall(".//w:t", NAMESPACE)]
        if not texts:
            continue
        text = "".join(texts).strip()
        if text:
            paragraphs.append(text)

    return paragraphs


def clean_name(text: str) -> str:
    """Normalize a heading into a canonical need title candidate."""
    cleaned = text.strip().strip('“”"').replace("\\", "")
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = re.sub(r"\s*\(Rewritten Only\)\s*$", "", cleaned, flags=re.IGNORECASE)
    return cleaned.strip()


def split_name_prefix(text: str) -> tuple[str | None, str]:
    """Split a claim line into an optional name prefix and the remaining text."""
    body = text.strip()
    if not body or body[0] in {'“', '"'}:
        return None, body

    for marker in (" — ", " – ", " - "):
        index = body.find(marker)
        if 0 < index <= 60:
            maybe_name = clean_name(body[:index])
            remainder = body[index + len(marker):].strip()
            if maybe_name and len(maybe_name.split()) <= 8 and maybe_name.lower() in VALID_NEED_NAMES:
                return maybe_name, remainder

    return None, body


def parse_supporting_sources(text: str) -> list[dict[str, str]]:
    """Parse the inline supporting sources list into structured entries."""
    matches = SUPPORTING_SOURCE_PATTERN.findall(text)
    sources: list[dict[str, str]] = []
    for url, description in matches:
        cleaned_url = url.rstrip(".,")
        sources.append(
            {
                "url": cleaned_url,
                "description": (description or "").strip(),
            }
        )
    return sources


def extract_claims(paragraphs: list[str]) -> list[dict[str, object]]:
    """Convert the paragraph stream into structured claim records."""
    claims: dict[str, dict[str, object]] = {}
    order: list[str] = []
    skipped_names: set[str] = set()
    current_key: str | None = None

    def get_entry(name: str) -> dict[str, object] | None:
        cleaned = clean_name(name)
        if not cleaned:
            return None
        key = cleaned.lower()
        canonical = VALID_NEED_NAMES.get(key)
        if canonical is None:
            skipped_names.add(cleaned)
            return None
        if key not in claims:
            claims[key] = {
                "name": canonical,
                "originalClaim": "",
                "rewrittenClaim": "",
                "alternateClaim": "",
                "supportingSources": [],
            }
            order.append(key)
        return claims[key]

    for text in paragraphs:
        if text.startswith("[") or text.startswith("Note:"):
            break

        if text.startswith("Original Claim:"):
            body = text.split(":", 1)[1].strip()
            name_candidate, claim_text = split_name_prefix(body)
            entry = get_entry(name_candidate) if name_candidate else (claims.get(current_key) if current_key else None)
            if entry is None:
                current_key = None
                continue
            entry["originalClaim"] = claim_text
            current_key = clean_name(entry["name"]).lower()
            continue

        if text.startswith("Supporting Source"):
            if current_key is None or current_key not in claims:
                continue
            claims[current_key]["supportingSources"] = parse_supporting_sources(text)
            continue

        if text.startswith("Rewritten Claim:"):
            body = text.split(":", 1)[1].strip()
            name_candidate, claim_text = split_name_prefix(body)
            entry = get_entry(name_candidate) if name_candidate else (claims.get(current_key) if current_key else None)
            if entry is None:
                current_key = None
                continue
            entry["rewrittenClaim"] = claim_text
            current_key = clean_name(entry["name"]).lower()
            continue

        if text.startswith("Alternate Evidence-Based Claim"):
            if current_key is None or current_key not in claims:
                continue
            claims[current_key]["alternateClaim"] = text.split(":", 1)[1].strip()
            continue

        # Skip the introductory header paragraphs
        if text.startswith("Analysis of Psychological") or text.startswith("Below, each identified"):
            continue

        entry = get_entry(text)
        if entry is None:
            current_key = None
            continue
        current_key = clean_name(entry["name"]).lower()

    if skipped_names:
        skipped_list = ", ".join(sorted(skipped_names))
        print(f"Warning: skipped entries for unknown needs: {skipped_list}", file=sys.stderr)

    return [claims[key] for key in order]


def main() -> None:
    paragraphs = load_paragraphs()
    claims = extract_claims(paragraphs)

    OUTPUT_PATH.write_text(
        json.dumps(claims, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
