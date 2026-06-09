# Job/Task Search + Export System

Goal: dispatcher can search/filter every job by 15 fields, paginated server-side,
export filtered results (column-pickable) as CSV/JSON/PDF/print + per-job detail.
Secure (admin/dispatcher only), audited, soft-delete, indexed for scale (~500 jobs/mo).

## Filters (15)
customer name, customer phone/email, address, technician, status, priority, service,
scheduled date range, completed date range, payment status, price/total range, tags,
job number/id, region, free-text notes.

## Plan
- [x] 1. Schema: add `deletedAt` to bookings (soft-delete) + indexes (status, scheduledAt,
      finishedAt, riderId, customerId, paymentStatus, priority, region, createdAt). db:push.
- [x] 2. Backend: GET /api/bookings/search — all filters + pagination + sort, role-gated (admin).
      Returns enriched rows + total count + facet options (techs, services, statuses).
      Exclude soft-deleted.
- [x] 3. Backend: rich bookings export respecting same filters; full column set; column picking;
      CSV/JSON/PDF; audit-log each export. Per-job detail export (single booking, all fields).
- [x] 4. Soft-delete: DELETE booking sets deletedAt instead of hard delete (+ restore).
- [x] 5. UI: rebuild admin Work Orders page — filter bar (all 15), results table w/ server
      pagination, column-picker + export menu, print view, per-job detail export.
- [x] 6. build + restart + verify w/ screenshots + deliver.

## Notes
- DB libSQL/SQLite, drizzle. Apply schema via `cd packages/web && bun run db:push`.
- requireAdmin middleware exists. auditLog table exists (actorId/action/entityType/entityId/summary/meta).
- export.ts already has toCsv/toXlsx/toPdf helpers + /report endpoint (POST rows+columns).
- bookings.enrich() adds service/rider/customer. Reuse.
