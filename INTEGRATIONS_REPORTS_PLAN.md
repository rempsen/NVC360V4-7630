# Integrations + Calendar + Reports + Tech Hover — Build Plan

Primary users: field service / mobile workforce (HVAC, plumbing, appliance, courier/delivery,
security, elder/home care, cleaning, limo, florist delivery, private ambulance, tours).
Core value = Uber-like coordination: confirm appts, live ETA, 2-way call/text, clock in/out.

## PHASE 1 — Calendar (iCal, no OAuth) ✅ do first
- [x] DB: add `calendarToken` to user (per-user secret for feed URL).
- [x] `src/services/ics.ts` — build VEVENT/VCALENDAR strings + per-event .ics.
- [x] Route `GET /api/calendar/:token.ics` (auth via token, not session) — returns user's jobs as VCALENDAR.
      - Dispatcher/admin: all jobs. Driver: assigned jobs. Customer: own jobs.
- [x] Confirmation emails: attach `appointment.ics` + "Add to Google / Outlook / Apple" buttons.
      - Resend supports `attachments`. Add helper to email.ts.
- [x] Settings UI: "Calendar Sync" card — show personal webcal subscribe URL + copy + Google/Outlook subscribe links.

## PHASE 2 — Reports overhaul ✅ do second (no deps)
- [x] Backend `src/api/routes/reports.ts` — aggregated, date-range + filter aware:
      - revenue (by period/service/tech), tech performance, job status/completion,
        payroll/payouts, catalog margin/COGS, client activity/retention, AR invoices, zone breakdown.
- [x] Export: CSV (have), + Excel (.xlsx via exceljs/xlsx) + PDF (server render).
- [x] New `reports.tsx`: modern UI — date range picker, preset ranges, dataset tabs,
      include/exclude columns, charts (recharts), KPIs, export menu (CSV/XLSX/PDF).

## PHASE 3 — Tech hover → click (mirror job hover) ✅ quick
- [x] fleet-map.tsx: rich tech tooltip card (name, skill, status, current task, ETA) + "click to open".
- [x] fleet.tsx: clicking tech already selects → ensure side panel shows task + Message button.
      Add quick "Message" affordance from hover card.

## PHASE 4 — Integrations go live (OAuth) — NEEDS USER CREDENTIALS
Real connect flow w/ token storage + refresh. Providers requested:
- QuickBooks, Xero (accounting)
- Gmail send-as, Outlook/M365 email
- CompanyCam (photos)
- Google Drive, Dropbox, OneDrive (file storage)
- [x] Generic OAuth2 framework: `src/services/oauth.ts` (authorize URL, token exchange, refresh).
- [x] integrations table: add accessToken/refreshToken/expiresAt/scope/externalAccountId.
- [x] Routes: `/api/integrations/:provider/authorize` -> redirect; `/oauth/callback/:provider` -> exchange+store.
- [x] Per-provider config (scopes, endpoints). Request secrets via ask_secrets when building each.
- [x] integrations.tsx: real connect buttons (open OAuth popup), live status, account label, scopes.

## NOTES
- Single chokepoint billing recompute already feeds reports.
- Calendar OAuth 2-way sync deferred (user chose "iCal now, OAuth later").
- Build verify: `bun run build` clean + browser check each phase.
