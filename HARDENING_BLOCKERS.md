# Top-5 Blockers — Execution Plan

Decisions: full multi-tenant + enforced helper · Redis env-gated · Sentry env-gated · webhook secret hard-required in prod · committed migrations (baseline 0000).

## 1. Multi-tenancy — full (35 tables) + enforced query helper  [IN PROGRESS]
- [ ] Add `companyId` (notNull default "default") + index to every tenant-owned table missing it
- [ ] Junction/child tables: derive tenant via parent OR stamp directly (decide per table)
- [ ] Build `tdb` enforced helper: scoped select/insert/update/delete that REQUIRES companyId
- [ ] Refactor every route to use the helper (no raw db.select on tenant tables)
- [ ] Migration applied to remote Turso, backfill existing rows to "default"
- [ ] tsc clean + tenant-isolation test (company A cannot read company B rows)

## 2. STRIPE_WEBHOOK_SECRET — reject unverified in prod  [TODO]
- [ ] Webhook returns 400 if NODE_ENV=production and secret missing/sig invalid
- [ ] Document the env var

## 3. Sentry env-gated  [TODO]
- [ ] Harden lazy init; flush on fatal; scrub PII; confirm no-op when DSN unset

## 4. Redis env-gated (rate-limit + realtime)  [TODO]
- [ ] RedisStore for rate-limit (implements existing RateLimitStore iface)
- [ ] Redis pub/sub bus for realtime (implements existing bus iface)
- [ ] Boot wiring: if REDIS_URL set -> swap both, else in-memory

## 5. Migrations baseline  [TODO]
- [ ] drizzle-kit generate baseline 0000 from current schema
- [ ] Mark as applied on remote (already has schema) — no destructive run
- [ ] Switch package scripts: deploy via db:migrate; commit drizzle/ dir
- [ ] CI dry-run uses committed migrations

## Tenant-table classification (35 total)
TENANT-OWNED (need companyId): services, riders, task_templates, skill_library, messages,
automation_rules, integrations, job_photos, bookings, catalog_items, tracking_pings, invoices,
payment_ledger, notifications, reviews, company_settings, tags, entity_tags, custom_fields,
custom_field_values, attachments, tech_shifts, service_zones, payouts, audit_log,
notification_rules, notification_channels, email_templates, webhook_endpoints,
notification_deliveries, tech_invites, api_keys, idempotency_keys
GLOBAL (no companyId): role_permissions (role->perms catalog, shared)
NOTE: user.companyId already exists (auth-schema).
