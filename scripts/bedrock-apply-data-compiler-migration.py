from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILD_DATA = ROOT / 'scripts' / 'build-data.mjs'
DATA_FILES = [
    ROOT / 'data' / 'index.json',
    ROOT / 'data' / 'body-regions.json',
    ROOT / 'data' / 'reverse-inference.json',
]


def require_single(source: str, needle: str, label: str) -> None:
    count = source.count(needle)
    if count != 1:
        raise RuntimeError(f'Expected exactly one {label}; found {count}.')


def run(*args: str) -> None:
    subprocess.run(args, cwd=ROOT, check=True)


def patch_build_data() -> None:
    source = BUILD_DATA.read_text()

    constants_anchor = "const DATA_DIR = join(ROOT, 'data');\n"
    constants = """const DATA_DIR = join(ROOT, 'data');

const PAGE_TO_MODEL_KEY = new Map([
  ['excited', 'excitement'],
  ['joyful', 'joy'],
  ['hopeful', 'hope'],
  ['contented', 'contentment'],
]);
const MODEL_TO_PAGE_KEY = new Map(
  Array.from(PAGE_TO_MODEL_KEY.entries(), ([pageKey, modelKey]) => [modelKey, pageKey]),
);
"""
    if 'const PAGE_TO_MODEL_KEY = new Map([' not in source:
        require_single(source, constants_anchor, 'DATA_DIR anchor')
        source = source.replace(constants_anchor, constants, 1)

    helpers_anchor = "const bodyRegions = buildBodyRegions(rawCueRows);\n"
    helpers = r"""const bodyRegions = buildBodyRegions(rawCueRows);

function bodyRegionsForInference(regions) {
  return regions.map((region) => ({
    ...region,
    options: (region.options || []).map((option) => {
      const emotions = {};
      for (const [pageKey, weight] of Object.entries(option.emotions || {})) {
        const modelKey = PAGE_TO_MODEL_KEY.get(pageKey) || pageKey;
        const previous = emotions[modelKey];
        emotions[modelKey] = Number.isFinite(previous) ? Math.max(previous, weight) : weight;
      }
      return { ...option, emotions };
    }),
  }));
}

function restorePageFacingInferenceKeys(index) {
  const output = {};

  for (const [modelKey, value] of Object.entries(index)) {
    if (modelKey === '_meta') continue;
    const pageKey = MODEL_TO_PAGE_KEY.get(modelKey) || modelKey;
    const entry = value && typeof value === 'object' ? { ...value } : value;

    if (entry && Array.isArray(entry.evidenceKeys)) {
      entry.evidenceKeys = entry.evidenceKeys.map((key) =>
        key === `emotion-${modelKey}` ? `emotion-${pageKey}` : key,
      );
    }
    output[pageKey] = entry;
  }

  if (index._meta) output._meta = index._meta;
  return output;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function applyReverseInferenceOverrides(index, source) {
  if (!source || source.schemaVersion !== 1 || !source.entries || typeof source.entries !== 'object') {
    throw new Error('data/reverse-inference-overrides.json must use schemaVersion 1 with an entries object.');
  }

  const output = cloneJson(index);
  const allowedFields = new Set([
    'zones',
    'needsHypotheses',
    'bodyCueOrder',
    'bodyCueOverrides',
    'evidenceKeysAppend',
  ]);

  for (const [pageKey, override] of Object.entries(source.entries)) {
    const entry = output[pageKey];
    if (!entry || pageKey === '_meta') {
      throw new Error(`Reverse-inference override references unknown generated feeling "${pageKey}".`);
    }
    if (!override || typeof override !== 'object' || Array.isArray(override)) {
      throw new Error(`Reverse-inference override for "${pageKey}" must be an object.`);
    }

    const unknownFields = Object.keys(override).filter((field) => !allowedFields.has(field));
    if (unknownFields.length) {
      throw new Error(
        `Reverse-inference override for "${pageKey}" has unknown field(s): ${unknownFields.join(', ')}.`,
      );
    }

    if (Object.hasOwn(override, 'zones')) {
      if (!Array.isArray(override.zones)) {
        throw new Error(`Override zones for "${pageKey}" must be an array.`);
      }
      entry.zones = cloneJson(override.zones);
    }

    if (Object.hasOwn(override, 'needsHypotheses')) {
      if (
        !override.needsHypotheses ||
        typeof override.needsHypotheses !== 'object' ||
        Array.isArray(override.needsHypotheses)
      ) {
        throw new Error(`Override needsHypotheses for "${pageKey}" must be an object.`);
      }
      entry.needsHypotheses = cloneJson(override.needsHypotheses);
    }

    const originalBodyCues = Array.isArray(entry.bodyCues)
      ? entry.bodyCues.map((cue) => cloneJson(cue))
      : [];
    const originalBodyEvidence = new Set(
      originalBodyCues.map((cue) => cue.evidenceKey).filter(Boolean),
    );
    let bodyCues = originalBodyCues;
    let bodyCueChanged = false;

    if (Object.hasOwn(override, 'bodyCueOrder')) {
      if (!Array.isArray(override.bodyCueOrder)) {
        throw new Error(`Override bodyCueOrder for "${pageKey}" must be an array.`);
      }
      if (new Set(override.bodyCueOrder).size !== override.bodyCueOrder.length) {
        throw new Error(`Override bodyCueOrder for "${pageKey}" contains duplicate option IDs.`);
      }

      const byId = new Map(originalBodyCues.map((cue) => [cue.optionId, cue]));
      bodyCues = override.bodyCueOrder.map((optionId) => {
        const cue = byId.get(optionId);
        if (!cue) {
          throw new Error(
            `Override bodyCueOrder for "${pageKey}" references unknown cue "${optionId}".`,
          );
        }
        return cloneJson(cue);
      });
      bodyCueChanged = true;
    }

    if (Object.hasOwn(override, 'bodyCueOverrides')) {
      if (
        !override.bodyCueOverrides ||
        typeof override.bodyCueOverrides !== 'object' ||
        Array.isArray(override.bodyCueOverrides)
      ) {
        throw new Error(`Override bodyCueOverrides for "${pageKey}" must be an object.`);
      }

      const available = new Set(bodyCues.map((cue) => cue.optionId));
      for (const optionId of Object.keys(override.bodyCueOverrides)) {
        if (!available.has(optionId)) {
          throw new Error(
            `Override bodyCueOverrides for "${pageKey}" references unavailable cue "${optionId}".`,
          );
        }
      }

      bodyCues = bodyCues.map((cue) => {
        const patch = override.bodyCueOverrides[cue.optionId];
        return patch ? { ...cue, ...cloneJson(patch) } : cue;
      });
      bodyCueChanged = true;
    }

    if (bodyCueChanged) {
      entry.bodyCues = bodyCues;
      const nonBodyEvidence = (entry.evidenceKeys || []).filter(
        (key) => !originalBodyEvidence.has(key),
      );
      entry.evidenceKeys = [
        ...nonBodyEvidence,
        ...bodyCues.map((cue) => cue.evidenceKey).filter(Boolean),
      ];
    }

    if (Object.hasOwn(override, 'evidenceKeysAppend')) {
      if (!Array.isArray(override.evidenceKeysAppend)) {
        throw new Error(`Override evidenceKeysAppend for "${pageKey}" must be an array.`);
      }
      entry.evidenceKeys = Array.from(
        new Set([...(entry.evidenceKeys || []), ...override.evidenceKeysAppend]),
      );
    }
  }

  return output;
}
"""
    if 'function applyReverseInferenceOverrides(index, source)' not in source:
        require_single(source, helpers_anchor, 'bodyRegions helper anchor')
        source = source.replace(helpers_anchor, helpers, 1)

    old_tail = """const reverseIndex = buildReverseInferenceIndex({ needs, feelings, bodyRegions });
writeFileSync(join(DATA_DIR, 'reverse-inference.json'), `${JSON.stringify(reverseIndex, null, 2)}\n`);
"""
    new_tail = """const modelBodyRegions = bodyRegionsForInference(bodyRegions);
const modelReverseIndex = buildReverseInferenceIndex({
  needs,
  feelings,
  bodyRegions: modelBodyRegions,
});
const pageReverseIndex = restorePageFacingInferenceKeys(modelReverseIndex);
const reverseInferenceOverrides = JSON.parse(
  readFileSync(join(DATA_DIR, 'reverse-inference-overrides.json'), 'utf8'),
);
const reverseIndex = applyReverseInferenceOverrides(pageReverseIndex, reverseInferenceOverrides);
writeFileSync(join(DATA_DIR, 'reverse-inference.json'), `${JSON.stringify(reverseIndex, null, 2)}\n`);
"""
    if new_tail not in source:
        require_single(source, old_tail, 'reverse-inference write block')
        source = source.replace(old_tail, new_tail, 1)

    BUILD_DATA.write_text(source)


def parsed(path: Path):
    return json.loads(path.read_text())


def main() -> None:
    originals = {path: path.read_bytes() for path in DATA_FILES}
    patch_build_data()
    run('node', '--check', 'scripts/build-data.mjs')

    try:
        run('node', 'scripts/build-data.mjs')

        for path in DATA_FILES:
            before = json.loads(originals[path].decode('utf-8'))
            after = parsed(path)
            exact = originals[path] == path.read_bytes()
            semantic = before == after
            print(f'{path.relative_to(ROOT)}: exact={str(exact).lower()} semantic={str(semantic).lower()}')
            if not semantic:
                raise RuntimeError(f'Direct compiler changed production semantics in {path.relative_to(ROOT)}.')

        run('node', 'tests/data-integrity.test.mjs')

        first = {path: path.read_bytes() for path in DATA_FILES}
        run('node', 'scripts/build-data.mjs')
        for path in DATA_FILES:
            if first[path] != path.read_bytes():
                raise RuntimeError(f'Second direct data build changed {path.relative_to(ROOT)}.')
        print('Second direct data build is byte-identical.')
    finally:
        for path, content in originals.items():
            path.write_bytes(content)


if __name__ == '__main__':
    main()
