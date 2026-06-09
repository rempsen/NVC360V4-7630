# Phase 2 — Reports Overhaul

## Goal
Aggregated, date-range + filter aware reports with KPIs, charts, and CSV/XLSX/PDF export.

## Reports (all)
- revenue/sales (by day, by service, by zone)
- tech performance (jobs, revenue, rating, on-time)
- job status/completion funnel
- payroll/payouts (gross/fee/net by tech, period)
- catalog margin/COGS
- client activity/retention (top clients, new vs returning)
- AR invoices (paid/unpaid aging)
- zone breakdown (jobs + revenue per zone)

## Backend: src/api/routes/reports.ts
- GET /api/reports/:report?from=&to=&status=&techId=&zone=
- returns { kpis:[], series:[], rows:[], columns:[] }
- date filtering on bookings.scheduledAt / invoices.createdAt / payouts.periodStart

## Export: src/api/routes/export.ts
- add ?format=csv|xlsx|pdf to existing + new report exports
- xlsx via exceljs; pdf via pdf-lib (table render)

## Frontend: reports.tsx rewrite
- date range picker + presets (Today/7d/30d/QTD/YTD)
- report tabs (sidebar)
- KPI strip
- charts via recharts (bar/line/pie)
- data table
- export menu (CSV/XLSX/PDF)

## Progress
- [x] Phase 1 calendar (done)
- [x] Phase 3 tech hover (done)
- [x] install exceljs, recharts, pdf-lib
- [x] reports.ts backend
- [x] export xlsx/pdf
- [x] reports.tsx UI
- [x] build clean + verify
- [ ] Phase 4 OAuth
