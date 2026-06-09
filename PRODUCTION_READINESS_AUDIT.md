# NVC360 — Production Readiness Audit
### CTO-level technical review for full-scale (10k+ DAU) deployment

**Reviewer perspective:** Senior engineer / Fortune-500 CTO, 20+ yrs.
**Scope:** Dispatch console → API/data layer → driver (rider) mobile app → customer tracking.
**Verdict at a glance:** Excellent **product** and feature breadth for an MVP/pilot. **Not yet** a hardened, full-scale production system. Several **release-blocking** gaps for a 10k+ daily-user load.

---

## OVERALL GRADE: **C+  (MVP-grade / pilot-ready, NOT scale-hardened)**

| | |
|---|---|
| **Feature completeness** | A− — genuinely broad; dispatch, fleet, catalog, billing math, geofence, live tracking, MCP/API keys, reports |
| **Production hardening** | D+ — the gap between "demo works" and "survives 10k users" is large |
| **Would I greenlight for full scale today?** | **No.** Greenlight for a **limited pilot (1 region, <100 drivers)** — yes, with caveats. |

Think of it this way: the **product** is ~80% there. The **platform engineering** under it is ~35% there. That delta is what this report is about.

---

## GRADING BY CATEGORY

| # | Category | Grade | Blocker for scale? |
|---|----------|:-----:|:------------------:|
| 1 | Architecture & scalability | **D** | 🔴 Yes |
| 2 | Data layer & persistence | **D+** | 🔴 Yes |
| 3 | Realtime / live tracking | **C−** | 🔴 Yes |
| 4 | Payments & billing | **D** | 🔴 Yes |
| 5 | Security & auth | **C** | 🟠 Partial |
| 6 | Multi-tenancy / data isolation | **F** | 🔴 Yes (if multi-company) |
| 7 | Reliability & error handling | **C−** | 🟠 Partial |
| 8 | Observability & ops | **D** | 🔴 Yes |
| 9 | Testing & CI/CD | **F** | 🔴 Yes |
| 10 | File storage & media | **D** | 🟠 Partial |
| 11 | Mobile driver app robustness | **C** | 🟠 Partial |
| 12 | Dispatch console UX/feature depth | **B+** | 🟢 No |
| 13 | Code quality & structure | **B** | 🟢 No |
| 14 | Compliance / privacy | **D** | 🟠 Partial |

---

## 1. Architecture & Scalability — **D** 🔴

**What's there:** Single Bun process serving Hono API + static React SPA. Background `setInterval` sweeps in-process. In-memory `Map` caches for routes/ETAs.

**Gaps to full scale:**
- **Single-process, stateful.** Caches (`routeCache`, `authRouteCache`, `lastEtaAt`, presence sweep) live in process memory. The moment you run 2+ instances behind a load balancer (required for 10k DAU), these caches **diverge per instance** and the `setInterval` reconcile job **double-runs** on every replica.
- **No horizontal-scale story.** No Redis/shared cache, no distributed lock, no job queue. Background work (`reconcileAllRiders`, ETA recompute, notifications) must move to a **dedicated worker + queue** (BullMQ/SQS/Cloud Tasks) before you can run more than one node.
- **No CDN / edge** for the SPA or uploads.
- Bun static-file serving from the app process is fine for a pilot, wrong for scale (offload to CDN/object storage).

**To fix:** Externalize all state → Redis. Move cron/sweeps + notifications + ETA recompute → a queue-backed worker. Make the API node **stateless** so it scales horizontally. Put a CDN in front.

---

## 2. Data Layer & Persistence — **D+** 🔴

**What's there:** SQLite via **Turso/libSQL** (`@libsql/client`), Drizzle ORM, 33 tables, soft-deletes, reasonable indexing on `bookings` (11 indexes) and `audit`.

