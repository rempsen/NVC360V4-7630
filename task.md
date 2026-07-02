# Form Builder audit + fix

## Scope
1. Shared category list (Settings + Catalog), editable, seeded from industry preset
2. builder.tsx: checkbox/dropdown option editing (add/remove option rows like intake-forms.tsx already does)
3. Wire template `fields` end-to-end: admin work-order-modal fill-in + mobile job screen fill-in + persistence

## Plan
- [ ] DB: new `formCategories` table (companyId, name, sortOrder)
- [ ] API: /api/catalog/categories GET/POST/DELETE (+PATCH rename)
- [ ] builder.tsx: category select -> use categories API, inline "manage categories" link/modal
- [ ] catalog.tsx: category field -> dropdown sourced from same API + manage inline
- [ ] builder.tsx: Field type add `options?: string[]`; checkbox + select get options editor (add/remove rows)
- [ ] bookings.ts enrich(): include resolved templateFields (from linked template) in booking payload
- [ ] New route PATCH /api/bookings/:id/template-fields { values } to save fieldData._templateFields
- [ ] work-order-modal.tsx: render template fields section, collect answers, include in create/patch payload
- [ ] mobile job/[id].tsx: render + fill template fields, save via new endpoint
- [ ] typecheck + tests + build + verify in browser
- [ ] commit + push

## Progress
- [x] DB: form_categories table created (raw SQL, Turso)
- [x] API: /api/catalog/categories GET/POST/PATCH/DELETE (seed from industry preset, block delete if in use, rename propagates)
- [x] category-manager.tsx shared component
- [x] builder.tsx: category select uses shared list + Manage button
- [x] builder.tsx: FieldRow with options add/remove for select+checkbox
- [x] catalog.tsx: category field -> dropdown + Manage button
- [x] settings.tsx: CategoriesCard (inline add/rename/delete)

## Remaining (part 3 — wire fields into real work orders)
- [ ] bookings API: seed checklistState from template.checklist on create
- [ ] work-order-modal.tsx: render template fields, collect values, save
- [ ] mobile job/[id].tsx: render + fill remaining template fields
- [ ] typecheck + tests + build + visual verify + commit + push

## Part 3 progress
- [x] Found + fixed REAL pre-existing bug: /api/bookings/admin (create) never accepted fieldData at all -> custom fields silently dropped on every new work order
- [x] Found + fixed REAL pre-existing bug: PATCH /api/bookings/:id never accepted fieldData either -> edits to custom fields were silently dropped on save
- [x] Added templateFieldsToCustomFields() helper in bookings.ts: converts template.fields (text/number/checkbox/select/photo/signature/date) into the existing _customFields shape (photo+signature -> file)
- [x] Admin create route now seeds fieldData._customFields + checklistState from the selected template (if office hasn't already customized fields)
- [x] Added "select" and "date" CfType to work-order-modal.tsx (CF_TYPES, CfCard config UI incl. options add/remove for select)
- [ ] NEXT: work-order-modal.tsx frontend — on template selection (new WO only), load template fields into customFields editor so office sees/can edit them before saving (currently only happens server-side on submit, invisible until reload)
- [ ] Mobile job/[id].tsx: add "select" and "date" rendering to the _customFields renderer (currently only handles instructions/checkbox/flat_fee/price_logic/notes/text/number) + confirm checklist renders (it already does via separate `checklist` array)
- [ ] typecheck + tests + build + visual verify + commit + push

## Status: in progress — part 3 in progress
