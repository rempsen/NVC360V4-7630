# Geofence auto-arrive + Start Driving SMS

## Requirements
1. Start Driving (enroute) → push SMS to customer. (Already fires via dispatch enroute rule → confirm/ensure.)
2. Remove manual "I've arrived" + "Start job" buttons → driven by geo-locator.
   - Radius adjustable in settings, default 20m from job address.
   - Within radius → auto-arrive (status=arrived → in_progress = start of job/clock).
   - Leaves >radius → STOP the time clock (pause). Re-enter → resume.
   - Job complete = manual "Job Complete" button only.

## Design decisions
- "Start of job" = clock start. Map to existing in_progress (startedAt). Geofence entry sets arrived+in_progress in one go (auto). On-site minutes already computed startedAt->finishedAt, but with pause we need ACCUMULATED on-site time, not raw span.
- Need pause/resume: add `clockState` ('running'|'paused'), `accumulatedMs`, `lastResumeAt` to bookings. On geofence exit → pause (add elapsed to accumulated). On re-entry → resume. On complete → finalize onSiteMinutes from accumulatedMs.
- Geofence radius: add `geofenceRadiusM` to companySettings (default 20).
- Server endpoint `/tracking/:bookingId/ping` already gets lat/lng + dest (b.lat/b.lng). Do geofence eval server-side (authoritative) inside ping handler. Mobile keeps pinging every 15s while active (enroute/arrived/in_progress).
- Mobile: ping loop must run for enroute AND arrived AND in_progress (currently only enroute). FLOW: assigned->Start driving; then hide arrived/start buttons; in_progress/arrived just show status + "Job Complete".

## Files
- schema.ts: companySettings.geofenceRadiusM; bookings.clockState/accumulatedMs/lastResumeAt
- tracking.ts: geofence eval -> auto arrived/in_progress + pause/resume clock
- bookings.ts: enroute SMS confirm; completion uses accumulatedMs for onSiteMinutes
- mobile job/[id].tsx: FLOW change, ping loop for all active states, UI
- web settings page: radius input
- DB raw migration for new columns

## Status: COMPLETE ✅
- schema: companySettings.geofenceRadiusM(20); bookings.clockState/accumulatedMs/lastResumeAt/insideGeofence — migrated to Turso ✅
- services/booking-status.ts: applyBookingStatus + pauseClock/resumeClock/liveOnSiteMinutes ✅
- bookings.ts status endpoint refactored to use shared helper ✅
- tracking.ts ping handler: geofence eval -> auto-arrive / pause / resume ✅
- settings.ts allowlist + web settings UI radius field ✅
- mobile FLOW (only Start driving + Job Complete), ping loop all active states, clock card UI ✅
- E2E test passed: enroute->arrive<20m(auto)->leave(pause)->return(resume)->complete. on-site time excludes away period; mileage tracked whole drive ✅
- enroute->client SMS rule confirmed live (Start Driving texts customer) ✅
- web tsc exit 0, mobile own-source 0 errors ✅
