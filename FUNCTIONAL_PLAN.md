# NVC360 — Prototype → Functional Product

## Audit summary
Backend is strong. Most gaps are **UI not wired to existing endpoints**, plus a few missing endpoints. Nothing is fake "sample data" at the DB layer — it's seeded real rows — but several screens are read-only or don't expose create/edit/delete.

## Gaps & fixes

### 1. Technicians — add / delete  ❌ → ✅
- Page `riders.tsx` is read-only.
- ADD: `POST /api/riders` (admin) — creates user(role=rider) + rider profile (name, email, phone, skillClass, vehicle, color, password).
- ADD: `DELETE /api/riders/:id` (admin) — removes rider + user.
- UI: "Add Technician" modal + delete on each card. Confirm dialog.

### 2. Customers — add / delete  ❌ → ✅
- ADD: `POST /api/admin/users` (admin) — create client (name, email, phone, password, role).
- ADD: `DELETE /api/admin/users/:id` (admin) — delete account (guard self-delete).
- UI: Directory page gets "Add Client" + row delete.

### 3. Fleet map — call / message / text  ⚠️ → ✅
- Currently only "Call". Add 3 actions in tech panel:
  - **Call** → tel: (exists)
  - **Text** → SMS via Twilio (`POST /api/fleet/:techId/sms`) — real send, we verified Twilio works.
  - **Message** (in-app) → opens thread drawer; uses a new direct tech thread.
- ADD direct (no-booking) messaging: extend messages to support `riderId` threads OR reuse a "dispatch↔tech" channel. Plan: `POST /api/fleet/:techId/message` writes a notification to the tech + stores in messages with a synthetic thread key.

### 4. Form builder — load / edit / select saved forms  ❌ → ✅
- Builder only POSTs. GET/:id, PATCH/:id, DELETE/:id already exist in API.
- UI: click an existing template → loads into canvas (name, category, mins, fields). Save becomes Update (PATCH) when editing. Add "New", "Duplicate", "Delete".
- Parse stored `fields` JSON back into editable field list.

### 5. Create work orders / jobs / tasks  ❌ → ✅
- No create-WO UI anywhere. `POST /api/bookings` exists but assumes customer context.
- ADD admin-side `POST /api/bookings` path that accepts customerId (dispatcher creates on behalf of a client).
- UI: "New Work Order" modal usable from **Work Orders page** AND **Scheduler**. Fields: client, service/template, title, priority, schedule date/time, address, notes, optional assign tech.

### 6. Scheduler — full calendar (day/week/month) + create  ❌ → ✅
- Current scheduler = tech-lane DnD board only (keep as "Dispatch board" tab).
- ADD calendar view with Day / Week / Month toggle rendering bookings by `scheduledAt`.
- Click a day/slot → New Work Order modal prefilled with that datetime.
- Click an event → detail popover (status, tech, client) + quick assign.

### 7. Sort / filter — available & en route  ⚠️ → ✅
- Technicians + Fleet + Directory: add sort/filter controls.
  - Technicians: filter by status (available, enroute, onsite, busy, offline), sort by name/rating/jobs.
  - Fleet overlay: clickable status legend filters map pins.

## Build order
1. Backend endpoints (riders CRUD, users CRUD, fleet sms/message, admin booking create).
2. Reusable modal + form primitives.
3. Technicians page (add/delete/filter/sort).
4. Directory page (add/delete client).
5. Fleet panel (text + in-app message drawer).
6. Builder edit/select/delete.
7. Work Order create modal (shared).
8. Scheduler calendar (day/week/month) + create hooks.
9. Build + curl test + UI smoke.

## Notes
- Role keys unchanged (customer/rider/admin). Labels: Client/Technician/Dispatcher.
- Twilio live ✅. Resend still pending valid key (email log-only) — does not block any of this.
