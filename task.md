# Messaging cross-tenant fix — DONE (Jul 3, 2026)

## Fixed
packages/web/src/api/routes/messages.ts:
- Added `officeUsersForNotify(companyId)` helper — scopes admin/superadmin
  lookup to ONE tenant (mirrors existing correct pattern `officeUsers()` in
  services/dispatch.ts).
- POST /direct (tech -> dispatch): now uses `officeUsersForNotify(tenantId(c))`
  instead of unscoped `inArray(schema.user.role, ["admin","superadmin"])`.
- POST /:bookingId (customer -> tech/dispatch, job thread): now uses
  `officeUsersForNotify(b.companyId)` (the booking's own tenant) instead of
  the same unscoped query.

## Verified
- tsc clean, 112/112 tests pass, build succeeds.
- Real HTTP round-trip test (minted a session, POSTed to the live
  /api/messages/direct endpoint): only the 3 admins/superadmins belonging to
  the `default` tenant received a notifications row. Acme HVAC, Bolt
  Plumbing, Precon Builders, and BMD Materials admins were correctly
  excluded — confirmed by querying the notifications table after the real
  request.
- Isolated logic check also confirmed bmd-materials vs acme-hvac
  officeUsersForNotify() results have zero overlap.

## Already-correct (re-verified, no changes needed)
- GET/POST /dispatch/threads, /dispatch/:techId(/mark-read), /direct/unread,
  /direct/mark-read, broadcast, tags/skill-classes/skills — all properly
  scoped via tx(c) or explicit companyId filters.
- fleet.ts direct-thread endpoints — all via tx(c), already tenant-safe.
- mcp.ts message tool handlers — receive pre-scoped TenantDb, already safe.

## Data quality note (found during testing, NOT part of this fix — flagged for user)
Some rider rows have a companyId that doesn't match their linked user's
companyId (e.g. BMD Materials' seed rider "Mr Floor Install"
contact@bmdmaterials.com has riders.company_id = bmd-materials but
user.company_id = default). This is a pre-existing data inconsistency
unrelated to the messaging fix — did not touch it, but worth a cleanup pass
if it's not intentional multi-tenant staff sharing.

## Committed
Pending commit + push (see below).

---

# Service Zones blank map (BMD Materials) — ON HOLD per user

User asked to hold this fix. Live-tested on both dev sandbox and production
(uberize.ai) as superadmin acting as BMD Materials — map rendered correctly
with visible tiles in both cases, could not reproduce the reported blank-map
issue. No code changes made. User will retest on their Mac/Chrome test
machine and report back with specifics (console errors, whether hard refresh
helps, etc.).