**Gaps — this is a hard wall:**
- **SQLite is single-writer.** Turso helps with replication/reads, but **write throughput** is the bottleneck. At 10k drivers heartbeating every ~6s = **~1,600–1,800 writes/sec just for location pings**, before bookings, messages, notifications. SQLite/libSQL will not sustain that. **You need Postgres** (RDS/Aurora/Cloud SQL/Neon) for a write-heavy fleet workload.
- **`tracking_pings` is the highest-write table and has NO index on `booking_id`** — yet every ping does `SELECT ... WHERE booking_id = ? ORDER BY created_at DESC LIMIT 1`. That's a **full-scan per ping** which gets catastrophic as the table grows. Needs a composite index `(booking_id, created_at DESC)`.
- **No retention/TTL/partitioning on `tracking_pings`.** It grows unbounded forever. At fleet scale that's tens of millions of rows/week. Needs time-partitioning + a purge job (or a time-series store / PostGIS).
- **No connection pooling story** for a high-concurrency Postgres future.
- **Migrations applied manually/raw** this build (acknowledged in notes). No reproducible migration pipeline = risky for prod.

**To fix:** Migrate to **Postgres + PostGIS**. Add the missing hot-path indexes. Partition/retain `tracking_pings` (e.g., keep raw 7 days, downsample older). Adopt a real migration tool with versioned, reviewed migrations in CI.

---

## 3. Realtime / Live Tracking — **C−** 🔴

**What's there:** Functionally **very good UX** — Uber-style route polyline, animated marker, ETA pill, geofence auto-arrive. ETA/route are server-cached and throttled (good instinct).

**Gaps:**
- **Everything is HTTP polling.** Customer page polls every **2.5s**, driver pings every 6–8s. At 10k concurrent trackers that's a flood of short-lived HTTP requests + DB reads. **This must be WebSockets or SSE** with a pub/sub fan-out (Redis pub/sub or a managed realtime service). Polling does not scale to "tens of thousands daily."
- **Ping write amplification** (see §2). Each ping = 1 read + 1 insert + booking/rider updates. Should be batched/debounced and written to a store built for it.
- Caches are per-process (see §1) so polled reads won't be consistent across LB nodes.

**To fix:** Replace polling with **WebSocket/SSE + Redis pub/sub**. Drivers publish location → server fans out to subscribed customer sockets. Persist pings asynchronously (queue), not on the request path.

---

## 4. Payments & Billing — **D** 🔴

**What's there:** A genuinely sophisticated **billing engine** — rate models (flat/time/mileage), catalog line items, tax by region, invoice generation, receipts. That math layer is impressive.

**The blocker:** **There is no real payment processing.** `POST /payments/pay/:bookingId` simply flips the invoice to `status: "paid"` — *no Stripe, no payment intent, no card capture, no webhook, no idempotency, no refunds, no PCI flow.* The code comment literally says *"simulate a card payment (in a real app -> Stripe)."*

For a platform handling real money at scale this is **release-blocking**:
- No Stripe/Adyen/Braintree integration, no SCA/3DS, no tokenization.
- No **idempotency keys** → double-charge risk on retries.
- No **webhook signature verification** → no reliable async settlement.
- No payout/ledger reconciliation despite a `payouts` route existing.
- PCI scope undefined.

**To fix:** Integrate a real PSP (Stripe), with PaymentIntents, idempotency keys, signed webhooks, refunds, and a double-entry ledger reconciled against the PSP. Treat money paths as the most-tested code in the system.

---

## 5. Security & Auth — **C** 🟠

**What's there (good):** Better-Auth sessions, role + permission system (`requirePermission`, role cache), API keys are **SHA-256 hashed at rest** with prefixes, scopes, expiry, revocation — that's done well. Upload path has `..` traversal guards.

**Gaps:**
- **No rate limiting anywhere.** Confirmed zero. Auth endpoints, ping endpoint, public track token, API keys — all unthrottled. **Open to brute-force, credential stuffing, and DoS.** Release-blocking.
- **CORS is effectively open** (`origin: (origin) => origin ?? "*"` with `credentials: true`). Must be an allowlist in prod.
- **Public track tokens** (`/api/track/:token`) expose tech name, phone, live location, photo with no expiry/rotation shown — PII exposure if a token leaks. Need short-lived/expiring tokens.
- API-key SHA-256 (unsalted) is acceptable for high-entropy random keys, but consider HMAC with a server pepper.
- No security headers (CSP, HSTS, X-Frame-Options), no bot protection on public endpoints.

