export async function loadCueRows(csvUrl) {
  const text = await fetch(csvUrl).then(r => r.text());
  const rows = parseCSV(text);
  return rows.slice(1).filter(r => r.length >= 5).map(cols => {
    const [cue, patternsRaw, feelingsRaw, needsRaw, example] = cols;
    const patterns = (patternsRaw || '').split('|').filter(Boolean).map(p => new RegExp(p.trim(), 'i'));
    const feelings = (feelingsRaw || '').split('|').map(s => s.trim()).filter(Boolean);
    const needs = (needsRaw || '').split('|').map(s => s.trim()).filter(Boolean);
    return { cue: cue.trim(), patterns, feelings, needs, example: (example || '').trim() };
  });
}

export function suggestFromObservation(text, cues, maxEach = 6) {
  const lower = (text || '').toLowerCase();
  const hits = cues.filter(row => row.patterns.some(rx => rx.test(lower)));
  const feelings = [...new Set(hits.flatMap(h => h.feelings))].slice(0, maxEach);
  const needs = [...new Set(hits.flatMap(h => h.needs))].slice(0, maxEach);
  const why = hits.map(h => h.cue);
  return { feelings, needs, why, hits };
}

function parseCSV(str) {
  const out = [];
  let row = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '"') {
      if (inQ && str[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      row.push(cur);
      cur = '';
    } else if ((ch === '\n' || ch === '\r') && !inQ) {
      if (cur.length || row.length) {
        row.push(cur);
        out.push(row);
        row = [];
        cur = '';
      }
      if (ch === '\r' && str[i + 1] === '\n') i++;
    } else {
      cur += ch;
    }
  }
  if (cur.length || row.length) {
    row.push(cur);
    out.push(row);
  }
  return out;
}
