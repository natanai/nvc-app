export const REVERSE_INFERENCE_OVERRIDES_DESCRIPTION =
  'Canonical source for reviewed exceptions applied after formula-derived reverse inference. Keep this file limited to intentional deviations that cannot yet be derived from the shared Body Cues/emotion model.';

function splitPipe(value) {
  return String(value || '')
    .split('|')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseJsonCell(value, fallback, label) {
  const text = String(value || '').trim();
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} must contain valid JSON: ${error.message}`);
  }
}

export function flattenReverseInferenceOverrides(source) {
  const rows = [];
  for (const [feeling, override] of Object.entries(source?.entries || {})) {
    rows.push({
      feeling,
      zones: (override?.zones || []).join('|'),
      sdtNeeds: (override?.needsHypotheses?.sdt || []).join('|'),
      nvcNeedsJson: JSON.stringify(override?.needsHypotheses?.nvc || []),
      bodyCueOrder: (override?.bodyCueOrder || []).join('|'),
      bodyCueOverridesJson: JSON.stringify(override?.bodyCueOverrides || {}),
      evidenceKeysAppend: (override?.evidenceKeysAppend || []).join('|'),
    });
  }
  return rows;
}

export function buildReverseInferenceOverridesFromRows(rows, existingSource = {}) {
  const entries = {};

  for (const [index, row] of rows.entries()) {
    const feeling = String(row?.feeling || '').trim();
    if (!feeling) continue;
    if (Object.hasOwn(entries, feeling)) {
      throw new Error(`reverse-inference-overrides.csv contains duplicate feeling "${feeling}".`);
    }

    const override = {};
    const zones = splitPipe(row.zones);
    const sdt = splitPipe(row.sdtNeeds);
    const nvc = parseJsonCell(
      row.nvcNeedsJson,
      [],
      `reverse-inference-overrides.csv row ${index + 2} nvcNeedsJson`,
    );
    const bodyCueOrder = splitPipe(row.bodyCueOrder);
    const bodyCueOverrides = parseJsonCell(
      row.bodyCueOverridesJson,
      {},
      `reverse-inference-overrides.csv row ${index + 2} bodyCueOverridesJson`,
    );
    const evidenceKeysAppend = splitPipe(row.evidenceKeysAppend);

    if (!Array.isArray(nvc)) {
      throw new Error(`reverse-inference-overrides.csv row ${index + 2} nvcNeedsJson must be a JSON array.`);
    }
    if (!bodyCueOverrides || typeof bodyCueOverrides !== 'object' || Array.isArray(bodyCueOverrides)) {
      throw new Error(
        `reverse-inference-overrides.csv row ${index + 2} bodyCueOverridesJson must be a JSON object.`,
      );
    }

    if (zones.length) override.zones = zones;
    if (sdt.length || nvc.length) override.needsHypotheses = { sdt, nvc };
    if (bodyCueOrder.length) override.bodyCueOrder = bodyCueOrder;
    if (Object.keys(bodyCueOverrides).length) override.bodyCueOverrides = bodyCueOverrides;
    if (evidenceKeysAppend.length) override.evidenceKeysAppend = evidenceKeysAppend;

    entries[feeling] = override;
  }

  return {
    ...existingSource,
    schemaVersion: 1,
    description:
      existingSource?.description || REVERSE_INFERENCE_OVERRIDES_DESCRIPTION,
    entries,
  };
}
