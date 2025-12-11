# allneeds Cloudflare Worker backend

This folder stores the source code for the Cloudflare Worker that powers the backend
for **allneeds.app**.

The Worker is already deployed in the Cloudflare dashboard as:

- Worker name: `allneeds-backend`
- Public URL: `https://backend.allneeds.app`

The Worker has a D1 database binding configured in the Cloudflare UI:

- Binding name: `DB`
- Database name: `allneeds-db`

> **Important:** This repo does not deploy automatically.
> To update the live Worker right now, I will manually copy the contents of
> `cloudflare-backend/worker.js` into the Cloudflare Worker editor for
> `allneeds-backend` and click “Save and deploy”.

## Endpoints implemented in worker.js

Currently the Worker implements:

- `GET /api/health`
  - Runs `SELECT 1 AS ok` against the D1 database and returns JSON.
- `POST /auth/session` and `POST /auth/logout`
- `GET /api/strategies`, `POST /api/strategies`
- `GET /api/strategies/feed`
- `POST /api/strategies/:id/add-to-inventory`
- `GET/POST /api/user-settings`
- `GET/POST /api/journals`
- `GET /api/resolve-handle`

Stubs (placeholders) will exist for:

- `GET /api/me`

## Migration: strategies visibility + add_count

Before deploying the visibility and feed changes, add two columns to the
`strategies` table in D1 using the Cloudflare dashboard or the D1 console:

```sql
ALTER TABLE strategies
  ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';

ALTER TABLE strategies
  ADD COLUMN add_count INTEGER NOT NULL DEFAULT 0;
```

Run these statements prior to publishing the updated worker so existing
strategies include the new fields.