**To fix:** Add rate limiting (per-IP + per-user + per-token), lock CORS to known origins, expire/rotate track tokens, add security headers, add WAF/bot protection.

---

## 6. Multi-Tenancy / Data Isolation — **F** 🔴 (if serving multiple companies)

**Finding:** **No `companyId`/`tenantId` scoping anywhere in the schema.** Grep found zero tenant columns. There's a single `companySettings` row keyed `"default"`. This is a **single-company application**.

If the intent is one company (NVC's own fleet) — this is fine and not a blocker; downgrade this row.
If the intent is SaaS / multiple operators — this is **fundamental and release-blocking**: every table, every query, and every auth check would need tenant scoping, and retrofitting it later is one of the most expensive refactors in software.

**Action:** Decide single-tenant vs multi-tenant **now**. If multi-tenant, add `companyId` to every table + enforce row-level scoping in middleware before any further growth.

---

## 7. Reliability & Error Handling — **C−** 🟠

- **No global error handler** (`app.onError`) or `notFound` handler on the Hono app → unhandled exceptions leak default/stack responses and inconsistent error shapes.
- Many DB calls are unwrapped; a single bad query can 500 with a raw message.
- Background `setInterval` jobs only `console.error` on failure — no retry, no alerting, no backoff.
- No graceful shutdown / draining.
- No request timeouts or circuit breakers around external calls (Google Maps, Twilio, Resend) — a slow upstream can pile up requests.

**To fix:** Global error middleware with sanitized error envelopes + request IDs; wrap external calls with timeouts + retries + circuit breakers; move sweeps to a supervised worker with backoff and alerting.

---

## 8. Observability & Ops — **D** 🔴

- **No structured logging** (just ~4 `console.*` in API). No request IDs, no correlation.
- **No metrics** (no Prometheus/OTel), **no tracing**, **no error tracking** (no Sentry).
- **No health/readiness depth** — `/health` returns static `{status:"ok"}` without checking DB/queue/dependencies.
- No dashboards, no alerting, no SLOs.

At 10k DAU you are **flying blind**. When (not if) something breaks, you'll have no way to see it. This is release-blocking for scale.

**To fix:** Structured JSON logs + request IDs; OpenTelemetry traces/metrics; Sentry for errors; deep health checks; dashboards + on-call alerting + SLOs.

---

## 9. Testing & CI/CD — **F** 🔴

- **Zero tests.** No unit, integration, or e2e tests in the repo.
- **No CI** (`.github/workflows` absent). No automated typecheck/lint/test gate, no migration checks, no preview deploys.
- Migrations were applied **manually by hand** this cycle.

For a system touching money, dispatch, and live safety-relevant location data, shipping with no test net to 10k users is not acceptable. **Release-blocking.**

**To fix:** Test the money/billing math, auth/permission guards, booking-status state machine, and geofence logic first (highest risk). Add CI: typecheck + lint + test + migration dry-run on every PR. Add e2e smoke (Playwright) for the core dispatch→driver→customer flow.

---

## 10. File Storage & Media — **D** 🟠

- Uploads are written to **local disk** (`process.cwd()/uploads`) and served by the app process — **even though S3 credentials exist in env.** Local disk is **ephemeral**: lost on redeploy, not shared across instances, can't scale horizontally, no CDN, no lifecycle/backup.

**To fix:** Switch uploads to S3 (creds already present), serve via CDN/signed URLs, validate content-type/size server-side, virus-scan untrusted uploads.

---

## 11. Mobile Driver App Robustness — **C** 🟠

**What's there:** Expo app, location heartbeat (`watchPosition` High accuracy 6s/15m), per-job ping, role-based screens, single `apiUrl` source (now pointed at prod ✅).

**Gaps:**
- **Battery & data cost:** 6s High-accuracy GPS + frequent polling will **drain driver batteries** and burn data on an 8-hour shift. Needs adaptive cadence (slower when stationary, faster when moving) + distance-filter tuning + background-task batching.
- **Offline resilience:** no apparent offline queue for pings/status changes when a driver hits a dead zone — events should buffer and replay, not drop.
- **No crash reporting** (Sentry/Crashlytics) on mobile.
- 61 TS errors in shared Hono context types (acknowledged non-blocking, but tech debt).
- Push notifications: ensure APNs/FCM are wired for prod, not just in-app.

**To fix:** Adaptive location strategy, offline ping queue with replay, mobile crash reporting, battery profiling on real devices.

---

## 12. Dispatch Console — **B+** 🟢

Strong. Broad, coherent feature set: bookings/job search, fleet, catalog & pricing, calendar, reports/exports, notification config, audit log, team/roles, integrations, MCP. This is the most production-credible part of the system. Main risk is performance of list/report queries at volume (validate with realistic data sizes + pagination + the right indexes).

---

## 13. Code Quality & Structure — **B** 🟢

Clean monorepo, sensible route/service separation, typed end-to-end (Hono RPC + Drizzle), thoughtful comments, soft-deletes, audit trail, permission abstraction. `tsc` is clean on web. Lint has 313 cosmetic a11y warnings (non-blocking but worth burning down). This is well-organized work — the issue is **platform hardening**, not code hygiene.

---

## 14. Compliance / Privacy — **D** 🟠

- Live location + PII (names, phones, addresses, photos) with **no documented retention, consent, or deletion (GDPR/CCPA/PIPEDA — you're in Canada) policy.**
- Public track tokens expose PII without expiry.
- No data-retention jobs (pings stored forever).
- Audit log exists (good start) but no DSAR/export-delete tooling.

**To fix:** Define retention windows, expiring track links, consent capture for location tracking, and data subject request tooling.

---

## RELEASE-BLOCKER SUMMARY (must-fix before full scale)

1. **Real payments** — no PSP/Stripe; payment is faked. 🔴
2. **Database** — move off SQLite/Turso to Postgres(+PostGIS); add hot-path indexes; partition/retain `tracking_pings`. 🔴
3. **Realtime** — replace polling with WebSocket/SSE + Redis pub/sub. 🔴
4. **Stateless + horizontal scale** — externalize caches/cron to Redis + worker/queue. 🔴
5. **Rate limiting + CORS lockdown + expiring track tokens.** 🔴
6. **Observability** — logging, metrics, tracing, error tracking, real health checks. 🔴
7. **Tests + CI/CD** — at minimum cover money, auth, state machine, geofence; gate every PR. 🔴
8. **Object storage** for uploads (S3, already provisioned). 🟠
9. **Global error handling** + external-call timeouts/retries. 🟠
10. **Multi-tenancy decision** (F if SaaS; N/A if single-company). 🔴/—

---

## RECOMMENDED PATH

- **Pilot now (safe):** 1 region, <100 drivers, real payments OFF or manual, with the team watching it. The product is good enough to learn from real dispatchers/drivers today.
- **Hardening sprint (before scale):** Postgres migration + indexes/retention → realtime sockets → Redis/queue + stateless nodes → Stripe → rate limiting/CORS/tokens → observability → tests/CI → S3 uploads.

**Honest bottom line:** You've built a feature-rich, well-structured product that *demos* like a real platform — that's the hard creative part and it's genuinely strong (**A− product**). But underneath, it's an **MVP runtime on a single-writer embedded DB with polling, no real payments, no tests, no observability, and no horizontal-scale story.** Those are exactly the things that don't matter at 50 users and absolutely decide whether you survive at 10,000+.

**Current grade: C+ (pilot-ready, not scale-hardened).** Close the 10 blockers above and this is a legitimate **A−/B+ production platform.**
