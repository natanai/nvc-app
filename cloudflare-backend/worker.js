// Cloudflare Worker entrypoint for the allneeds backend.
// Assumes a D1 binding named `DB` is configured in the Cloudflare UI.

async function handleHealth(env) {
  try {
    const row = await env.DB.prepare('SELECT 1 AS ok').first();

    return new Response(
      JSON.stringify({
        status: 'ok',
        db: row, // expected to be { ok: 1 }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        status: 'error',
        message: String(err),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

async function handleMe() {
  // Placeholder: will later return the currently logged-in user.
  return new Response(
    JSON.stringify({
      status: 'not_implemented',
      endpoint: '/api/me',
    }),
    {
      status: 501,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

async function handleFeedStrategies() {
  // Placeholder: will later return strategies from people the user follows.
  return new Response(
    JSON.stringify({
      status: 'not_implemented',
      endpoint: '/api/feed/strategies',
    }),
    {
      status: 501,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

async function handleCreateStrategy() {
  // Placeholder: will later create a strategy for the logged-in user.
  return new Response(
    JSON.stringify({
      status: 'not_implemented',
      endpoint: '/api/strategies',
    }),
    {
      status: 501,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

async function handleGetUserSettings(request, env) {
  const url = new URL(request.url);
  const did = url.searchParams.get('did');

  if (!did) {
    return new Response(
      JSON.stringify({ status: 'error', message: 'did is required' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  try {
    const result = await env.DB.prepare(
      'SELECT key, value, updated_at FROM user_settings WHERE did = ? ORDER BY key;',
    )
      .bind(did)
      .all();

    return new Response(
      JSON.stringify({
        status: 'ok',
        did,
        settings: result.results || [],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ status: 'error', message: String(err) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

async function handlePostUserSettings(request, env) {
  let body;

  try {
    body = await request.json();
  } catch (err) {
    return new Response(
      JSON.stringify({ status: 'error', message: 'Invalid JSON body' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  const { did, key, value } = body || {};

  if (!did || !key || value === undefined) {
    return new Response(
      JSON.stringify({ status: 'error', message: 'did, key, and value are required' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  try {
    await env.DB.prepare(
      'INSERT INTO user_settings (did, key, value, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(did, key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP;',
    )
      .bind(did, key, value)
      .run();

    return new Response(
      JSON.stringify({
        status: 'ok',
        did,
        key,
        value,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ status: 'error', message: String(err) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

async function handleGetJournals(request, env) {
  const url = new URL(request.url);
  const did = url.searchParams.get('did');

  if (!did) {
    return new Response(
      JSON.stringify({ status: 'error', message: 'did is required' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  try {
    const result = await env.DB.prepare(
      'SELECT id, did, created_at, updated_at, title, body FROM journals WHERE did = ? ORDER BY created_at DESC;',
    )
      .bind(did)
      .all();

    return new Response(
      JSON.stringify({
        status: 'ok',
        did,
        journals: result.results || [],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ status: 'error', message: String(err) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

async function handlePostJournals(request, env) {
  let body;

  try {
    body = await request.json();
  } catch (err) {
    return new Response(
      JSON.stringify({ status: 'error', message: 'Invalid JSON body' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  const { did, title = null, body: journalBody = null } = body || {};

  if (!did) {
    return new Response(
      JSON.stringify({ status: 'error', message: 'did is required' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  try {
    await env.DB.prepare('INSERT INTO journals (did, title, body) VALUES (?, ?, ?);')
      .bind(did, title, journalBody)
      .run();

    return new Response(
      JSON.stringify({ status: 'ok' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ status: 'error', message: String(err) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

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
      return handleFeedStrategies();
    }

    // Future endpoint to create a new strategy
    if (request.method === 'POST' && pathname === '/api/strategies') {
      return handleCreateStrategy();
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
    return new Response(
      JSON.stringify({
        status: 'ok',
        message: 'allneeds-backend worker is running',
        note: 'No specific endpoint matched this path.',
        path: pathname,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  },
};
