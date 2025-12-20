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

function normalizeVisibility(input) {
  const value = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (value === 'public' || value === 'followers' || value === 'private') {
    return value;
  }
  return 'private';
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

  const {
    title,
    body: strategyBody = null,
    needIds = null,
    visibility: requestVisibility = 'private',
  } = body || {};

  if (!title || String(title).trim() === '') {
    return errorResponse('title is required');
  }

  const visibility = normalizeVisibility(requestVisibility);

  let needIdsSerialized = null;
  if (Array.isArray(needIds)) {
    try {
      needIdsSerialized = JSON.stringify(needIds);
    } catch (err) {
      needIdsSerialized = null;
    }
  }

  try {
    const result = await env.DB.prepare(
      'INSERT INTO strategies (author_did, title, body, need_ids, visibility) VALUES (?, ?, ?, ?, ?);',
    )
      .bind(session.did, title, strategyBody, needIdsSerialized, visibility)
      .run();

    const newId = result.meta?.last_row_id;
    if (newId) {
      const row = await env.DB.prepare(
        `SELECT
           s.id,
           s.author_did,
           s.title,
           s.body,
           s.need_ids,
           s.created_at,
           s.visibility,
           s.add_count,
           u.handle,
           u.display_name,
           u.avatar_url
         FROM strategies s
         LEFT JOIN users u ON u.did = s.author_did
         WHERE s.id = ?
         LIMIT 1;`,
      )
        .bind(newId)
        .first();

      if (row) {
        return jsonResponse({ status: 'ok', strategy: mapStrategyRow(row) });
      }
    }

    return jsonResponse({
      status: 'ok',
      strategy: {
        id: newId || null,
        authorDid: session.did,
        title,
        body: strategyBody,
        needIds: needIdsSerialized ? safeJsonParseArray(needIdsSerialized) : [],
        createdAt: new Date().toISOString(),
        visibility,
        addCount: 0,
        author: null,
      },
    });
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
        s.visibility,
        s.add_count,
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
    const strategies = (results || []).map((row) => mapStrategyRow(row));

    return jsonResponse({ status: 'ok', did: session.did, strategies });
  } catch (err) {
    return errorResponse(String(err), 500);
  }
}

async function fetchFollowDidList(env, did) {
  const apiUrl =
    'https://public.api.bsky.app/xrpc/app.bsky.graph.getFollows' +
    '?actor=' +
    encodeURIComponent(did) +
    '&limit=100';

  const res = await fetch(apiUrl);
  if (!res.ok) {
    throw new Error(`Bluesky API returned ${res.status}`);
  }

  const data = await res.json();
  const followProfiles = Array.isArray(data.follows) ? data.follows : [];
  return followProfiles.map((p) => p.did).filter((d) => typeof d === 'string');
}

function mapStrategyRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    authorDid: row.author_did,
    title: row.title,
    body: row.body ?? null,
    needIds: row.need_ids ? safeJsonParseArray(row.need_ids) : [],
    createdAt: row.created_at,
    visibility: normalizeVisibility(row.visibility),
    addCount: typeof row.add_count === 'number' ? row.add_count : Number(row.add_count) || 0,
    author: row.author_did
      ? {
          did: row.author_did,
          handle: row.handle || null,
          displayName: row.display_name || null,
          avatarUrl: row.avatar_url || null,
          avatar: row.avatar_url || null,
        }
      : null,
  };
}

