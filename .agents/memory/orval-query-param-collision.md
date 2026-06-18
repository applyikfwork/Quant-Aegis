---
name: Orval query-param collision
description: Endpoints with query parameters generate conflicting TypeScript type names in the api-zod barrel export, causing TS2308 build failures after codegen.
---

When an endpoint has query parameters, Orval generates:
1. A Zod schema `<OperationIdPascal>QueryParams` in `lib/api-zod/src/generated/api.ts`
2. A TypeScript type `<OperationIdPascal>QueryParams` in `lib/api-zod/src/generated/types/<operationId>QueryParams.ts`

Both are re-exported via `export *` from `lib/api-zod/src/index.ts`, causing TS2308:
```
Module "./generated/api" has already exported a member named 'GetCandlesParams'
```

**Why:** The openapi.md guidance covers request body naming collisions but not query parameter collisions. The pattern is identical: Orval auto-derives a name from the operationId for both the Zod schema and the TS type.

**How to apply:**
- For endpoints that MUST have query params: leave them inline (Orval handles `ListXxxQueryParams` and similar names correctly when the operation ID starts with `list`/`create`/etc., not `get`). The collision only happens on certain patterns — test with codegen.
- Safest fix: move path-variable-like filters to path params (e.g., `/candles/{symbol}/{timeframe}` instead of `/candles/{symbol}?timeframe=1h`).
- Alternative: define the query params as a named schema in `components/schemas` and reference it — this changes Orval's naming strategy.
- Endpoints with `list` prefix and query params (`listTrades`, `listSignals`) do NOT collide — only `get*` with query params seems to trigger it in practice.
