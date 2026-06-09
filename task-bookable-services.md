# Bookable Services Dead-End Fix — DONE

## Problem
BMD Materials intake form submit failed: "This company has no bookable services yet".
Root cause: bmd-materials tenant had 0 services; forms had no defaultServiceId.
Customer hit a hard dead-end at submit (worst place to fail).

## 3-Layer Fix (end-to-end)
1. **Backend safety net** [public-forms.ts]: if tenant has no service at submit
   time, auto-create a "General Request" service (cat=general, $0, 60min) so the
   lead is NEVER lost. Old 422 hard-fail removed; only a generic 503 remains for
   true DB failure.
2. **Builder warning** [admin/intake-forms.tsx]: amber banner when tenant has 0
   services + one-click "Create a service" button (calls POST /api/services).
   Queries /api/services; shows only when serviceCount===0.
3. **Seeded BMD now**: 5 real services — Commercial Flooring Supply & Install,
   Window Coverings & Treatments, FF&E Procurement (Hospitality), Site Visit &
   Measurement, Installation Scheduling.

## Verification
- tsc clean, vite build clean, web restarted (200).
- E2E submit to BMD FF&E form → HTTP 201, booking created (pending, tied to
  flooring service), customer user created, recipient emailed. Test row cleaned.

## Status: COMPLETE
