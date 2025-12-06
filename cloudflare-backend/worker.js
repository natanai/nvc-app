// Cloudflare Worker entrypoint for the allneeds backend.
// Assumes a D1 binding named `DB` is configured in the Cloudflare UI.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://allneeds.app',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

function errorResponse(message, status = 400) {
  return jsonResponse({ status: 'error', message }, status);
}

async function handleHealth(env) {
  try {
    const row = await env.DB.prepare('SELECT 1 AS ok').first();

    return jsonResponse({
      status: 'ok',
      db: row, // expected to be { ok: 1 }
    });
  } catch (err) {
    return errorResponse(String(err), 500);
  }
}

async function handleMe() {
  // Placeholder: will later return the currently logged-in user.
  return jsonResponse(
    {
      status: 'not_implemented',
      endpoint: '/api/me',
    },
    501,
  );
}

async function handlePostStrategy(request, env) {
  let body;

  try {
    body = await request.json();
  } catch (err) {
    return errorResponse('Invalid JSON body');
  }

  const { did, title, body: strategyBody = null, needIds = null } = body || {};

  if (!did || !title || String(title).trim() === '') {
    return errorResponse('did and title are required');
  }

  let needIdsSerialized = null;
  if (Array.isArray(needIds)) {
    try {
      needIdsSerialized = JSON.stringify(needIds);
    } catch (err) {
      needIdsSerialized = null;
    }
  }

  try {
    await env.DB.prepare(
      'INSERT INTO strategies (author_did, title, body, need_ids) VALUES (?, ?, ?, ?);',
    )
      .bind(did, title, strategyBody, needIdsSerialized)
      .run();

    return jsonResponse({ status: 'ok' });
  } catch (err) {
    const message = String(err || '').toUpperCase();
    if (message.includes('FOREIGN KEY')) {
      return errorResponse('unknown author DID');
    }

    return errorResponse(String(err), 500);
  }
}

async function handleGetStrategies(request, env) {
  const url = new URL(request.url);
  const did = url.searchParams.get('did');

  if (!did) {
    return errorResponse('did is required');
  }

  try {
    const stmt = env.DB.prepare(
      `SELECT
        s.id,
        s.author_did,
        s.title,
        s.body,
        s.need_ids,
        s.created_at,
        u.handle,
        u.display_name,
        u.avatar_url
       FROM strategies s
       LEFT JOIN users u ON u.did = s.author_did
       WHERE s.author_did = ?
       ORDER BY s.created_at DESC
       LIMIT 100;`,
    ).bind(did);

    const { results } = await stmt.all();
    const strategies = (results || []).map((row) => ({
      id: row.id,
      authorDid: row.author_did,
      title: row.title,
      body: row.body ?? null,
      needIds: row.need_ids ? safeJsonParseArray(row.need_ids) : [],
      createdAt: row.created_at,
      author: {
        did: row.author_did,
        handle: row.handle || null,
        displayName: row.display_name || null,
        avatar: row.avatar_url || null,
      },
    }));

    return jsonResponse({ status: 'ok', did, strategies });
  } catch (err) {
    return errorResponse(String(err), 500);
  }
}

async function handleGetStrategyFeed(request, env) {
  const url = new URL(request.url);
  const viewerDid = url.searchParams.get('did');

  if (!viewerDid) {
    return errorResponse('did is required');
  }

  try {
    let viewerKnown = false;

    try {
      const userRow = await env.DB.prepare(
        'SELECT did, handle FROM users WHERE did = ?;',
      )
        .bind(viewerDid)
        .first();
      viewerKnown = !!userRow;
    } catch (err) {
      // Best-effort; ignore lookup errors.
      viewerKnown = false;
    }

    const apiUrl =
      'https://public.api.bsky.app/xrpc/app.bsky.graph.getFollows' +
      '?actor=' +
      encodeURIComponent(viewerDid) +
      '&limit=100';

    const res = await fetch(apiUrl);
    if (!res.ok) {
      return errorResponse(`Bluesky API returned ${res.status}`, 502);
    }

    const data = await res.json();
    const followProfiles = Array.isArray(data.follows) ? data.follows : [];
    const followDids = followProfiles
      .map((p) => p.did)
      .filter((d) => typeof d === 'string');

    const didSet = new Set(followDids);
    didSet.add(viewerDid);
    const didList = Array.from(didSet);

    if (didList.length === 0) {
      return jsonResponse({
        status: 'ok',
        viewerDid,
        strategies: [],
        authors: [],
        viewerKnown,
      });
    }

    const placeholders = didList.map(() => '?').join(', ');
    const sql = `
      SELECT
        s.id,
        s.author_did,
        s.title,
        s.body,
        s.need_ids,
        s.created_at,
        u.handle,
        u.display_name,
        u.avatar_url
      FROM strategies s
      LEFT JOIN users u ON u.did = s.author_did
      WHERE s.author_did IN (${placeholders})
      ORDER BY s.created_at DESC
      LIMIT 100;
    `;

    const stmt = env.DB.prepare(sql).bind(...didList);
    const { results } = await stmt.all();

    const strategies = (results || []).map((row) => ({
      id: row.id,
      authorDid: row.author_did,
      title: row.title,
      body: row.body ?? null,
      needIds: row.need_ids ? safeJsonParseArray(row.need_ids) : [],
      createdAt: row.created_at,
      author: {
        did: row.author_did,
        handle: row.handle || null,
        displayName: row.display_name || null,
        avatar: row.avatar_url || null,
      },
    }));

    const authorsMap = new Map();
    for (const s of strategies) {
      if (!authorsMap.has(s.authorDid)) {
        authorsMap.set(s.authorDid, s.author);
      }
    }

    const authors = Array.from(authorsMap.values());

    return jsonResponse({ status: 'ok', viewerDid, strategies, authors, viewerKnown });
  } catch (err) {
    return jsonResponse({ status: 'error', message: 'internal_error', detail: String(err) }, 500);
  }
}

