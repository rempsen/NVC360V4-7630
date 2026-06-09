# NVC360 — Production Hardening (10 blockers)

Decisions:
- Multi-tenant SaaS → add `companyId` to every table + scope all queries
- Stay on Turso → add indexes + retention (defer Postgres, but write portable SQL)
- Stripe (real, test keys) → PaymentIntents + idempotency + signed webhooks
- SSE single-node now (Redis-ready fan-out later)
- Structured logs now + Sentry-ready hooks
- Deliver in priority batches

## BATCH 1 — Fast high-impact (security + data hygiene)  [CODE DONE — verifying]
- [x] 1. Rate limiting — lib/rate-limit.ts (auth/api/track/ping presets), Redis-ready store iface
- [x] 2. CORS allowlist — env CORS_ORIGINS, no ACAO echo for disallowed
- [x] 3. Public track tokens: expiry (tokenExpiresAt, TTL on enroute) + rate limited
- [x] 4. tracking_pings: (booking_id,created_at) index + retention purge (services/retention.ts)
- [x] 5. Uploads → S3 (lib/storage.ts), signed-url proxy route, disk fallback dev
- [x] 6. Global onError + notFound + AppError envelope (lib/errors.ts) + request IDs
- [x] 7. Structured JSON logging (lib/logger.ts) + Sentry hooks + /ready deep probe
- NEXT: typecheck + restart + smoke test

## BATCH 2 — Realtime  [DONE — verified]
- [x] 8. SSE live tracking (replace polling) — driver publishes, customers subscribe; Redis-ready abstraction
  - VERIFIED: snapshot-on-connect, 20s heartbeat, ping->live snapshot push (tech loc updated). Fixed Bun idleTimeout:0 (was killing stream at 10s). All writes on main async loop (setInterval writes didn't flush).

## BATCH 3 — Payments  [CODE DONE — live charge pending user card]
- [x] 9. Stripe PaymentIntents, idempotency keys, signed webhooks, refunds, ledger
  - services/stripe.ts (lazy client, CAD, toMinor/fromMinor)
  - routes/payments.ts: /config, /intent/:bookingId (idempotent PI create/reuse), /sync, /refund (NVC360 staff only), /ledger
  - routes/payments-webhook.ts: signed (constructEvent), replay-safe via idempotency_keys, handles pi.succeeded/processing/failed/canceled, charge.refunded, dispute.created. Mounted BEFORE json/auth in api/index.ts for raw body.
  - frontend: components/stripe-pay.tsx (real PaymentElement, night theme, "Thank you from the NVC 360 team."), wired into customer/track.tsx (removed fake modal + dead pay mutation)
  - bun add stripe @stripe/stripe-js @stripe/react-stripe-js
  - VERIFIED: live PI created ($1.00 CAD), Elements rendered with pk_live, idempotency header sent. Real $1 charge awaiting user card entry.
  - ⚠️ KEYS ARE LIVE (pk_live_/sk_live_) not test. WEBHOOK_SECRET still empty — must add real endpoint in Stripe dashboard + set whsec_ for prod.

## BATCH 4 — Multi-tenancy (FOUNDATION DONE)
- [x] 10. companyId tenant scoping (foundation: bookings, invoices, riders, messages, payment_ledger + user)
  - schema.ts: companyId text notNull default "default" + idx on 5 tables; auth-schema user.companyId
  - middleware/auth.ts: authMiddleware sets c.companyId from session user; exported tenantId(c) helper (throws if unresolved)
  - companies table (id/name/slug) + "default" row; backfilled all rows/users to "default"
  - scoped reads + stamped writes: bookings.ts (list 3 branches + single + 2 booking inserts + 2 invoice inserts), payments.ts (5 invoice reads + ledger read + ledger() auto-derives companyId from invoice), messages.ts (dispatch/threads + riders list + 3 msg inserts), riders.ts (admin list + 3 rider inserts)
  - Migration applied RAW to remote Turso via @libsql/client. tsc EXIT 0. Smoke test: paytest@ login 200, bookings/invoice/ledger all 200, 1 booking returned.
  - SCOPE NOTE: foundation 5 tables only; ~28 other tables NOT scoped this pass (single-tenant "default" safe until 2nd company onboarded).

## BATCH 5 — Tests + CI  [DONE]
- [x] 11. Tests: pricing/tax math, Stripe money, permissions resolution, geofence/haversine, on-site clock (61 tests, all green)
- [x] 12. CI: .github/workflows/ci.yml — tsc(web, gating) + lint(non-block) + bun test + drizzle generate dry-run

STATUS: Batch 1+2+3+4 code DONE (tsc clean, smoke-tested). Starting Batch 5 (tests + CI).
PLAN: finish Batch 4 & 5, then ONE final deploy via platform Publish UI, then user tests the live $1 payment on prod. Webhook secret deferred (using /sync fallback for now).
Stripe keys: LIVE (pk_live_/sk_live_). WEBHOOK_SECRET=empty (deferred).
Test artifacts to keep until final deploy: $1 invoice INV-TEST01 on booking a39368f6-..., user paytest@nvc360.app/paytest123, scripts/_make_dollar_invoice.ts + _assign_paytest.ts.
