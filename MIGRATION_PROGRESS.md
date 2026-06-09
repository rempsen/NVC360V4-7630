# Multi-tenancy route migration — COMPLETE

All route files audited. Every tenant-owned table access goes through `tx(c)`/`tdb`
(auto-scoped + auto-stamped companyId). Global tables (user/session/account/
verification/role_permissions/idempotency_keys) stay raw `db` and are explicitly
filtered/guarded by companyId where tenant isolation matters. Public/no-ctx routes
(oauth callback, invite accept, webhooks) resolve tenant from token/parent row and
stamp companyId explicitly.

## Verified safe (raw db remaining = legit)
- team.ts: user/rolePerms global; patch/delete guard `target.companyId === tenantId(c)`. riders via tx.
- admin.ts: same guards on user patch/delete.
- integrations.ts: oauth callback updates own resolved integration row.
- export.ts: user lookups from already-scoped rows; customer list filtered by cid.
- job-search.ts: buildWhere pushes companyId; all writes scoped+stamped; enrich reads scoped rows.
- reports.ts: user listings filtered by t.companyId.
- calendar.ts: user lookups by id (global profile read).
- mcp.ts: DONE this session — ApiKeyContext now carries companyId; every handler
  takes a `tdb(key.companyId)` TenantDb. user/rider joins use `t.scope()`; client
  ops filter/stamp companyId; audit() now accepts companyId.

## tsc --noEmit: CLEAN (web package)

## NEXT
- tenant isolation test (company A cannot read company B)
- Blocker #2: payments-webhook prod-reject
- Blocker #3: Sentry lazy init hardening
- Blocker #4: env-gated Redis
- Blocker #5: drizzle migrations baseline + CI
- build + restart + smoke test