async function handleResolveHandle(request, env) {
  const url = new URL(request.url);
  let handle = url.searchParams.get('handle');

  if (!handle) {
    return errorResponse('handle is required');
  }

  handle = handle.trim();
  if (handle.startsWith('@')) {
    handle = handle.slice(1);
  }
  handle = handle.toLowerCase();

  try {
    const apiUrl =
      'https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile' +
      '?actor=' +
      encodeURIComponent(handle);

    const res = await fetch(apiUrl);

    if (!res.ok) {
      return errorResponse(`Bluesky API returned ${res.status}`, 502);
    }

    const profile = await res.json();

    const did = profile.did;
    const resolvedHandle = profile.handle;
    const displayName = profile.displayName || null;
    const avatarUrl = profile.avatar || null;

    if (!did || !resolvedHandle) {
      return errorResponse('Profile response missing did or handle', 500);
    }

    await env.DB.prepare(
      `INSERT INTO users (did, handle, display_name, avatar_url, created_at, last_login_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT(did) DO UPDATE SET
           handle = excluded.handle,
           display_name = excluded.display_name,
           avatar_url = excluded.avatar_url,
           last_login_at = CURRENT_TIMESTAMP`,
    )
      .bind(did, resolvedHandle, displayName, avatarUrl)
      .run();

    return jsonResponse({
      status: 'ok',
      did,
      handle: resolvedHandle,
      displayName,
      avatar: avatarUrl,
      raw: profile,
    });
  } catch (err) {
    return errorResponse(String(err), 500);
  }
}

async function handleGetUserSettings(request, env) {
  const url = new URL(request.url);
  const did = url.searchParams.get('did');

  if (!did) {
    return errorResponse('did is required');
  }

  try {
    const result = await env.DB.prepare(
      'SELECT key, value, updated_at FROM user_settings WHERE did = ? ORDER BY key;',
    )
      .bind(did)
      .all();

    return jsonResponse({
      status: 'ok',
      did,
      settings: result.results || [],
    });
  } catch (err) {
    return errorResponse(String(err), 500);
  }
}

async function handlePostUserSettings(request, env) {
  let body;

  try {
    body = await request.json();
  } catch (err) {
    return errorResponse('Invalid JSON body');
  }

  const { did, key, value } = body || {};

  if (!did || !key || value === undefined) {
    return errorResponse('did, key, and value are required');
  }

  try {
    await env.DB.prepare(
      'INSERT INTO user_settings (did, key, value, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(did, key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP;',
    )
      .bind(did, key, value)
      .run();

    return jsonResponse({
      status: 'ok',
      did,
      key,
      value,
    });
  } catch (err) {
    return errorResponse(String(err), 500);
  }
}

async function handleGetJournals(request, env) {
  const url = new URL(request.url);
  const did = url.searchParams.get('did');

  if (!did) {
    return errorResponse('did is required');
  }

  try {
    const result = await env.DB.prepare(
      'SELECT id, did, created_at, updated_at, title, body FROM journals WHERE did = ? ORDER BY created_at DESC;',
    )
      .bind(did)
      .all();

    return jsonResponse({
      status: 'ok',
      did,
      journals: result.results || [],
    });
  } catch (err) {
    return errorResponse(String(err), 500);
  }
}

async function handlePostJournals(request, env) {
  let body;

  try {
    body = await request.json();
  } catch (err) {
    return errorResponse('Invalid JSON body');
  }

  const { did, title = null, body: journalBody = null } = body || {};

  if (!did) {
    return errorResponse('did is required');
  }

  try {
    await env.DB.prepare('INSERT INTO journals (did, title, body) VALUES (?, ?, ?);')
      .bind(did, title, journalBody)
      .run();

    return jsonResponse({ status: 'ok' });
  } catch (err) {
    return errorResponse(String(err), 500);
  }
}

function safeJsonParseArray(str) {
  try {
    const val = JSON.parse(str);
    return Array.isArray(val) ? val : [];
  } catch (err) {
    return [];
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // Health check
    if (request.method === 'GET' && pathname === '/api/health') {
      return handleHealth(env);
    }

    // Future auth/user endpoint
    if (request.method === 'GET' && pathname === '/api/me') {
      return handleMe();
    }

    // Future feed endpoint (strategies from people the user follows)
    if (request.method === 'GET' && pathname === '/api/feed/strategies') {
      return handleGetStrategyFeed(request, env);
    }

    // Future endpoint to create a new strategy
    if (request.method === 'POST' && pathname === '/api/strategies') {
      return handlePostStrategy(request, env);
    }

    if (request.method === 'GET' && pathname === '/api/strategies') {
      return handleGetStrategies(request, env);
    }

    // Resolve a Bluesky handle to a DID and upsert into users.
    if (request.method === 'GET' && pathname === '/api/resolve-handle') {
      return handleResolveHandle(request, env);
    }

    if (request.method === 'GET' && pathname === '/api/user-settings') {
      return handleGetUserSettings(request, env);
    }

    if (request.method === 'POST' && pathname === '/api/user-settings') {
      return handlePostUserSettings(request, env);
    }

    if (request.method === 'GET' && pathname === '/api/journals') {
      return handleGetJournals(request, env);
    }

    if (request.method === 'POST' && pathname === '/api/journals') {
      return handlePostJournals(request, env);
    }

    // Default fallback for any other route
    return jsonResponse({
      status: 'ok',
      message: 'allneeds-backend worker is running',
      note: 'No specific endpoint matched this path.',
      path: pathname,
    });
  },
};
