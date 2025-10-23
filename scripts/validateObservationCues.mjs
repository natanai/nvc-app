import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const schemaPath = path.join(root, 'data', 'observation_formula_schema.json');
const modulesPath = path.join(root, 'data', 'observation_cue_modules.json');

function readJson(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(text);
  } catch (error) {
    console.error(`❌ Unable to read ${path.relative(root, filePath)}:`, error.message);
    process.exit(1);
  }
}

function compilePattern(raw) {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) {
    return null;
  }
  const attempts = [trimmed];
  const sanitized = trimmed.replace(/\\.\\?\\*/g, '.*');
  if (sanitized !== trimmed) {
    attempts.push(sanitized);
  }
  for (const attempt of attempts) {
    try {
      return new RegExp(attempt, 'i');
    } catch (error) {
      // continue
    }
  }
  return null;
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function unique(values) {
  const set = new Set();
  values.forEach(value => {
    if (value) {
      set.add(value);
    }
  });
  return Array.from(set);
}

const schema = readJson(schemaPath);
const modules = readJson(modulesPath);

const errors = [];
const slotIds = new Set();

if (!schema || typeof schema !== 'object' || !Array.isArray(schema.slots)) {
  errors.push('Observation formula schema must include a top-level "slots" array.');
} else {
  schema.slots.forEach((slot, index) => {
    if (!hasText(slot?.id)) {
      errors.push(`Slot ${index + 1} is missing an id.`);
      return;
    }
    if (slotIds.has(slot.id)) {
      errors.push(`Slot id "${slot.id}" is duplicated.`);
    }
    slotIds.add(slot.id);

    if (!hasText(slot.prompt)) {
      errors.push(`Slot "${slot.id}" is missing a prompt.`);
    }
    if (!Array.isArray(slot.patterns) || !slot.patterns.length) {
      errors.push(`Slot "${slot.id}" must provide at least one pattern.`);
    } else {
      slot.patterns.forEach((pattern, patternIndex) => {
        if (!compilePattern(pattern)) {
          errors.push(`Slot "${slot.id}": pattern ${patternIndex + 1} is not a valid regular expression.`);
        }
      });
    }
    if (!Array.isArray(slot.traits?.tokens) || !slot.traits.tokens.length) {
      errors.push(`Slot "${slot.id}" must declare at least one token trait.`);
    }
  });
}

if (!modules || typeof modules !== 'object' || !Array.isArray(modules.motifs)) {
  errors.push('Observation cue modules must include a top-level "motifs" array.');
} else {
  modules.motifs.forEach((motif, motifIndex) => {
    if (!hasText(motif?.id)) {
      errors.push(`Motif at index ${motifIndex} is missing an id.`);
      return;
    }
    if (!Array.isArray(motif.entries) || !motif.entries.length) {
      errors.push(`Motif "${motif.id}" must include at least one entry.`);
    }

    const motifSlotIds = new Set(Array.isArray(motif.slots) ? motif.slots : []);
    motifSlotIds.forEach(slotId => {
      if (!slotIds.has(slotId)) {
        errors.push(`Motif "${motif.id}" references unknown slot "${slotId}".`);
      }
    });

    if (motif.slotPrompts && typeof motif.slotPrompts === 'object') {
      Object.keys(motif.slotPrompts).forEach(slotId => {
        if (!slotIds.has(slotId)) {
          errors.push(`Motif "${motif.id}" declares slot prompt for unknown slot "${slotId}".`);
        }
        const prompts = Array.isArray(motif.slotPrompts[slotId]) ? motif.slotPrompts[slotId] : [];
        prompts.forEach((prompt, promptIndex) => {
          if (!hasText(prompt)) {
            errors.push(`Motif "${motif.id}" slot prompt ${promptIndex + 1} for "${slotId}" is empty.`);
          }
        });
      });
    }

    const entryIds = new Set();
    (motif.entries || []).forEach((entry, entryIndex) => {
      if (!hasText(entry?.id)) {
        errors.push(`Motif "${motif.id}" entry ${entryIndex + 1} is missing an id.`);
        return;
      }
      if (entryIds.has(entry.id)) {
        errors.push(`Motif "${motif.id}" has duplicate entry id "${entry.id}".`);
      }
      entryIds.add(entry.id);

      const patterns = Array.isArray(entry.patterns) ? entry.patterns : [];
      if (!patterns.length) {
        errors.push(`Motif "${motif.id}" entry "${entry.id}" must include at least one pattern.`);
      } else {
        patterns.forEach((pattern, patternIndex) => {
          if (!compilePattern(pattern)) {
            errors.push(
              `Motif "${motif.id}" entry "${entry.id}": pattern ${patternIndex + 1} is not a valid regular expression.`,
            );
          }
        });
      }

      const slots = Array.isArray(entry.slots) ? unique(entry.slots) : [];
      if (!slots.length) {
        errors.push(`Motif "${motif.id}" entry "${entry.id}" does not declare any slot coverage.`);
      }
      slots.forEach(slotId => {
        if (!slotIds.has(slotId)) {
          errors.push(`Motif "${motif.id}" entry "${entry.id}" references unknown slot "${slotId}".`);
        }
      });

      if (entry.slotEvidence && typeof entry.slotEvidence === 'object') {
        Object.entries(entry.slotEvidence).forEach(([slotId, evidence]) => {
          if (!slotIds.has(slotId)) {
            errors.push(`Motif "${motif.id}" entry "${entry.id}" has evidence for unknown slot "${slotId}".`);
          }
          const evidencePatterns = Array.isArray(evidence?.patterns) ? evidence.patterns : [];
          evidencePatterns.forEach((pattern, idx) => {
            if (!compilePattern(pattern)) {
              errors.push(
                `Motif "${motif.id}" entry "${entry.id}" slot "${slotId}" evidence pattern ${idx + 1} is invalid.`,
              );
            }
          });
        });
      }

      const hasFeelings = Array.isArray(entry.feelings) && entry.feelings.length > 0;
      const hasNeeds = Array.isArray(entry.needs) && entry.needs.length > 0;
      if (!hasFeelings && !hasNeeds) {
        errors.push(`Motif "${motif.id}" entry "${entry.id}" must list at least one feeling or need.`);
      }
    });
  });
}

if (errors.length) {
  console.error('❌ Observation cue validation failed:');
  errors.forEach(error => {
    console.error(`   • ${error}`);
  });
  process.exit(1);
}

console.log('✅ Observation formula schema and cue modules look good.');
