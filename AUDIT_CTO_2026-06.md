# NVC360 — CTO-Grade System Audit
**Reviewer lens:** Fortune 500 / Silicon Valley CTO · **Date:** June 3, 2026
**Surfaces graded:** Web (marketing + customer), Dispatcher Console, Driver App (mobile), Platform/Backend

---

## TL;DR — Overall: **B / B+ ("strong seed-stage, pre-Series-A hardening")**

This is a genuinely well-architected field-service platform — not a prototype. The data layer, multi-tenancy, payments, and security fundamentals are above what most startups ship at this stage. The gap between today and "Fortune-500-grade" is **not features — it's scale-out infrastructure, the mobile field experience, and test/observability depth.**

| Surface | Grade | One-line |
|---|---|---|
| Backend / Platform architecture | **A−** | Clean, enforced multi-tenancy; cloud DB + S3; payments done right. Single-node ceiling. |
| Dispatcher Console (web) | **A−** | Feature-rich, real product. Live ops, scheduler, catalog, billing, audit. |
| Customer / Public web | **B+** | Solid booking + public tracking. Polling, not push. |
| Driver App (mobile) | **C+** | Functional but missing the two things drivers need most: push + background location. |
| Quality (tests/CI/observability) | **B−** | Right instincts (CI, Sentry, typed). Thin coverage, non-blocking gates. |

---

## What's genuinely strong (would survive a CTO due-diligence)

**1. Enforced multi-tenancy — the hard part, done right.**
`tdb(companyId)` wraps every tenant-owned table so a forgotten `.where()` *can't* leak data across companies. Global tables are explicitly allow-listed. This is the single most important architectural decision in a multi-tenant SaaS and it's implemented as a guardrail, not a convention. **Most startups get this wrong.**

**2. Payments integrity.** Stripe webhooks verify signatures against the raw body, replay-protected via an `idempotency_keys` table keyed on the Stripe event id. Money mutations are deduped. This is the correct pattern.

**3. Cloud-native storage posture (as of today's fix).** Cloud SQLite (Turso/libsql) + S3-compatible object storage, behind a clean `storage` abstraction. No machine dependency. Private bucket + public proxy route for images/emails.

**4. RBAC with a real hierarchy.** superadmin ⊃ admin ⊃ dispatcher ⊃ rider ⊃ customer, permission-checked centrally. Audit logging on ~12 mutating routes.

**5. Engineering hygiene signals.** Typed end-to-end (Hono RPC client), CI on every PR, Sentry wired, data-retention sweeps to bound high-write tables (tracking pings), soft-delete on bookings. The realtime bus and rate-limiter are written *behind interfaces* specifically so Redis can drop in — the author saw the scale problem coming.

---

## The gaps that separate this from Fortune-500-grade

### 🔴 P0 — Scale ceiling: everything is single-node in-memory
- **Realtime bus** (live tracking, dispatch messaging) = in-process pub/sub. **Two server instances = customers miss location updates** depending on which node they hit.
- **Rate limiter** = in-memory Map. Resets on deploy; useless across instances.
- **Impact:** You cannot horizontally scale or run zero-downtime rolling deploys without breaking live features. This is the #1 thing a CTO flags before raising headcount/traffic.
- **Fix:** Redis (Upstash) for both pub/sub fan-out and the rate-limit store. The interfaces already exist — this is a backing-store swap, ~2–3 days.

### 🔴 P0 — Driver app is missing its two most critical capabilities
- **No push notifications.** `expo-notifications` isn't even a dependency. A driver who backgrounds the app **never learns a job was assigned/changed.** For field service, this is table-stakes.
- **Foreground-only GPS.** Location heartbeat runs only while the app is open and foregrounded (`expo-location`, no `expo-task-manager`/background task). **The dispatch map pin freezes the moment a driver locks their phone** — exactly when they're driving.
- **Impact:** The live map and ETA promises to customers are only as good as a driver keeping the app open on screen. That's not realistic.
- **Fix:** Add Expo push (token registration + server send via Expo Push API) and background location task. ~1 week.

### 🟠 P1 — Test coverage is thin and CI gates are soft
- 8 test files; unit tests cover pricing/tax/money/geo/permissions (good — the money math is tested). But **no integration tests** on the API routes, **no E2E** on the booking→dispatch→complete→invoice flow.
- CI: typecheck (web) blocks ✅, but **lint and mobile/desktop typecheck are `continue-on-error`** — a known a11y/hooks backlog is being shipped around, not down.
- **Fix:** API integration tests on the critical money + tenancy paths; one Playwright E2E happy-path; make lint blocking after burning down the backlog.

### 🟠 P1 — Observability is "errors only"
- Sentry catches exceptions; structured logger exists. But **no metrics, no tracing, no product analytics, no uptime/SLO dashboards.** A CTO asks "what's your p95 dispatch latency / payment success rate / DAU?" — today there's no answer.
- **Fix:** Add metrics + tracing (OpenTelemetry → a backend), product analytics (PostHog), and an uptime monitor with alerting.

### 🟡 P2 — Polishing items
- **Polling, not push, on web** (20 `refetchInterval` usages). Works, but wasteful and laggy vs. SSE/WebSocket — and the SSE bus already exists for tracking; extend it to dispatch/notifications.
- **Accessibility backlog** (lint is suppressing a11y rules). Enterprise/government buyers will run an audit; fix before you need it.
- **No documented DR/backup posture** for the DB (Turso has PITR — confirm it's on and document RPO/RTO).
- **Secrets in `.env`** — fine now; move to a managed secrets store (Doppler/Vault/cloud KMS) before team grows.

---

## 90-day hardening roadmap (priority order)

| # | Item | Effort | Why it matters |
|---|---|---|---|
| 1 | Redis-back realtime bus + rate limiter | ~3d | Unlocks horizontal scale + zero-downtime deploys |
| 2 | Mobile push notifications (Expo) | ~3d | Drivers actually get job alerts |
| 3 | Mobile background location task | ~3d | Live map stays live when phone is locked |
| 4 | API integration tests (money + tenancy) + 1 E2E | ~1wk | Confidence to ship fast without regressions |
| 5 | Metrics + tracing + product analytics + uptime/SLO | ~1wk | "Run the business on numbers" |
| 6 | Make lint blocking; burn down a11y backlog | ~3d | Enterprise procurement readiness |
| 7 | Document DR/backup (RPO/RTO); move secrets to manager | ~2d | Diligence checkbox |

**Net:** Ship items 1–3 and you move from B+ to A− and are genuinely production-scalable. Add 4–7 and you'd pass a Series-A technical diligence comfortably.
