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


def build_title_to_slug(rows: Iterable[Dict[str, str]]) -> Dict[str, str]:
    mapping: Dict[str, str] = {}
    for row in rows:
        title = row.get("Title", "").strip().lower()
        slug = row.get("Slug", "").strip()
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


def main() -> None:
    feelings_rows = load_csv(ROOT / "data" / "Feelings.csv")
    needs_rows = load_csv(ROOT / "data" / "Needs.csv")

    feeling_slugs = existing_slugs(FEELINGS_DIR)
    need_slugs = existing_slugs(NEEDS_DIR)

    title_to_feeling = build_title_to_slug(feelings_rows)
    title_to_need = build_title_to_slug(needs_rows)

    missing: Dict[Tuple[str, str, str], Set[str]] = defaultdict(set)

    # Check textual references in CSV sources
    situations_rows = load_csv(ROOT / "data" / "Situations.csv")
    for row in situations_rows:
        situation = row.get("Title", "").strip() or "(untitled situation)"
        for word in filter(None, (w.strip() for w in row.get("Feelings", "").split(","))):
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
        for word in filter(None, (w.strip() for w in row.get("Needs", "").split(","))):
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

    strategies_rows = load_csv(ROOT / "data" / "Strategies.csv")
    for row in strategies_rows:
        strategy = row.get("Title", "").strip() or "(untitled strategy)"
        for word in filter(None, (w.strip() for w in row.get("Needs", "").split(","))):
            key = word.lower()
            slug = title_to_need.get(key, "")
            if slug and slug in need_slugs:
                continue
            add_reference(
                missing,
                kind="need",
                word=word,
                slug=slug,
                reference=f"data/Strategies.csv → {strategy}",
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
