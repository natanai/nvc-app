#!/usr/bin/env python3
"""Generate a report of feelings or needs referenced on the site without landing pages."""
from __future__ import annotations

import csv
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Dict, Iterable, List, Set, Tuple

ROOT = Path(__file__).resolve().parent.parent
FEELINGS_DIR = ROOT / "feelings"
NEEDS_DIR = ROOT / "needs"
REPORT_PATH = ROOT / "data" / "reports" / "missing-landing-pages.csv"
ALEXITHYMIA_DATA_PATH = ROOT / "scripts" / "alexithymia-support-data.js"
REVERSE_INFERENCE_PATH = ROOT / "data" / "reverse-inference.json"


def load_csv(path: Path) -> List[Dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def load_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def existing_slugs(directory: Path) -> Set[str]:
    slugs: Set[str] = set()
    for entry in directory.iterdir():
        if entry.is_dir() and (entry / "index.html").exists():
            slugs.add(entry.name)
    return slugs


def build_title_to_slug(
    rows: Iterable[Dict[str, str]],
    *,
    title_fields: Iterable[str],
    slug_fields: Iterable[str],
) -> Dict[str, str]:
    mapping: Dict[str, str] = {}
    for row in rows:
        title = ""
        for field in title_fields:
            value = row.get(field, "").strip()
            if value:
                title = value.lower()
                break
        slug = ""
        for field in slug_fields:
            value = row.get(field, "").strip()
            if value:
                slug = value
                break
        if title and slug:
            mapping[title] = slug
    return mapping


def add_reference(
    bucket: Dict[Tuple[str, str, str], Set[str]],
    *,
    kind: str,
    word: str,
    slug: str,
    reference: str,
) -> None:
    key = (kind, word or "", slug or "")
    bucket[key].add(reference)


def extract_js_object_block(text: str, export_name: str) -> str:
    pattern = re.compile(
        rf"export const {re.escape(export_name)}\s*=\s*\{{(.*?)\n\}};",
        re.DOTALL,
    )
    match = pattern.search(text)
    return match.group(1) if match else ""


def parse_emotion_library_keys(text: str) -> Set[str]:
    block = extract_js_object_block(text, "EMOTION_LIBRARY")
    if not block:
        return set()
    return {
        match.group(1)
        for match in re.finditer(r"^\s*([a-z0-9_-]+):\s*\{", block, flags=re.MULTILINE)
    }


def parse_feeling_slug_aliases(text: str) -> Dict[str, str]:
    block = extract_js_object_block(text, "FEELING_SLUG_ALIASES")
    if not block:
        return {}
    return {
        slug: canonical
        for slug, canonical in re.findall(r'"([^"\\]+)":\s*"([^"\\]+)"', block)
    }


def load_slug_map_from_reverse_inference(path: Path) -> Dict[str, str]:
    if not path.exists():
        return {}
    data = load_json(path)
    meta = data.get("_meta", {}) if isinstance(data, dict) else {}
    slug_map = meta.get("slugMap", {})
    return {str(slug): str(canonical) for slug, canonical in slug_map.items()}


def canonical_to_word(value: str) -> str:
    normalized = (value or "").replace("_", " ").replace("-", " ")
    return normalized.strip().title() if normalized.strip() else ""


def first_value(row: Dict[str, str], *keys: str) -> str:
    for key in keys:
        value = row.get(key, "").strip()
        if value:
            return value
    return ""


def main() -> None:
    feelings_rows = load_csv(ROOT / "data" / "Feelings.csv")
    needs_rows = load_csv(ROOT / "data" / "Needs.csv")

    feeling_slugs = existing_slugs(FEELINGS_DIR)
    need_slugs = existing_slugs(NEEDS_DIR)

    title_to_feeling = build_title_to_slug(
        feelings_rows,
        title_fields=["Feeling name", "Title"],
        slug_fields=["Slug override", "Slug"],
    )
    title_to_need = build_title_to_slug(
        needs_rows,
        title_fields=["Need name", "Title"],
        slug_fields=["Slug override", "Slug"],
    )

    missing: Dict[Tuple[str, str, str], Set[str]] = defaultdict(set)

    # Check textual references in CSV sources
    situations_rows = load_csv(ROOT / "data" / "Situations.csv")
    for row in situations_rows:
        situation = first_value(row, "Situation name", "Title") or "(untitled situation)"
        feelings_cell = first_value(row, "Feeling magnets", "Feelings")
        for word in filter(None, (w.strip() for w in re.split(r",|\n", feelings_cell))):
            key = word.lower()
            slug = title_to_feeling.get(key, "")
            if slug and slug in feeling_slugs:
                continue
            add_reference(
                missing,
                kind="feeling",
                word=word,
                slug=slug,
                reference=f"data/Situations.csv → {situation}",
            )
        needs_cell = first_value(row, "Need magnets", "Needs")
        for word in filter(None, (w.strip() for w in re.split(r",|\n", needs_cell))):
            key = word.lower()
            slug = title_to_need.get(key, "")
            if slug and slug in need_slugs:
                continue
            add_reference(
                missing,
                kind="need",
                word=word,
                slug=slug,
                reference=f"data/Situations.csv → {situation}",
            )

    for row in needs_rows:
        need_title = first_value(row, "Need name", "Title") or "(untitled need)"
        strategy_cells = row.get("Strategy cards", "")
        for line in filter(None, (entry.strip() for entry in strategy_cells.splitlines())):
            parts = [segment.strip() for segment in line.split("|")]
            while len(parts) < 5:
                parts.append("")
            strategy_title = parts[0] or "(untitled strategy)"
            extra_needs_field = parts[4]
            for word in filter(
                None,
                (w.strip() for w in re.split(r"[,;]", extra_needs_field)),
            ):
                key = word.lower()
                slug = title_to_need.get(key, "")
                if slug and slug in need_slugs:
                    continue
                add_reference(
                    missing,
                    kind="need",
                    word=word,
                    slug=slug,
                    reference=f"data/Needs.csv → {need_title} → {strategy_title}",
                )

    # Check slug references in generated HTML
    html_files = list(ROOT.rglob("*.html"))
    feelings_slug_pattern = re.compile(r"href=\"[^\"]*/feelings/([a-z0-9-]+)/\"")
    needs_slug_pattern = re.compile(r"href=\"[^\"]*/needs/([a-z0-9-]+)/\"")
    magnet_feelings_pattern = re.compile(r"data-magnet-id=\"feelings-([a-z0-9-]+)\"")
    magnet_needs_pattern = re.compile(r"data-magnet-id=\"needs-([a-z0-9-]+)\"")

    for html_path in html_files:
        text = html_path.read_text(errors="ignore")
        for slug in set(feelings_slug_pattern.findall(text)) | set(
            magnet_feelings_pattern.findall(text)
        ):
            if slug in feeling_slugs:
                continue
            add_reference(
                missing,
                kind="feeling",
                word="",
                slug=slug,
                reference=str(html_path.relative_to(ROOT)),
            )
        for slug in set(needs_slug_pattern.findall(text)) | set(
            magnet_needs_pattern.findall(text)
        ):
            if slug in need_slugs:
                continue
            add_reference(
                missing,
                kind="need",
                word="",
                slug=slug,
                reference=str(html_path.relative_to(ROOT)),
            )

    # Check slugs in data/index.json (strategies inventory)
    index_data = load_json(ROOT / "data" / "index.json")
    for entry in index_data.get("strategies", []):
        for need in entry.get("needs", []):
            slug = need.get("slug", "")
            if slug and slug not in need_slugs:
                add_reference(
                    missing,
                    kind="need",
                    word=need.get("title", ""),
                    slug=slug,
                    reference="data/index.json → strategies",
                )

    # Check alexithymia support resources for additional feelings
    alexithymia_text = (
        ALEXITHYMIA_DATA_PATH.read_text(encoding="utf-8")
        if ALEXITHYMIA_DATA_PATH.exists()
        else ""
    )
    emotion_keys = parse_emotion_library_keys(alexithymia_text)
    alias_map = parse_feeling_slug_aliases(alexithymia_text)
    reverse_slug_map = load_slug_map_from_reverse_inference(REVERSE_INFERENCE_PATH)

    combined_slug_map: Dict[str, str] = {}
    slug_sources: Dict[str, str] = {}
    for slug, canonical in reverse_slug_map.items():
        if slug not in combined_slug_map:
            combined_slug_map[slug] = canonical
            slug_sources[slug] = "data/reverse-inference.json → _meta.slugMap"
    for slug, canonical in alias_map.items():
        if slug not in combined_slug_map:
            combined_slug_map[slug] = canonical
            slug_sources[slug] = "scripts/alexithymia-support-data.js → FEELING_SLUG_ALIASES"

    canonical_to_slug: Dict[str, str] = {}
    for slug, canonical in combined_slug_map.items():
        if slug in feeling_slugs:
            canonical_to_slug.setdefault(canonical, slug)
    for slug, canonical in combined_slug_map.items():
        canonical_to_slug.setdefault(canonical, slug)

    for canonical, slug in canonical_to_slug.items():
        if not slug or slug in feeling_slugs:
            continue
        add_reference(
            missing,
            kind="feeling",
            word=canonical_to_word(canonical),
            slug=slug,
            reference=slug_sources.get(slug, "scripts/alexithymia-support-data.js → FEELING_SLUG_ALIASES"),
        )

    for canonical in emotion_keys:
        slug = canonical_to_slug.get(canonical, "")
        if slug and slug in feeling_slugs:
            continue
        add_reference(
            missing,
            kind="feeling",
            word=canonical_to_word(canonical),
            slug=slug,
            reference="scripts/alexithymia-support-data.js → EMOTION_LIBRARY",
        )

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with REPORT_PATH.open("w", newline="", encoding="utf-8") as report:
        writer = csv.writer(report)
        writer.writerow(["Type", "Word", "Slug", "References"])
        if missing:
            for (kind, word, slug), references in sorted(missing.items()):
                resolved_slug = slug
                if not resolved_slug and word:
                    lookup = title_to_feeling if kind == "feeling" else title_to_need
                    resolved_slug = lookup.get(word.lower(), "")
                writer.writerow(
                    [
                        kind,
                        word,
                        resolved_slug,
                        " | ".join(sorted(references)),
                    ]
                )
        else:
            writer.writerow(
                [
                    "info",
                    "",
                    "",
                    "No missing landing pages detected.",
                ]
            )


if __name__ == "__main__":
    main()
