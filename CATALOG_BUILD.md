# Catalog + Assemblies Build

## Decisions
- Price mode: BOTH per item (toggle auto = cost*(1+markup) vs manual unitPrice)
- Merge Services → Catalog as kind=service; retire /admin/services page (migrate data)
- Scope: catalog module + assemblies + WO line-item picker + reporting math everywhere

## Schema
- NEW table `catalogItems`: id, kind(service|product|assembly), name, sku, category, description, image, unit, unitCost, markupPct, priceMode(auto|manual), unitPrice, taxable, components(JSON [{itemId,qty}]), active, createdAt
- `bookings.lineItems` (JSON) — new col: [{itemId,kind,name,sku,unit,qty,unitCost,unitPrice,taxable,cost,price,components?}]
- Migration script: add cols/table + backfill services→catalogItems

## Backend
- routes/catalog.ts: GET / (filter kind,q), GET /:id, POST, PATCH, DELETE(soft), POST /:id/image, GET /resolve (expand assembly), POST /seed-from-services
- mount in api/index.ts
- shared/catalog.ts: pure roll-up math (item price/cost, assembly rollup, line-item totals) used by FE + BE
- dispatch/booking create+update: compute lineItemsCost, lineItemsPrice, fold into subtotal/total/priceBreakdown
- payouts: ensure tech pay unaffected by client markup (tech pay = labor/hourly, not product markup) — but capture material cost vs revenue
- reports/export: include line-item revenue, cost, margin

## Frontend
- lib/catalog.ts mirror of shared math (or import shared)
- pages/admin/catalog.tsx: grid + filters + editor modal (service/product + assembly builder) + live margin
- nav: add Catalog under Form Builder; retire Services nav (redirect /admin/services → /admin/catalog)
- work-order-modal: "Add from Catalog" picker → line items section → feed quote/subtotal
- reports.tsx: catalog revenue/cost/margin; client & tech records show line items

## Status
- [ ] schema + migration
- [ ] shared/catalog math
- [ ] backend route + mount
- [ ] booking math integration
- [ ] catalog admin page + nav
- [ ] WO line-item picker
- [ ] reporting/records
- [ ] build + verify

## ✅ COMPLETE — all phases shipped & verified (2026-06-01)
- [x] Migration run (catalog_items + 3 booking cols + backfill + samples)
- [x] schema / shared/catalog math / billing chokepoint
- [x] catalog.ts API (CRUD, image, categories, seed)
- [x] bookings.ts accepts+persists lineItems on POST `/`, POST `/admin`, PATCH `/:id`
      (fixed: `/admin` insert block + enrichById returns fresh recomputed row)
- [x] catalog.tsx admin page (grid, kind/category/search filters, editor + assembly builder, live math, image upload)
- [x] nav item + route + (services route kept, catalog is primary)
- [x] work-order-modal.tsx catalog line-item picker (search, qty, assembly expansion, feeds quote + payload)
- [x] reports.tsx KPIs: catalog revenue / COGS / margin / margin%
- [x] admin stats endpoint aggregates lineItemsPrice/Cost across bookings
- [x] client record (users.tsx) shows catalog-item count per job
- [x] `bun run build` clean; browser-verified catalog page, assembly editor, WO picker
- VERIFIED MATH: assembly Flooring = cost 3.9 / price 7.09 / 44.99% margin; booking persist 752.2/414; stats aggregate correct
