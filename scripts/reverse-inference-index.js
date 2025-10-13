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

export function intensityBandFromWeight(weight) {
  const numeric = Number(weight);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return [6, 10];
  }
  if (numeric >= 1.2) {
    return [3, 10];
  }
  if (numeric >= 1.0) {
    return [4, 10];
  }
  if (numeric >= 0.8) {
    return [5, 10];
  }
  return [6, 10];
}

function skillsForArousal(arousal) {
  return SKILLS_BY_AROUSAL[arousal] || SKILLS_BY_AROUSAL.medium;
}

function mapNeedToSdt(category) {
  if (!category) return null;
  const normalized = category.toLowerCase();
  return CATEGORY_TO_SDT.get(normalized) || null;
}

export function buildReverseInferenceIndex({ needs = [], feelings = [] } = {}) {
  const needsByTitle = new Map();
  needs.forEach((need) => {
    const titleKey = need?.title?.toLowerCase();
    if (titleKey) {
      needsByTitle.set(titleKey, need);
    }
  });

  const contributions = new Map();
  const totals = new Map();

  BODY_REGIONS.forEach((region) => {
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
    const anchor = EMOTION_CIRCUMPLEX[feelingKey];
    if (!anchor) {
      return;
    }
    const primaryZone = `${anchor.arousal}-${anchor.valence}`;
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
        intensityBand: intensityBandFromWeight(entry.weight),
        relativeWeight: clampRelativeWeight(entry.weight / total),
        evidenceKey: entry.optionId,
      }));

    if (!sortedBodyCues.length) {
      return;
    }

    const skills = skillsForArousal(anchor.arousal).slice(0, 2);
    const evidenceKeys = new Set();
    evidenceKeys.add(`zone-${anchor.valence}-${anchor.arousal}`);
    evidenceKeys.add(`emotion-${feelingKey}`);
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

  index._meta = {
    slugMap,
  };

  return index;
}
