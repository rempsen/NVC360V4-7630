# Public Work Order Creation Form (internal employees, no login)

## Goal
Extend intake forms system: add a "Work Order" form type alongside existing "Lead" type.
Public, unauthenticated (but PIN-gated) form where internal employees create REAL work
orders (bookings) with the same dynamic optionality as the admin work-order-modal:
client search/create, service, priority, optional schedule + technician, dynamic custom
fields, AND catalog-driven line items (products/labor/assemblies) + ad-hoc line items,
mirroring buildLineItem/buildUnitLineItem/ChargesEditor.

## Decisions (from user)
- Access control: shared employee access code/PIN per company (not full login).
- Client: search existing OR add new inline.
- Tech + schedule: optional, employee CAN set but not required.
- Pricing: YES — full dynamic line items (catalog products/services/assemblies + ad-hoc),
  same power as admin modal, not just flat_fee/price_logic custom fields.
- Admin UI: extend existing Intake Forms page with a Lead / Work Order type toggle
  (not a separate nav section).

## Plan
1. Schema: intakeForms += formType ('lead'|'work_order' default 'lead'), accessCode
   (text default ''), allowTechAssign (bool default true). Migrate via raw SQL (Turso).
2. Backend (public-forms.ts):
   - GET form endpoint: include formType, allowTechAssign; services already returned.
   - NEW POST /:companyId/:slug/verify-code {code} -> {ok} rate-limited.
   - NEW GET /:companyId/:slug/catalog (header X-Access-Code) -> catalog items (tenant).
   - NEW GET /:companyId/:slug/clients?q= (header X-Access-Code) -> search customers.
   - NEW GET /:companyId/:slug/riders (header X-Access-Code) -> active riders (if allowTechAssign).
   - POST submit: branch on formType. work_order path: validate access code, resolve/create
     client, build booking like admin POST /admin (lineItems, rateModel, templateId seed,
     priority, staffNotes, requiredSkillClass, riderId optional, scheduledAt optional/default
     now+1day), recomputeBooking, create invoice, fireEvent("created"), tag fieldData.source.
3. Admin UI (intake-forms.tsx): Lead/Work Order toggle at top of FormEditor; when Work Order:
   access code field (generate button), "allow technician & schedule selection" checkbox.
   Reuse existing field builder for extra custom questions (still useful for work orders too).
4. Public UI: new component WorkOrderForm rendered from intake-form.tsx when cfg.formType
   === 'work_order' (same route /f/:companyId/:slug). Flow: access code gate -> client
   search/create -> service + priority + optional schedule/tech -> catalog line item picker
   (search + add, qty, ad-hoc custom line) -> custom fields (if any configured) -> submit.
5. Typecheck, tests, build, then commit/push if repo allows.

## Status: IN PROGRESS
