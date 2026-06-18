---
name: Supabase setup constraints
description: How Supabase is integrated in this project and the key constraint about TCP blocking
---

## TCP blocking
Replit sandbox blocks direct TCP connections to external PostgreSQL (port 5432). Drizzle/pg will fail at connection time. Must use Supabase JS client (`@supabase/supabase-js`) which communicates over HTTP/REST.

## Table creation
The Supabase Management API (`/v1/projects/{ref}/database/query`) requires a **personal access token** in the Authorization header — the service_role JWT is rejected with 401. Therefore automated `setupTables()` at server startup fails silently.

**Solution:** Tables must be created manually by the user via Supabase Dashboard → SQL Editor. The full schema is in `supabase-setup.sql` at the project root.

## Realtime
- Tables must be added to `supabase_realtime` publication: `ALTER PUBLICATION supabase_realtime ADD TABLE trades;`
- This is included in supabase-setup.sql
- Frontend uses `@supabase/supabase-js` with `supabase.channel().on('postgres_changes', ...)` pattern

## Frontend env vars
- Vite can't read secrets directly. Use `define` in vite.config.ts to inject at build time:
  ```ts
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(process.env.SUPABASE_URL ?? ""),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(process.env.SUPABASE_ANON_KEY ?? ""),
  }
  ```

**Why:** This was discovered after attempting Drizzle/pg (fails at TCP) and Management API approach (fails auth). HTTP-only via JS client is the only viable path from Replit sandbox.