async function handleGetStrategyFeed(request, env) {
  const session = await getSession(env, request);
  const viewerDid = session?.did || null;

  const url = new URL(request.url);
  const scopeParam = (url.searchParams.get('scope') || '').toLowerCase();
  const sortParam = (url.searchParams.get('sort') || '').toLowerCase();
  const limitParam = parseInt(url.searchParams.get('limit') || '50', 10);

  const scope = scopeParam === 'follows' ? 'follows' : 'public';
  const sort = sortParam === 'popular' ? 'popular' : 'recent';
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 50;

  try {
    let followDids = [];
    if (scope === 'follows' && viewerDid) {
      try {
        followDids = await fetchFollowDidList(env, viewerDid);
      } catch (err) {
        return errorResponse(String(err), 502);
      }
    }

    const whereClauses = [];
    const params = [];

    if (!viewerDid || scope === 'public') {
      whereClauses.push("s.visibility = 'public'");
    } else {
      const includeClauses = [];
      const validFollows = Array.isArray(followDids)
        ? followDids.filter((did) => typeof did === 'string' && did.startsWith('did:'))
        : [];
      if (validFollows.length) {
        const placeholders = validFollows.map(() => '?').join(', ');
        includeClauses.push(`(s.author_did IN (${placeholders}) AND s.visibility IN ('followers', 'public'))`);
        params.push(...validFollows);
      }
      includeClauses.push('s.author_did = ?');
      params.push(viewerDid);
      includeClauses.push("s.visibility = 'public'");
      whereClauses.push(`(${includeClauses.join(' OR ')})`);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const orderSql =
      sort === 'popular'
        ? 'ORDER BY s.add_count DESC, s.created_at DESC'
        : 'ORDER BY s.created_at DESC';

    const sql = `
      SELECT
        s.id,
        s.author_did,
        s.title,
        s.body,
        s.need_ids,
        s.created_at,
        s.visibility,
        s.add_count,
        u.handle,
        u.display_name,
        u.avatar_url
      FROM strategies s
      JOIN users u ON u.did = s.author_did
      ${whereSql}
      ${orderSql}
      LIMIT ?;
    `;

    const stmt = env.DB.prepare(sql).bind(...params, limit);
    const { results } = await stmt.all();
    const strategies = (results || []).map((row) => mapStrategyRow(row)).filter(Boolean);

    return jsonResponse({ status: 'ok', scope, sort, viewerDid: viewerDid || null, strategies });
  } catch (err) {
    return jsonResponse({ status: 'error', message: 'internal_error', detail: String(err) }, 500);
  }
}

async function handleIncrementAddCount(request, env, id) {
  const session = await getSession(env, request);
  if (!session) {
    return errorResponse('not signed in', 401);
  }

  const strategyId = parseInt(id, 10);
  if (!Number.isFinite(strategyId)) {
    return errorResponse('invalid strategy id', 400);
  }

  try {
    const updateResult = await env.DB.prepare(
      'UPDATE strategies SET add_count = add_count + 1 WHERE id = ?;',
    )
      .bind(strategyId)
      .run();

    if (!updateResult || updateResult.meta.changes === 0) {
      return errorResponse('strategy not found', 404);
    }

    const row = await env.DB.prepare(
      `SELECT
         s.id,
         s.author_did,
         s.title,
         s.body,
         s.need_ids,
         s.created_at,
         s.visibility,
         s.add_count,
         u.handle,
         u.display_name,
         u.avatar_url
       FROM strategies s
       JOIN users u ON u.did = s.author_did
       WHERE s.id = ?
       LIMIT 1;`,
    )
      .bind(strategyId)
      .first();

    if (!row) {
      return errorResponse('strategy not found', 404);
    }

    return jsonResponse({ status: 'ok', strategy: mapStrategyRow(row) });
  } catch (err) {
    return errorResponse(String(err), 500);
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

function normalizeNeedIds(needIds) {
  if (!Array.isArray(needIds)) {
    return [];
  }
  return needIds
    .map((id) => (id == null ? '' : String(id).trim()))
    .filter(Boolean)
    .sort();
}

function buildStrategySignature({ title, body, needIds, visibility }) {
  const normalizedTitle = typeof title === 'string' ? title.trim() : '';
  const normalizedBody = body == null ? '' : String(body);
  const normalizedVisibility = normalizeVisibility(visibility);
  const normalizedNeedIds = normalizeNeedIds(needIds);
  return JSON.stringify([normalizedTitle, normalizedBody, normalizedNeedIds, normalizedVisibility]);
}

async function handleSyncStrategies(request, env) {
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

  const incoming = Array.isArray(body?.strategies) ? body.strategies : null;
  if (!incoming) {
    return errorResponse('strategies array is required');
  }

  const desiredMap = new Map();
  incoming.forEach((entry) => {
    const visibility = normalizeVisibility(entry?.visibility);
    if (visibility !== 'public' && visibility !== 'followers') {
      return;
    }
    const title = entry?.title ? String(entry.title).trim() : '';
    if (!title) {
      return;
    }
    const payload = {
      title,
      body: entry?.body ? String(entry.body) : '',
      needIds: normalizeNeedIds(entry?.needIds),
      visibility,
    };
    const signature = buildStrategySignature(payload);
    if (!desiredMap.has(signature)) {
      desiredMap.set(signature, []);
    }
    desiredMap.get(signature).push(payload);
  });

  const existingResults = await env.DB.prepare(
    `SELECT id, title, body, need_ids, visibility, created_at
       FROM strategies
      WHERE author_did = ?
        AND visibility IN ('public', 'followers')
      ORDER BY created_at DESC, id DESC;`,
  )
    .bind(session.did)
    .all();

  const existingMap = new Map();
  (existingResults.results || []).forEach((row) => {
    const signature = buildStrategySignature({
      title: row.title,
      body: row.body ?? '',
      needIds: safeJsonParseArray(row.need_ids),
      visibility: row.visibility,
    });
    if (!existingMap.has(signature)) {
      existingMap.set(signature, []);
    }
    existingMap.get(signature).push(row.id);
  });

  const idsToDelete = [];
  existingMap.forEach((ids, signature) => {
    const desiredCount = desiredMap.has(signature) ? desiredMap.get(signature).length : 0;
    if (ids.length > desiredCount) {
      idsToDelete.push(...ids.slice(desiredCount));
    }
  });

  if (idsToDelete.length) {
    const placeholders = idsToDelete.map(() => '?').join(', ');
    await env.DB.prepare(`DELETE FROM strategies WHERE id IN (${placeholders});`)
      .bind(...idsToDelete)
      .run();
  }

  let insertedCount = 0;
  for (const [signature, payloads] of desiredMap.entries()) {
    const existingCount = existingMap.has(signature) ? existingMap.get(signature).length : 0;
    const missingCount = payloads.length - existingCount;
    if (missingCount <= 0) {
      continue;
    }
    for (let i = 0; i < missingCount; i += 1) {
      const payload = payloads[i];
      const needIdsSerialized =
        payload.needIds && payload.needIds.length ? JSON.stringify(payload.needIds) : null;
      await env.DB.prepare(
        'INSERT INTO strategies (author_did, title, body, need_ids, visibility) VALUES (?, ?, ?, ?, ?);',
      )
        .bind(
          session.did,
          payload.title,
          payload.body || null,
          needIdsSerialized,
          payload.visibility,
        )
        .run();
      insertedCount += 1;
    }
  }

  return jsonResponse({
    status: 'ok',
    did: session.did,
    deleted: idsToDelete.length,
    inserted: insertedCount,
  });
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

    // Strategy feed
    if (
      method === 'GET' &&
      (pathname === '/api/strategies/feed' || pathname === '/api/feed/strategies')
    ) {
      return handleGetStrategyFeed(request, env);
    }

    // Endpoint to create a new strategy
    if (method === 'POST' && pathname === '/api/strategies') {
      return handlePostStrategy(request, env);
    }

    if (method === 'GET' && pathname === '/api/strategies') {
      return handleGetStrategies(request, env);
    }

    if (method === 'POST' && pathname === '/api/strategies/sync') {
      return handleSyncStrategies(request, env);
    }

    const addToInventoryMatch = pathname.match(/^\/api\/strategies\/(\d+)\/add-to-inventory$/);
    if (method === 'POST' && addToInventoryMatch) {
      return handleIncrementAddCount(request, env, addToInventoryMatch[1]);
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
