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
