# Admin fine-tuning build

## Decisions
- Re-spread demo bookings across next 2 weeks (keep today's in_progress on today).
- Pricing: fully flexible per-task rate model. Components (any combination, all optional):
  - flatRate ($) that INCLUDES includedMinutes + includedKm
  - perMinute OR perHour rate billed after included time (pick unit)
  - perKm rate billed after includedKm
  - Allows pure per-minute/per-hour or pure per-km with zero flat.
- Tax: Canada provinces + US states full lookup table; pick by work order address region; combined rate.
- Mileage: tech taps Start -> GPS pings -> sum great-circle distance until Complete (round trip).
- Driver pay: per-hour pay for time on site (payRatePerHour on rider) + existing share.
- Skill library: shared table; dropdown pick or type-new-to-add; tags on tech too.

## Channels: editable email + SMS body templates with tokens (firstName, address, jobName, jobNumber, etc.)
- Notifications > Channels: add Email template + SMS template editors with token chips, per a set of "transactional" templates? 
- Reuse per-event template editor already built; here add a TOKENS expansion (customer first name, address, job name/number).

## Build order
1. [ ] Re-spread demo bookings (script)
2. [x] Schema additions
3. [x] Tax lookup table util
4. [x] Pricing engine util
5. [x] Backend routes: skills CRUD, pricing on services/templates, recompute on create+complete, mileage pings, tech hourly pay (accrueTechPay), pricing quote endpoint
6. [x] Notifications Channels: editable email/SMS body + token palette (firstName/address/jobName/jobNumber added to dispatch vars)
7. [x] Scheduler: calendar Work Queue (unassigned/undated) on far LEFT, drag onto a day -> set date, then assign — VERIFIED in browser
8. [x] Add Technician: tags + skills from library (type-new-to-add), payRatePerHour
9. [x] Form builder: RateModel editor per task
10. [x] Work order modal: rate model + live price calc w/ tax by region; mileage display
       - Est. minutes + Est. mileage (km) editable inputs added
       - Price Preview block: line items, subtotal, tax label, total — live recompute
       - regionFromAddress now resolves major CA cities (Toronto->ON HST 13%, Vancouver->BC GST+PST, etc.)
11. [x] tsc clean (exit 0) + build OK + web restart (health 200) + verified in browser

## User edit-flow requests (this session) — ALL DONE + VERIFIED
- [x] Edit address from Work Orders page (Edit btn + edit modal, PATCH /api/bookings/:id)
- [x] Click tasks in scheduler board + calendar to open edit menu
- [x] Calendar drag-drop with 30-min time placement (7:00a–8:00p day-column grid)
- Edit modal verified rendering: populated fields, mileage/minutes inputs, price preview, Save Changes

## Driver live location fix (mobile)
- BUG: tech pin stayed at Toronto seed coords. Cause: GPS only sent from job screen while status=enroute. No global driver heartbeat.
- FIX: lib/use-location-heartbeat.ts — watchPositionAsync + PATCH /api/riders/me {lat,lng}, mounted in app/(rider)/_layout.tsx. Runs whole time signed in, throttled 10s, refreshes on foreground. Backend PATCH /riders/me already supported lat/lng.

## Technician contact + own ETA (mobile job screen)
- Customer row: added Text (SMS) button next to Call → opens native Messages app via sms: deep link to customer phone. Works even if customer never opened the tracking link.
- En-route ETA card: tech now sees their OWN live ETA prominently (Clock icon, "X min away", arrival clock time, distance in km). "Text ETA" button one-taps an SMS prefilled with "I'm on the way, ~X min out (arriving ~H:MM)".
- Backend: added bookings.etaDistanceKm column (db:push applied). tracking ping handler now stores eta.distanceKm alongside etaMins. GET /bookings/:id returns it via enrich().
- Note: large ETA numbers (e.g. 1241 min) in demo = real distance between device GPS and Winnipeg seed coords, not a bug. Re-seed jobs near tester location to show realistic ETAs.
