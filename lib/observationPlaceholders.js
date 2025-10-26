const PLACEHOLDER_MAP = new Map([
  ['time anchor', 'time anchor'],
  ['duration', 'duration'],
  ['count', 'count'],
  ['time range', 'time range'],
  ['time span', 'time span'],
  ['start time', 'time detail'],
  ['measure count', 'measurement count'],
  ['measurement', 'measurement detail'],
  ['comparison measurement', 'comparison detail'],
  ['personal record detail', 'record detail'],
  ['identifier', 'identifier detail'],
  ['identifier detail', 'identifier detail'],
  ['number', 'number detail'],
  ['event', 'event detail'],
  ['client', 'other person'],
  ['colleague', 'other person'],
  ['friend', 'other person'],
  ['named colleague', 'other person'],
  ['named coworker', 'other person'],
  ['named performer', 'other person'],
  ['named person', 'other person'],
  ['partner', 'other person'],
  ['relative', 'other person'],
  ['scheduler', 'other person'],
  ['staffer', 'other person'],
  ['team member', 'other person'],
  ['teen', 'other person'],
  ['kids', 'group'],
  ['closing crew', 'group'],
  ['ensemble', 'group'],
  ['intake team', 'group'],
  ['participants', 'group'],
  ['team', 'group'],
  ['apartment mail area', 'context detail'],
  ['back office', 'context detail'],
  ['bedtime space', 'context detail'],
  ['cafe lobby', 'context detail'],
  ['city office', 'context detail'],
  ['classroom setting', 'context detail'],
  ['concert setting', 'context detail'],
  ['courtroom setting', 'context detail'],
  ['crosswalk location', 'context detail'],
  ['dental visit', 'context detail'],
  ['dining setting', 'context detail'],
  ['exam room', 'context detail'],
  ['family table', 'context detail'],
  ['field location', 'context detail'],
  ['finance channel', 'context detail'],
  ['game setting', 'context detail'],
  ['home setting', 'context detail'],
  ['intake area', 'context detail'],
  ['kitchen', 'context detail'],
  ['lab setting', 'context detail'],
  ['lunch meeting', 'context detail'],
  ['market or venue', 'context detail'],
  ['mediation room', 'context detail'],
  ['meeting room', 'context detail'],
  ['meeting space', 'context detail'],
  ['neighborhood setting', 'context detail'],
  ['neighboring yard', 'context detail'],
  ['nursery', 'context detail'],
  ['observatory workspace', 'context detail'],
  ['overnight shift', 'context detail'],
  ['pitch meeting', 'context detail'],
  ['planning stand-up', 'context detail'],
  ['porch or entry', 'context detail'],
  ['project call', 'context detail'],
  ['project space', 'context detail'],
  ['rehearsal space', 'context detail'],
  ['restaurant setting', 'context detail'],
  ['retrospective', 'context detail'],
  ['review meeting', 'context detail'],
  ['review session', 'context detail'],
  ['rideshare', 'context detail'],
  ['security office', 'context detail'],
  ['security operations center', 'context detail'],
  ['service line', 'context detail'],
  ['shared kitchen', 'context detail'],
  ['shared meal', 'context detail'],
  ['shared setting', 'context detail'],
  ['shared space', 'context detail'],
  ['shelter space', 'context detail'],
  ['support session', 'context detail'],
  ['tower workspace', 'context detail'],
  ['training session', 'context detail'],
  ['transit stop', 'context detail'],
  ['workstation', 'context detail'],
  ['shared board', 'object detail'],
  ['personal record detail', 'record detail'],
  ['teammate initials', 'identifier detail'],
  ['market detail', 'context detail'],
]);

function normalizeObservationPlaceholder(placeholder) {
  if (typeof placeholder !== 'string') {
    return '';
  }
  const trimmed = placeholder.trim();
  if (!trimmed) {
    return '';
  }
  const direct = PLACEHOLDER_MAP.get(trimmed);
  if (direct) {
    return direct;
  }
  const lower = trimmed.toLowerCase();
  const mapped = PLACEHOLDER_MAP.get(lower);
  if (mapped) {
    return mapped;
  }
  if (/time/.test(lower)) {
    return 'time detail';
  }
  if (/count|number|\d/.test(lower)) {
    return 'count detail';
  }
  if (/measure/.test(lower)) {
    return 'measurement detail';
  }
  if (/record/.test(lower)) {
    return 'record detail';
  }
  if (/id|initial/.test(lower)) {
    return 'identifier detail';
  }
  if (/team|group|crew|participants|people|kids/.test(lower)) {
    return 'group';
  }
  if (/person|client|colleague|partner|friend|relative|staffer|member/.test(lower)) {
    return 'other person';
  }
  if (/room|space|office|meeting|setting|table|yard|porch|entry|shift|venue|call|session|mail|lobby|channel|area|kitchen|line|stop/.test(lower)) {
    return 'context detail';
  }
  if (/board|object|item|device/.test(lower)) {
    return 'object detail';
  }
  return 'context detail';
}

export function normalizeObservationPlaceholders(text) {
  if (typeof text !== 'string' || !text.includes('(')) {
    return typeof text === 'string' ? text : '';
  }
  return text.replace(/\(([^()]+)\)/g, (_, raw) => {
    const normalized = normalizeObservationPlaceholder(raw);
    return `(${normalized || 'context detail'})`;
  });
}

export function getObservationPlaceholderMap() {
  return new Map(PLACEHOLDER_MAP);
}

