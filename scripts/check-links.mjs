#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DATA_PATH = join(ROOT, 'data', 'Needs.csv');
const SUPPRESSIONS_PATH = join(ROOT, 'scripts', 'link-suppressions.json');

const REQUEST_TIMEOUT_MS = 12000;
const USER_AGENT = 'nvc-app-link-checker/1.0 (+https://allneeds.app)';
const DEFAULT_CAPTCHA_HOSTS = new Set([
  'consent.youtube.com',
  'www.google.com',
]);

function parseCsv(text) {
  const sanitized = text.replace(/\ufeff/g, '');
  const rows = [];
  let current = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < sanitized.length; i += 1) {
    const char = sanitized[i];
    const next = sanitized[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      current.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      current.push(cell);
      rows.push(current);
      current = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || current.length > 0) {
    current.push(cell);
    rows.push(current);
  }

  const [header, ...data] = rows.filter((row) => row.length > 0);
  const trimmedHeader = header.map((h) => h.trim());

  return data
    .map((row) => {
      const obj = {};
      trimmedHeader.forEach((key, index) => {
        obj[key] = (row[index] ?? '').trim();
      });
      return obj;
    })
    .filter((row) => Object.values(row).some((value) => value !== ''));
}

function splitMultiline(value) {
  if (!value) return [];
  return value
    .split(/\r?\n+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseSupportingSources(value) {
  return splitMultiline(value)
    .map((entry) => entry.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^(https?:\/\/\S+)(?:\s+\((.+)\))?$/i);
      if (match) {
        return {
          url: match[1],
          description: (match[2] || '').trim(),
        };
      }
      return {
        url: entry,
        description: '',
      };
    });
}

async function loadSuppressedData() {
  try {
    const text = await readFile(SUPPRESSIONS_PATH, 'utf8');
    const data = JSON.parse(text);
    const urls = new Set((data.urls || []).map((entry) => entry.trim()).filter(Boolean));
    const captchaHosts = new Set(
      (data.captchaHosts || [])
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    );
    return {
      urls,
      captchaHosts,
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        urls: new Set(),
        captchaHosts: new Set(),
      };
    }
    throw error;
  }
}

async function request(url, method, signal) {
  const response = await fetch(url, {
    method,
    redirect: 'follow',
    signal,
    headers: {
      'user-agent': USER_AGENT,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  return response;
}

async function checkUrl(url, captchaHosts) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    let response;
    try {
      response = await request(url, 'HEAD', controller.signal);
      if (!response.ok || response.status === 405) {
        response = await request(url, 'GET', controller.signal);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        return { ok: false, reason: `Request timed out after ${REQUEST_TIMEOUT_MS}ms` };
      }
      const cause = error.cause || {};
      if (cause.code) {
        return { ok: false, reason: cause.code };
      }
      if (cause.errno) {
        return { ok: false, reason: cause.errno };
      }
      if (error.code) {
        return { ok: false, reason: error.code };
      }
      if (error.message) {
        return { ok: false, reason: error.message };
      }
      return { ok: false, reason: 'Unknown fetch error' };
    }

    const finalUrl = response.url;
    const status = response.status;
    const redirected = response.redirected;

    if (status !== 200) {
      return { ok: false, reason: `HTTP ${status}`, redirected, finalUrl };
    }

    if (redirected) {
      const hostname = new URL(finalUrl).hostname.toLowerCase();
      const path = new URL(finalUrl).pathname.toLowerCase();
      if (
        captchaHosts.has(hostname)
        || DEFAULT_CAPTCHA_HOSTS.has(hostname)
        || path.includes('captcha')
        || path.includes('verify')
        || path.includes('consent')
      ) {
        return {
          ok: false,
          reason: `Redirected to potential CAPTCHA host (${hostname})`,
          redirected,
          finalUrl,
        };
      }
    }

    return { ok: true, finalUrl, redirected };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const [csvText, suppression] = await Promise.all([
    readFile(DATA_PATH, 'utf8'),
    loadSuppressedData(),
  ]);

  const rows = parseCsv(csvText);
  const urls = new Map();

  for (const row of rows) {
    const sources = parseSupportingSources(row['Supporting Sources']);
    for (const source of sources) {
      const normalized = source.url.trim();
      if (!normalized) continue;
      if (!urls.has(normalized)) {
        urls.set(normalized, []);
      }
      urls.get(normalized).push(row.Title || row.Slug || '');
    }
  }

  const failures = [];
  const suppressedUrls = suppression.urls;
  const captchaHosts = suppression.captchaHosts;

  for (const [url, titles] of urls.entries()) {
    if (suppressedUrls.has(url)) {
      console.log(`⚪ Skipping suppressed URL: ${url}`);
      continue;
    }

    const result = await checkUrl(url, captchaHosts);
    if (result.ok) {
      const note = result.redirected && result.finalUrl !== url ? ` (resolved to ${result.finalUrl})` : '';
      console.log(`✅ ${url}${note}`);
    } else {
      const context = titles.filter(Boolean).join(', ');
      failures.push({
        url,
        reason: result.reason,
        context,
      });
      console.error(`❌ ${url} — ${result.reason}${context ? ` [${context}]` : ''}`);
    }
  }

  if (failures.length > 0) {
    console.error('\nLink check failed for the following sources:');
    for (const failure of failures) {
      console.error(`- ${failure.url}: ${failure.reason}${failure.context ? ` (used by: ${failure.context})` : ''}`);
    }
    console.error('\nAdd persistent issues to scripts/link-suppressions.json with a justification comment in version control.');
    process.exitCode = 1;
  }
}

await main().catch((error) => {
  console.error('Unexpected error while checking links:', error);
  process.exitCode = 1;
});
