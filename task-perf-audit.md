# Perf & Quality Audit — uberize.ai (homeserve)

## Findings (measured 2026-06-06)
| Issue | Evidence | Impact | Severity |
|---|---|---|---|
| Single JS bundle, no code-split | dist/assets/index-*.js = **2.24 MB** | Whole app downloads before first paint | CRITICAL |
| No gzip/brotli | `Accept-Encoding: gzip` returns full 2.24MB | 4–5x more bytes over wire | CRITICAL |
| No cache headers on hashed assets | `new Response(file)` | Repeat visits re-download all | HIGH |
| API latency 120–460ms | /api/health=460ms, /api/services=118ms | Sluggish interactions | HIGH |
| No route lazy-loading | 70 page .tsx all eager-imported | ↑ bundle, ↑ parse time | HIGH |

## Fix plan
1. **Static serving**: add Cache-Control (immutable for /assets, hashed), gzip/brotli via Bun (precompress at build or on-the-fly). [server.ts]
2. **Code-split**: React.lazy + Suspense on heavy route groups (admin/*, customer, rider) + manualChunks vendor split. [app.tsx, admin/index.tsx, vite.config]
3. **API**: profile /api/health (why 460ms?), check Turso client reuse, add caching where safe.
4. Verify: rebuild, re-measure bytes/timings, screenshot.

## Status: AUDIT DONE → fixing
