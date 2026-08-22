import {
  BODY_REGIONS,
  QUADRANT_SUGGESTIONS,
  EMOTION_LIBRARY,
  FEELING_SLUG_ALIASES,
} from './alexithymia-support-data.js';
import { EMOTION_CIRCUMPLEX } from './alexithymia-support-logic.js';

const SKILLS_BY_AROUSAL = {
  high: ['labeling', 'physiological_sigh'],
  medium: ['labeling', 'slow_446'],
  low: ['labeling', 'resonance_6bpm'],
};

const CATEGORY_TO_SDT = new Map([
  ['love/caring', 'relatedness'],
  ['community/belonging', 'relatedness'],
  ['empathy/understanding', 'relatedness'],
  ['volunteering / acts of kindness', 'relatedness'],
  ['safety/security', 'autonomy'],
  ['autonomy/freedom', 'autonomy'],
  ['beauty/peace/play', 'autonomy'],
  ['sustenance/health', 'autonomy'],
  ['authenticity', 'autonomy'],
  ['meaning/contribution', 'competence'],
]);

const CIRCUMPLEX_KEY_ALIASES = new Map([
  ['contented', 'contentment'],
  ['excited', 'excitement'],
  ['hopeful', 'hope'],
  ['joyful', 'joy'],
]);

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function clampRelativeWeight(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0.1;
  }
  const clamped = Math.max(0.1, Math.min(1, value));
  return Math.round(clamped * 100) / 100;
}

export function intensityBandFromWeight(weight, arousal = 'medium') {
  const numeric = Number(weight);
  const baseBands = {
    low: { min: 1, max: 7 },
    medium: { min: 3, max: 9 },
    high: { min: 5, max: 10 },
  };
  const base = baseBands[arousal] || baseBands.medium;

  if (!Number.isFinite(numeric) || numeric <= 0) {
    const midpoint = Math.round((base.min + base.max) / 2);
    const fallbackMin = Math.max(1, midpoint - 1);
    return [fallbackMin, base.max];
  }

  const clamped = Math.min(Math.max(numeric, 0.6), 1.4);
  const ratio = (clamped - 0.6) / (1.4 - 0.6);
  const adjustable = Math.max(base.max - base.min - 2, 0);
  const min = Math.max(1, Math.floor(base.min + (1 - ratio) * adjustable));
  if (base.max - min < 2) {
    return [Math.max(1, base.max - 2), base.max];
  }
  return [min, base.max];
}

function skillsForArousal(arousal) {
  return SKILLS_BY_AROUSAL[arousal] || SKILLS_BY_AROUSAL.medium;
}

function mapNeedToSdt(category) {
  if (!category) return null;
  const normalized = category.toLowerCase();
  return CATEGORY_TO_SDT.get(normalized) || null;
}

