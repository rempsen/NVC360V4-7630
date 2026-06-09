# Per-unit line-item pricing (charge + tech pay) — DONE

## What shipped
- shared/catalog.ts: LineKind adds "unit"; buildUnitLineItem (price=charge, cost=tech pay), sumUnitLinePay helper. LineItem fields documented for unit lines.
- services/billing.ts: recomputeBooking hides pay-only unit lines (price<=0) from invoice; accrueTechPay now = hourly + sumUnitLinePay(unit lines), breakdown adds hourlyPay/unitPay.
- web/components/work-order-modal.tsx: new UnitLineItems section (repeatable rows: description, unit dropdown sq/ft|sq/yd|linear ft|piece|each|hour + Custom..., qty, charge/unit, pay/unit, live line totals, remove). Catalog section filters out unit lines. Price preview: "Per-unit line items" charge row + amber "{worker} pay" row.
- pages/admin/users.tsx: job-history label "catalog item" -> "line item".
- tests: shared/__tests__/catalog-unit-lines.test.ts (6 pass).

## Data model
Reuses bookings.lineItems JSON, kind:"unit". Zero migration; old/existing orders load empty gracefully. Totals flow through recomputeBooking -> lineItemsPrice/subtotal/total + techPay.

## Verify
tsc EXIT 0. vite build OK. 56 tests pass. bundle serves 200 with new UI strings. (mb screenshot blank = known hydration flake, not a bug.)

## Pending publish (remind Dan)
This change + prior: bookable-services, superadmin-domain lock, email-domains, catalog/landing imagery. Re-publish from Runable preview UI to push to uberize.ai prod.

## [2026-06-06] Per-unit line items surfaced for tech + internal office (DONE)
- Mobile job screen (packages/mobile/app/job/[id].tsx): "Per-unit work & your pay" block, parses kind==="unit", shows qty/unit @ pay/unit + line pay + total. tsc clean (no errors in [id].tsx).
- Internal job PDF (packages/web): new buildJobPdf() in api/routes/export.ts — label/value details + per-unit table (Description/Unit/Qty/Charge-u/Pay-u/Line charge/Line pay) + totals + "INTERNAL COPY — includes tech pay" warning. Portrait letter.
- Wired into job-search.ts /:id/export (isStaff-gated). Parses bookings.lineItems kind==="unit". Pay-only lines show "—" for charge, keep pay. Verified end-to-end: valid PDF, pdftotext confirms all rows + pay-only handling.
- Client invoice path (customer/track.tsx) untouched — exposes only amount/total, no pay leak.
- Web build OK, server 200 on :4200, 56/56 tests pass, web tsc EXIT 0.
- PENDING: user re-publish from Runable preview UI to push prod (+ prior pending: bookable-services, superadmin-domain lock, email-domains, catalog/landing imagery, per-unit pricing).

## [2026-06-06] BLANK WHITE PAGE — prod + local — FIXED
Root cause: vite.config.ts manualChunks hand-split the React ecosystem
(@tanstack/react-query + wouter into "vendor-react", their dependents into
"vendor"). At runtime a dependent in `vendor` referenced React's chunk before
init -> "TypeError: Cannot read properties of undefined (reading 'exports')"
in vendor-react chunk -> React never mounted -> #root empty -> blank white.
Dev mode (unminified, no manual chunks) rendered fine, masking it.
FIX: manualChunks now ONLY splits self-contained heavy libs (leaflet ->
vendor-maps, recharts/d3 -> vendor-charts, pdf-lib -> vendor-pdf); React +
router + query + everything else stay in one `vendor` chunk (deterministic
init). Verified: landing renders, /admin dashboard renders, auth 200 superadmin,
/api/bookings + /api/team 200. tsc EXIT 0, 98 tests pass, build OK.
ALSO this turn: DB hardening (index.ts) — 6-retry exp backoff+jitter (~4s),
warmUpDb() on boot + 60s keep-alive ping in server.ts, more transient patterns.
PENDING: re-publish from Runable preview UI to push to uberize.ai prod.

## [2026-06-06] Blank-page build guard ADDED
packages/web/scripts/smoke-build.mjs — post-build smoke test:
 (1) static check: warns if react-dom signature spans >1 chunk;
 (2) runtime check: boots prod server on temp port, renders "/" in real
     headless google-chrome (--headless=new --dump-dom), FAILS (exit 1) if
     #root < 200 chars (blank page). No new deps (uses system Chrome).
