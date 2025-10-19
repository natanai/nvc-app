export const EVAL_MARKERS = [
  'always','never','should','shouldn’t','right','wrong','good','bad',
  'respectful','disrespectful','toxic','rude','lazy','selfish','manipulative','gaslighting'
];

export const AGENTIVE_PATTERNS = [
  /you\s+made\s+me/i, /they\s+made\s+me/i, /because of you/i
];

export function lintObservation(text) {
  const lower = (text || '').toLowerCase();
  const hits = [
    ...EVAL_MARKERS.filter(w => lower.includes(w)),
    ...AGENTIVE_PATTERNS.filter(r => r.test(lower)).map(()=>'agentive')
  ];
  return { ok: hits.length === 0, hits };
}

export function scaffoldRewrite(input = {}) {
  const parts = [];
  if (input.when) parts.push(input.when.trim());
  if (input.what) parts.push(input.what.trim());
  const core = parts.filter(Boolean).join(', ');
  const gap = input.gap && input.gap.trim() ? ` I had hoped ${input.gap.trim()}.` : '';
  return core ? core + '.' + gap : '';
}
