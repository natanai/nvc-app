// Cloudflare Worker entrypoint for the allneeds backend.
// Assumes a D1 binding named `DB` is configured in the Cloudflare UI.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://allneeds.app',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true',
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

function parseCookies(request) {
  const header = request.headers.get('Cookie');
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((part) => {
      const [k, ...v] = part.trim().split('=');
      return [decodeURIComponent(k), decodeURIComponent(v.join('='))];
    }),
  );
}

async function getSession(env, request) {
  const cookies = parseCookies(request);
  const sid = cookies['allneeds_session'];
  if (!sid) return null;

  const row = await env.DB.prepare(
    'SELECT did, expires_at FROM sessions WHERE id = ?',
  )
    .bind(sid)
    .first();

  if (!row) return null;

  // If you later start using expires_at, you can enforce it here:
  // if (row.expires_at && new Date(row.expires_at) < new Date()) { ... }

  return { id: sid, did: row.did };
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
  const session = await getSession(env, request);
  if (!session) {
    return errorResponse('not signed in', 401);
  }

  let body;

  try {
    body = await request.json();
  } catch (err) {
    return errorResponse('Invalid JSON body');
  }

  const { title, body: strategyBody = null, needIds = null } = body || {};

  if (!title || String(title).trim() === '') {
    return errorResponse('title is required');
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
      .bind(session.did, title, strategyBody, needIdsSerialized)
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
  const session = await getSession(env, request);
  if (!session) {
    return errorResponse('not signed in', 401);
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
    ).bind(session.did);

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

    return jsonResponse({ status: 'ok', did: session.did, strategies });
  } catch (err) {
    return errorResponse(String(err), 500);
  }
}

async function handleGetStrategyFeed(request, env) {
  const session = await getSession(env, request);
  if (!session) {
    return errorResponse('not signed in', 401);
  }
  const viewerDid = session.did;

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
  const session = await getSession(env, request);
  if (!session) {
    return errorResponse('not signed in', 401);
  }

  try {
    const result = await env.DB.prepare(
      'SELECT key, value, updated_at FROM user_settings WHERE did = ? ORDER BY key;',
    )
      .bind(session.did)
      .all();

    return jsonResponse({
      status: 'ok',
      did: session.did,
      settings: result.results || [],
    });
  } catch (err) {
    return errorResponse(String(err), 500);
  }
}

async function handlePostUserSettings(request, env) {
  const session = await getSession(env, request);
  if (!session) {
    return errorResponse('not signed in', 401);
  }

  let body;

  try {
    body = await request.json();
  } catch (err) {
    return errorResponse('Invalid JSON body');
  }

  const { key, value } = body || {};

  if (!key || value === undefined) {
    return errorResponse('key and value are required');
  }

  try {
    await env.DB.prepare(
      'INSERT INTO user_settings (did, key, value, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(did, key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP;',
    )
      .bind(session.did, key, value)
      .run();

    return jsonResponse({
      status: 'ok',
      did: session.did,
      key,
      value,
    });
  } catch (err) {
    return errorResponse(String(err), 500);
  }
}

async function handleGetJournals(request, env) {
  const session = await getSession(env, request);
  if (!session) {
    return errorResponse('not signed in', 401);
  }

  try {
    const result = await env.DB.prepare(
      'SELECT id, did, created_at, updated_at, title, body FROM journals WHERE did = ? ORDER BY created_at DESC;',
    )
      .bind(session.did)
      .all();

    return jsonResponse({
      status: 'ok',
      did: session.did,
      journals: result.results || [],
    });
  } catch (err) {
    return errorResponse(String(err), 500);
  }
}

async function handlePostJournals(request, env) {
  const session = await getSession(env, request);
  if (!session) {
    return errorResponse('not signed in', 401);
  }

  let body;

  try {
    body = await request.json();
  } catch (err) {
    return errorResponse('Invalid JSON body');
  }

  const { title = null, body: journalBody = null } = body || {};

  try {
    await env.DB.prepare('INSERT INTO journals (did, title, body) VALUES (?, ?, ?);')
      .bind(session.did, title, journalBody)
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
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // Health check
    if (method === 'GET' && pathname === '/api/health') {
      return handleHealth(env);
    }

    // Future auth/user endpoint
    if (method === 'GET' && pathname === '/api/me') {
      return handleMe();
    }

    if (method === 'POST' && pathname === '/auth/session') {
      const body = await request.json().catch(() => null);
      if (!body || typeof body.did !== 'string') {
        return jsonResponse({ status: 'error', message: 'invalid body' }, 400);
      }

      const did = body.did.trim();
      if (!did || !did.startsWith('did:')) {
        return jsonResponse({ status: 'error', message: 'invalid did' }, 400);
      }

      await env.DB.prepare(
        'INSERT OR IGNORE INTO users (did, created_at) VALUES (?, CURRENT_TIMESTAMP)',
      )
        .bind(did)
        .run();

      const sid = crypto.randomUUID();

      await env.DB.prepare(
        'INSERT INTO sessions (id, did, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
      )
        .bind(sid, did)
        .run();

      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
          'Set-Cookie':
            `allneeds_session=${encodeURIComponent(sid)}; HttpOnly; Secure; SameSite=Lax; Path=/`,
        },
      });
    }

    if (method === 'POST' && pathname === '/auth/logout') {
      const session = await getSession(env, request);
      if (session) {
        await env.DB.prepare('DELETE FROM sessions WHERE id = ?')
          .bind(session.id)
          .run();
      }

      return new Response(null, {
        status: 204,
        headers: {
          ...CORS_HEADERS,
          'Set-Cookie':
            'allneeds_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
        },
      });
    }

    // Future feed endpoint (strategies from people the user follows)
    if (method === 'GET' && pathname === '/api/feed/strategies') {
      return handleGetStrategyFeed(request, env);
    }

    // Future endpoint to create a new strategy
    if (method === 'POST' && pathname === '/api/strategies') {
      return handlePostStrategy(request, env);
    }

    if (method === 'GET' && pathname === '/api/strategies') {
      return handleGetStrategies(request, env);
    }

    // Resolve a Bluesky handle to a DID and upsert into users.
    if (method === 'GET' && pathname === '/api/resolve-handle') {
      return handleResolveHandle(request, env);
    }

    if (method === 'GET' && pathname === '/api/user-settings') {
      return handleGetUserSettings(request, env);
    }

    if (method === 'POST' && pathname === '/api/user-settings') {
      return handlePostUserSettings(request, env);
    }

    if (method === 'GET' && pathname === '/api/journals') {
      return handleGetJournals(request, env);
    }

    if (method === 'POST' && pathname === '/api/journals') {
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
