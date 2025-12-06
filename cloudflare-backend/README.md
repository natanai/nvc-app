# allneeds Cloudflare Worker backend

This folder stores the source code for the Cloudflare Worker that powers the backend
for **allneeds.app**.

The Worker is already deployed in the Cloudflare dashboard as:

- Worker name: `allneeds-backend`
- Public URL: `https://allneeds-backend.natanai.workers.dev`

The Worker has a D1 database binding configured in the Cloudflare UI:

- Binding name: `DB`
- Database name: `allneeds-db`

> **Important:** This repo does not deploy automatically.
> To update the live Worker right now, I will manually copy the contents of
> `cloudflare-backend/worker.js` into the Cloudflare Worker editor for
> `allneeds-backend` and click “Save and deploy”.

## Endpoints implemented in worker.js

Currently the Worker will implement:

- `GET /api/health`
  - Runs `SELECT 1 AS ok` against the D1 database and returns JSON.

Stubs (placeholders) will exist for:

- `GET /api/me`
- `GET /api/feed/strategies`
- `POST /api/strategies`

These stubs currently return `{"status": "not_implemented"}`.
