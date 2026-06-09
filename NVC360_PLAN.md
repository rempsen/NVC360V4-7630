# NVC360 — Field Service Management Platform (rebrand + expansion)

## Brand
- Name: NVC360 (nvc360.com). Tagline: "Make your clients love you — Deliver an Uber-Like Experience"
- Theme: DARK navy (#070b12, #0c1220) + sky/cyan accents (#0ea5e9, #06b6d4). Emerald #10b981 (available/active), amber #f59e0b (warning/break). Inter font, bold/heavy.
- Vocabulary rename (UI labels, keep role keys working under hood):
  - customer → Client
  - rider → Technician (Tech)
  - admin → Dispatcher / Dispatch console
  - booking → Work Order / Task / Job
  - service → Service type / task template

## Roles (keep keys for auth compat)
- customer = Client (tracks their tech)
- rider = Technician (in field, GPS, accept/start/complete)
- admin = Dispatcher/Company admin (fleet map, scheduler, work order builder, admin backend)

## Priority features (this round)
1. Live fleet map — dispatcher sees ALL techs on map, click → status/task/message  ★
2. Customer SMS "tech on the way" + public live-tracking link page w/ call + message  ★ (REAL Twilio)
3. Drag-and-drop work order builder + scheduler + assign tech  ★
4. Admin back-end: users, billing/settings, CSV export (all configs)  ★
5. AI route optimization + auto-rules engine (functional logic, not stub)
6. Integrations panel: QuickBooks, Gmail, Google Cal, O365/Outlook, Xero, CompanyCam (realistic stubs w/ connect UX)

## New DB tables
- companies (multi-tenant-ish: name, plan, settings json)
- taskTemplates (custom work-order templates: fields json, checklist)
- messages (two-way: workOrderId/threadId, fromUserId, body, channel sms|app, createdAt)
- automationRules (trigger, condition, action json, enabled)
- integrations (company, provider, status connected|disconnected, config json)
- companyCamPhotos (workOrderId, url, caption) — or reuse attachments
- extend riders: class/skillClass, color (map color-code), phone, currentTaskId
- extend bookings(workOrders): title, priority, templateId, checklist json, photos, smsSentAt, publicToken (for tracking link)

## Build order
1. Brand pass: styles.css dark theme + logo + brand.tsx components + landing page
2. Schema: add tables, extend; push + reseed (richer fleet: ~8 techs around a city, work orders, templates)
3. API: twilio sms service, messages routes, fleet route, work-order/template routes, automation routes, integrations routes, export(csv) routes, ai-route route
4. Public tracking page /t/:token — live map, ETA, call + message tech (no login)
5. Dispatcher console: sidebar shell → Dashboard, Live Fleet Map, Scheduler(DnD), Work Orders, Work Order Builder, Clients, Technicians, Automation/AI, Integrations, Reports/Export, Settings
6. Technician app rebrand (tech vocab) + messaging
7. Client app rebrand + track page w/ call/message
8. build + test all flows
9. deliver (web). Mobile next round.

## SMS flow (real)
- On work order status → enroute: POST sends SMS via Twilio to client phone:
  "Your NVC360 technician {name} is on the way. Track live + contact: {WEBSITE_URL}/t/{token}"
- Tracking page: live map of tech, ETA, [Call] tel: link, [Message] in-app two-way thread (polls).
- Skip gracefully if Twilio env missing (log only) — same pattern as email.