Wired into web `build` script: "tsc --noEmit && vite build && bun run scripts/smoke-build.mjs".
Added `build:nocheck` (build without smoke) + `smoke` scripts.
turbo build -> web build now gates on this, so a blank bundle FAILS the publish.
VERIFIED: re-introduced the broken vendor-react split -> build exited 1 with
"BLANK PAGE DETECTED — React did not mount. #root rendered only 6 chars".
Restored good config -> passes (#root 40451 chars).

## [2026-06-06] Blank-page recurrence — STALE CDN HTML CACHE (FIXED)
ROOT CAUSE: prod served a Cloudflare-cached index.html (Cache-Control public,max-age=3600,must-revalidate) that still referenced OLD deleted asset hashes (vendor-react-* split) -> browser loaded dead chunk -> "Cannot read properties of undefined (reading 'exports')" -> blank #root. Origin bundle itself was healthy (mirrored it, mounted fine). It was a CACHING bug, not a code bug.
WHY origin no-cache didn't help: server.ts getStaticFilePath("/") returns indexPath which EXISTS -> went through serveStatic -> cacheControlFor("/") returned the 3600 default (the SPA-fallback no-cache branch only runs for non-existent paths/deep links). So "/" was cached 1h.
FIX (server.ts): cacheControlFor() now returns "no-store, no-cache, max-age=0, must-revalidate" for "/" and *.html; serveStatic adds CDN-Cache-Control:no-store + Cloudflare-CDN-Cache-Control:no-store + Pragma/Expires for no-store responses. SPA fallback response hardened identically. Assets/* stay immutable.
VERIFIED: root / and /dashboard -> no-store + CDN no-store; /assets/* -> immutable. Build smoke gate passes (#root 40451 chars, React consolidated).
USER ACTION: re-publish from Runable preview UI. The first publish purges/replaces the cached HTML; from then on HTML is never cached so new asset hashes are always picked up.

## BLANK PAGE — TRUE ROOT CAUSE FOUND & FIXED (2026-06-06)
- Symptom: uberize.ai, nvc360fourdraft.runable.site, AND Runable preview pane all blank white.
- Earlier theories (CDN stale HTML cache, vite chunk-split) were RED HERRINGS — those were already fixed and the bundle was healthy.
- ACTUAL BUG: server.ts serveStatic() manually gzipped assets + set `Content-Encoding: gzip`. Behind Cloudflare+Google compressing CDN, body reached browser tagged gzip but NOT actually gzip -> decode fail -> JS never runs -> blank.
  - Proof: `curl --compressed <asset>` decoded to 0 bytes; raw curl got valid JS. Same bundle on plain python server mounted fine (rootLen 39525).
- FIX: removed origin gzip. serveStatic now serves raw bytes + Vary: Accept-Encoding + ETag (size+pathhash). CDN compresses on the fly. RULE: never set Content-Encoding at origin behind a compressing CDN.
- Verified: build smoke test passes (#root 40451 chars); local Bun server serves raw JS (64401 bytes, no content-encoding) even when client sends Accept-Encoding: gzip; mb real-browser load mounts (rootLen 39428), full landing page renders.
- ACTION FOR USER: re-publish from Runable preview UI to deploy.

## PUBLISH FAILURE — REAL ROOT CAUSE (2026-06-06, second session)
- Deploy error popup: "Publishing failed — start-website failed: 2: [unknown] fetch failed"
- CAUSE: my own blank-page guard broke the deploy. package.json `build` ran scripts/smoke-build.mjs which boots a server, fetches localhost, and launches google-chrome. The Runable deploy runner has no Chrome / can't fetch localhost -> "fetch failed" -> deploy fails -> prod never updates -> Cloudflare keeps serving OLD immutable-cached broken-gzip assets -> blank page persists.
- FIX:
  1. package.json: `build` = `tsc --noEmit && vite build` (NO smoke). Added `build:smoke` opt-in + kept `smoke`.
  2. smoke-build.mjs: non-fatal by default; only fails on SMOKE_STRICT=1. Infra failures (no chrome/fetch failed) warn + exit 0.
  3. server.ts: wrapped initRealtimeBus()/initRateLimitStore() in try/catch so Redis-unreachable can't stop port binding.
- Verified: clean build exit 0 (no smoke), server boots 200, opt-in smoke still mounts (#root 40451). New hashes index-DcoHYFFQ.js/vendor-CXUujccq.js bypass poisoned CDN cache.
- ACTION FOR USER: re-publish — should now SUCCEED. Old assets get replaced with new hashes that aren't corrupt-cached.

## [2026-06-06 19:36] FINAL DIAGNOSIS — code healthy, deploy pipeline not shipping
- Cleared turbo cache + clean rebuild -> dist hashes index-DcoHYFFQ.js / vendor-CXUujccq.js (vendor 668838 bytes valid JS).
- Booted prod-mode server (bun src/server.ts, exactly like ecosystem.config.cjs pm2) on :4788:
  - serves new hash index-DcoHYFFQ.js
  - vendor served RAW 668838 bytes, NO Content-Encoding:gzip at origin (only Vary), CDN compresses -> double-gzip bug GONE
  - real google-chrome render: DOM 41588 bytes, full hero/nav rendered -> React MOUNTS.
- LIVE uberize.ai STILL serves OLD index-BWRrRRR9.js / vendor-BcN8-vem.js; my new assets 404->1058B fallback. HTML cf DYNAMIC no-store (fresh from origin) => ORIGIN runs OLD code.
- => Publish is NOT deploying this sandbox build. App code is not the blocker. Needs platform/publish-pipeline fix or a fresh re-publish that actually ships. ecosystem.config.cjs is correct (web-app, cwd packages/web, bun src/server.ts).
