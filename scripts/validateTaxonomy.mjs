import fs from 'node:fs';
import path from 'node:path';

function slugify(label) {
  return (label || '')
    .toLowerCase()
    .replace(/[\/&+]/g, ' and ')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function parseCSV(str) {
  const out = [];
  let row = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '"') {
      if (inQuotes && str[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(cur);
      cur = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && str[i + 1] === '\n') {
        i++;
      }
      row.push(cur);
      out.push(row);
      row = [];
      cur = '';
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

function csvToObjects(text) {
  const rows = parseCSV(text.replace(/^\ufeff/, ''));
  if (!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(cols => {
    const obj = {};
    headers.forEach((key, idx) => {
      obj[key] = cols[idx] ?? '';
    });
    return obj;
  });
}

function loadCSVLabels(csvPath, { labelKey, filterRow } = {}) {
  const text = fs.readFileSync(csvPath, 'utf8');
  const rows = csvToObjects(text);
  const labels = new Set();
  rows.forEach(row => {
    if (filterRow && !filterRow(row)) return;
    const raw = row[labelKey];
    if (!raw) return;
    labels.add(slugify(String(raw).trim()));
  });
  return labels;
}

const root = process.cwd();
const taxonomyPath = path.join(root, 'data', 'observation_taxonomy.json');
const feelingsCsv = path.join(root, 'data', 'Feelings.csv');
const needsCsv = path.join(root, 'data', 'Needs.csv');

const taxonomy = JSON.parse(fs.readFileSync(taxonomyPath, 'utf8'));
const feelings = loadCSVLabels(feelingsCsv, {
  labelKey: 'Feeling Title',
  filterRow: row => String(row['Row Type'] || '').trim().toLowerCase() === 'feeling'
});
const needs = loadCSVLabels(needsCsv, { labelKey: 'Need Title' });

const familyIds = new Set();
let ok = true;

(taxonomy.families || []).forEach(family => {
  if (!family?.id) {
    console.error('Missing family id on entry:', family);
    ok = false;
    return;
  }
  if (familyIds.has(family.id)) {
    console.error('DUP family id:', family.id);
    ok = false;
  }
  familyIds.add(family.id);
  const patternIds = new Set();
  (family.patterns || []).forEach(pattern => {
    if (!pattern?.id) {
      console.error(`Missing pattern id in family ${family.id}:`, pattern);
      ok = false;
      return;
    }
    if (patternIds.has(pattern.id)) {
      console.error(`DUP pattern id in ${family.id}:`, pattern.id);
      ok = false;
    }
    patternIds.add(pattern.id);
    if (!pattern.example || !String(pattern.example).trim()) {
      console.error(`Empty example in ${family.id}/${pattern.id}`);
      ok = false;
    }
    const badFeel = (pattern.feelings || [])
      .map(label => slugify(String(label).trim()))
      .filter(slug => slug && !feelings.has(slug));
    const badNeed = (pattern.needs || [])
      .map(label => slugify(String(label).trim()))
      .filter(slug => slug && !needs.has(slug));
    if (badFeel.length) {
      console.error(`Unknown feelings in ${family.id}/${pattern.id}:`, badFeel);
      ok = false;
    }
    if (badNeed.length) {
      console.error(`Unknown needs in ${family.id}/${pattern.id}:`, badNeed);
      ok = false;
    }
  });
});

if (!ok) {
  process.exit(1);
}

console.log('✅ observation_taxonomy.json passes validation');