export function buildReverseInferenceIndex({ needs = [], feelings = [], bodyRegions = BODY_REGIONS } = {}) {
  const needsByTitle = new Map();
  needs.forEach((need) => {
    const titleKey = need?.title?.toLowerCase();
    if (titleKey) {
      needsByTitle.set(titleKey, need);
    }
  });

  const contributions = new Map();
  const totals = new Map();

  const regions = Array.isArray(bodyRegions) && bodyRegions.length ? bodyRegions : BODY_REGIONS;

  regions.forEach((region) => {
    region.options.forEach((option) => {
      if (!option?.emotions) return;
      Object.entries(option.emotions).forEach(([feelingKey, rawWeight]) => {
        const weight = Number(rawWeight);
        if (!Number.isFinite(weight) || weight <= 0) {
          return;
        }
        if (!contributions.has(feelingKey)) {
          contributions.set(feelingKey, []);
        }
        contributions.get(feelingKey).push({
          regionId: region.id,
          regionLabel: region.label,
          optionId: option.id,
          title: option.title,
          note: option.note,
          weight,
        });
        totals.set(feelingKey, (totals.get(feelingKey) || 0) + weight);
      });
    });
  });

  const slugCandidates = new Map();
  Object.entries(EMOTION_LIBRARY).forEach(([feelingKey, entry]) => {
    const primarySlug = slugify(feelingKey);
    const nameSlug = slugify(entry?.name);
    if (primarySlug) {
      slugCandidates.set(primarySlug, feelingKey);
    }
    if (nameSlug) {
      slugCandidates.set(nameSlug, feelingKey);
    }
  });

  const slugMap = { ...FEELING_SLUG_ALIASES };
  feelings.forEach((item) => {
    if (!item?.slug) return;
    const slug = item.slug;
    if (slugMap[slug]) {
      return;
    }
    const direct = slugCandidates.get(slug);
    if (direct) {
      slugMap[slug] = direct;
      return;
    }
    const titleSlug = slugify(item.title);
    const alias = FEELING_SLUG_ALIASES[titleSlug];
    if (alias) {
      slugMap[slug] = alias;
      return;
    }
    const viaTitle = slugCandidates.get(titleSlug);
    if (viaTitle) {
      slugMap[slug] = viaTitle;
    }
  });

  const index = {};

  contributions.forEach((entries, feelingKey) => {
    const total = totals.get(feelingKey) || 0;
    if (total <= 0) {
      return;
    }
    const circumplexKey = CIRCUMPLEX_KEY_ALIASES.get(feelingKey) || feelingKey;
    const anchor = EMOTION_CIRCUMPLEX[circumplexKey];
    if (!anchor) {
      return;
    }
    const arousal = anchor.arousal || 'medium';
    const primaryZone = `${arousal}-${anchor.valence}`;
    const zoneSet = new Set([primaryZone]);
    Object.entries(QUADRANT_SUGGESTIONS).forEach(([zoneKey, info]) => {
      if (info?.emotions?.includes(feelingKey)) {
        zoneSet.add(zoneKey);
      }
    });
    const zones = Array.from(zoneSet);
    if (!zones.length) {
      return;
    }

    const libraryEntry = EMOTION_LIBRARY[feelingKey];
    const needsList = Array.isArray(libraryEntry?.needs) ? libraryEntry.needs : [];
    const sdtSet = new Set();
    const nvcList = [];
    needsList.forEach((title) => {
      const lookup = needsByTitle.get(String(title).toLowerCase());
      if (lookup) {
        const sdt = mapNeedToSdt(lookup.category);
        if (sdt) {
          sdtSet.add(sdt);
        }
        nvcList.push({ title: lookup.title, slug: lookup.slug });
      } else {
        nvcList.push({ title, slug: null });
      }
    });

    const sortedBodyCues = entries
      .slice()
      .sort((a, b) => b.weight - a.weight)
      .map((entry) => ({
        regionId: entry.regionId,
        regionLabel: entry.regionLabel,
        optionId: entry.optionId,
        title: entry.title,
        note: entry.note,
        intensityBand: intensityBandFromWeight(entry.weight, arousal),
        arousal,
        relativeWeight: clampRelativeWeight(entry.weight / total),
        evidenceKey: entry.optionId,
      }));

    if (!sortedBodyCues.length) {
      return;
    }

    const skills = skillsForArousal(arousal).slice(0, 2);
    const evidenceKeys = new Set();
    evidenceKeys.add(`zone-${anchor.valence}-${anchor.arousal}`);
    evidenceKeys.add(`emotion-${circumplexKey}`);
    skills.forEach((skill) => {
      evidenceKeys.add(`skill-${skill}`);
    });
    sortedBodyCues.forEach((cue) => evidenceKeys.add(cue.evidenceKey));

    index[feelingKey] = {
      zones,
      bodyCues: sortedBodyCues,
      needsHypotheses: {
        sdt: Array.from(sdtSet),
        nvc: nvcList,
      },
      skills,
      evidenceKeys: Array.from(evidenceKeys),
    };
  });

  const resolvableSlugMap = Object.fromEntries(
    Object.entries(slugMap).filter(([, feelingKey]) => Boolean(index[feelingKey])),
  );

  index._meta = {
    slugMap: resolvableSlugMap,
  };

  return index;
}
