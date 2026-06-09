# NVC360 — Quality Audit (re-run)

_Audited against the live codebase after Batches 1–5. Grades are evidence-based, not aspirational._

## Scorecard

| Category | Before | Now | Δ |
| --- | --- | --- | --- |
| Architecture & scalability | D | C− | ↑ |
| Data layer & persistence | D+ | C | ↑ |
| Realtime / live tracking | C− | C+ | ↑ |
| Payments & billing | D | C+ | ↑↑ |
| Security & auth | C | C+ | ↑ |
| Multi-tenancy isolation | F* | B+ | ↑↑↑ (route+service enforced via `tdb`) |
| Reliability & error handling | C− | C+ | ↑ |
| Observability & ops | D | C | ↑ |
| Testing & CI/CD | F | B− | ↑↑↑ |
| File storage | D | B− | ↑↑ |
| Mobile driver app | C | C | — |
| Dispatch console | B+ | B+ | — |
| Code quality | B | B | — |
| Compliance / privacy | D | C− | ↑ |

## What moved, and why

### Testing & CI/CD — F → B−  (biggest jump)
- 61 unit tests passing across pricing, tax, Stripe money math, permissions resolution, geofence/haversine/path-distance, on-site clock.
- `.github/workflows/ci.yml`: web `tsc` (gating) + lint (non-blocking backlog) + `bun test` + drizzle `generate` migration dry-run.
- Pure logic extracted into `shared/` (`clock.ts`, `geo-distance.ts`, `pricing.ts`, `tax.ts`) so it's testable without the DB import chain.
- Not yet A: no integration/e2e tests against routes, no coverage gate, mobile/desktop tsc still a non-blocking backlog (~61 errors).

### Payments & billing — D → C+
- Stripe PaymentIntents, idempotency keys, refunds, immutable `payment_ledger`, signed-webhook handler implemented.
- **Blocker holding it below B:** `STRIPE_WEBHOOK_SECRET` is NOT set in env — the webhook handler logs a warning and processes events *unverified*. Currently leaning on the `/payments/sync` polling fallback. Set the secret and this is a solid B.
- LIVE keys (`pk_live`/`sk_live`) in use; no live charge has completed end-to-end yet.

### File storage — D → B−
- `lib/storage.ts` uses real S3 (creds present in env), signed-URL proxy route, disk only as a dev fallback.
- Not A: no lifecycle/retention policy on the bucket, no AV scan on uploads, no per-tenant prefix isolation.

### Multi-tenancy isolation — now B+  (superseded — see `quality-audit-rerun.report/content.md`)
- A `tdb(companyId)` enforcement helper now auto-applies the `companyId` predicate to every tenant-owned table (reads/writes), stamps `companyId` on inserts, and **fails closed** on a missing tenant. Global tables (role catalog, idempotency keys, auth-owned `user`/`session`/etc.) are explicitly allow-listed.
- Both the **route layer** (`tx(c)`) and the **service layer** (`billing`, `presence`, `booking-status`, `notify`) now go through `tdb`. The earlier service-layer gap and the `companySettings` `id="default"` singleton bug have been fixed.
- Enforced by tests: route-layer 8-pass isolation test (`api/database/__tests__/tenant.test.ts`) + service-layer fail-closed test (`services/__tests__/billing-tenant.test.ts`).
- See the post-hardening re-run report for the full evidence and remaining (non-blocking) items.

### Observability & ops — D → C
- Structured JSON logging (`lib/logger.ts`), request IDs, `/ready` deep probe, retention sweeps.
- Sentry wiring is present but **lazy/optional and `SENTRY_DSN` is unset** → no error aggregation in prod. No metrics/tracing (no prom-client/OTel). Single-node, no dashboards/alerts.

### Realtime — C− → C+
- SSE live tracking replaced polling; clean publish/subscribe abstraction.
- In-memory bus only (Redis-ready interface, not wired) → does not fan out across nodes. Fine for single instance, breaks on horizontal scale.

### Architecture / Data / Reliability — incremental ↑
- Rate limiting (in-memory, Redis-ready), CORS allowlist, public-track token TTL + purge, tracking_pings index + retention, global `onError`/`notFound` + `AppError` envelope.
- Ceiling held by single-node in-memory state (rate-limit, realtime), schema deployed via `db:push` (no committed migration history), and the tenancy gap above.

## Top blockers to the next grade tier

1. **Set `STRIPE_WEBHOOK_SECRET`** — unverified webhooks are a payment-integrity hole. (Payments D-tier risk.)
2. **Finish or remove multi-tenancy** — scope the remaining 30 tables behind an enforced query helper, or commit to single-tenant and strip the partial work.
3. **Wire `SENTRY_DSN`** in prod — you have the code, just no signal.
4. **Move rate-limit + realtime to Redis** before running more than one node.
5. **Commit migration history** instead of `db:push` for auditable, reversible schema changes.

\* "F*" previously meant "multi-tenancy claimed but not enforced." It is no longer F, but D− reflects that 86% of tables remain unscoped.
