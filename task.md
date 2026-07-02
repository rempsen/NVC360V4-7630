# Bring full pricing power to the public Work Order intake form

## Gap identified (user screenshots)
Admin "New Work Order" modal has full pricing: Products & materials (catalog),
Per-unit line items, AND "Charges" (flat fee / hourly / per-unit ad-hoc via
ChargesEditor) with tax-aware price preview + region.

Public work-order-form.tsx (online intake) only has: catalog picker + one
flat "custom line" (ad-hoc per-unit only, no flat fee, no hourly, no region/
tax preview). Missing: ChargesEditor parity, rateModel/hourly billing, region
resolution, live price preview with tax.

## Plan
1. Reuse `ChargesEditor` + `chargesSummary` + `Charge` type directly in
   work-order-form.tsx (already a shared web component, safe to import from a
   public page — no auth-only deps inside it).
2. Add `charges` state + region state + auto-resolve region from address
   (regionFromAddress, same as admin modal).
3. Mirror `buildPayload()`'s charge->lineItem conversion (flat_fee/per_unit ->
   buildUnitLineItem lines, hourly -> rateModel) exactly as work-order-modal.tsx
   does, so submitted work orders are billing-identical regardless of which
   form created them.
4. Add a live price preview (subtotal / tax / total) using the same lookupTax
   + sumLineItems math, matching the admin modal's "Price preview" panel.
5. Backend (public-forms.ts submitWorkOrder): currently does NOT persist
   rateModel at all — add `rateModel: body.rateModel ? JSON.stringify(...) : ""`
   to the booking insert so hourly charges actually take effect (recomputeBooking
   already reads rateModel from the booking correctly once it's stored).
6. Verify: tsc, tests, build, live E2E test (flat fee + hourly + per-unit +
   catalog item all in one submission, confirm total matches admin-side math).

## Status: IN PROGRESS
