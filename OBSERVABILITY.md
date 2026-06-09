# Observability — Metrics, Analytics, Uptime & SLOs

This is the plain-English guide to "running the business on numbers" for
uberize.ai. Everything here is **already built and live in the app** — most of
it is a no-op until you flip on a key, so it's safe in production today.

There are three things:

1. **Metrics** — how fast/healthy the app is (latency, error rate, traffic).
2. **Product analytics** — business events (bookings created, invoices paid).
3. **Uptime + SLOs** — is the site up, and are we hitting our reliability bar.

---

## 1. Metrics — built in, no setup needed

The app exposes its own metrics at two endpoints. No external service required
to *see* them.

| Endpoint | Format | Use it for |
|---|---|---|
| `https://uberize.ai/api/metrics` | Prometheus text | Plugging into Grafana / Datadog / any monitoring backend (the industry standard) |
| `https://uberize.ai/api/metrics.json` | JSON | Eyeballing in a browser right now |

### What you'll see
Open `https://uberize.ai/api/metrics.json` and you get a live snapshot:

```json
{
  "uptime_s": 3600,
  "requests_total": 12840,
  "errors_5xx_total": 3,
  "error_rate": 0.0002,
  "latency_ms": { "avg": 41, "p50": 28, "p95": 120, "p99": 240 },
  "counters": {
    "bookings_created_total": 57,
    "dispatch_assigned_total": 41,
    "invoices_paid_total": 33,
    "revenue_paid_cents_total": 412900
  },
  "routes": [ { "route": "/api/bookings/:id", "p95_ms": 90, ... } ]
}
```

Plain English:
- **error_rate** — fraction of requests that failed with a server error (5xx).
  `0.0002` = 0.02%. You want this near zero.
- **p95 latency** — 95% of requests finished faster than this many ms. The
  number to watch; averages hide the slow tail.
- **counters** — running business totals (bookings, dispatches, paid invoices,
  and total paid revenue in cents).
- **routes** — same stats broken down per API route, so you can spot the one
  slow endpoint.

### Securing the endpoint (optional)
By default `/api/metrics` is open (fine — it contains no customer PII, just
aggregate numbers). To lock it down, set an env var `METRICS_TOKEN` to any
secret string and republish. Then scrapers must send
`Authorization: Bearer <that-token>`. Without the right token they get a 401.

### Cardinality note (why this stays cheap)
Paths are collapsed to *templates* — `/api/bookings/abc-123` becomes
`/api/bookings/:id`. This keeps the metric count small so a monitoring backend
never gets overwhelmed, no matter how much traffic you get.

---

## 2. Product analytics (PostHog) — flip on when ready

The app captures key **business events** server-side. This is built but
**dormant until you give it a key** — no data leaves the server until then.

Events captured:
- `booking.created` (with source: customer vs admin)
- `dispatch.assigned`
- `invoice.paid` (with amount + currency)
- `user.signed_in` (wire-ready)

### To turn it on
1. Create a free account at **https://posthog.com** (generous free tier).
2. In PostHog: **Project Settings → Project API Key**. Copy it (looks like
   `phc_xxxxxxxx`).
3. Add these env vars to the app and republish:
   - `POSTHOG_KEY` = your `phc_...` key
   - `POSTHOG_HOST` = `https://us.i.posthog.com` (US) or `https://eu.i.posthog.com` (EU) — match your PostHog region
4. That's it. Events start flowing. Build funnels/dashboards in PostHog (e.g.
   "booking created → invoice paid" conversion).

No PII is sent — only ids and amounts. The "distinct id" we send is your
company id, so analytics are naturally grouped per tenant.

---

## 3. Uptime monitoring + alerts

The app has two health probes built in:

| Endpoint | Checks | Use for |
|---|---|---|
| `https://uberize.ai/api/health` | Process is alive (instant) | Fast, cheap uptime ping |
| `https://uberize.ai/api/ready` | DB + storage + Redis all reachable | Deep "is everything wired" check |

`/api/ready` returns HTTP **200** when healthy and **503** when any dependency
is down — exactly what an uptime monitor needs.

### Recommended: UptimeRobot or BetterStack (both have free tiers)

**Setup (UptimeRobot — easiest):**
1. Sign up at https://uptimerobot.com.
2. **Add New Monitor** → type **HTTP(s)**.
3. URL: `https://uberize.ai/api/ready`
4. Monitoring interval: **1 minute** (or 5 on free tier).
5. Under **Advanced**, set "alert if status code is NOT 200" (so a 503 fires).
6. Add an alert contact (your email / SMS / Slack).
7. Save. Repeat with `https://uberize.ai/api/health` for a lighter second check.

**BetterStack** is similar and adds a public status page if you want customers
to see uptime.

---

## 4. SLO targets (start here, tighten over time)

An SLO is just "the reliability bar we hold ourselves to." Sensible starting
targets for a field-service SaaS:

| SLI (what we measure) | SLO (target) | Where to read it |
|---|---|---|
| **Availability** (`/api/ready` returns 200) | **99.9%** monthly (~43 min/mo downtime budget) | UptimeRobot dashboard |
| **API latency** (p95) | **< 300 ms** | `/api/metrics.json` → `latency_ms.p95` |
| **Error rate** (5xx) | **< 0.1%** of requests | `/api/metrics.json` → `error_rate` |
| **Payment success** | **> 98%** of payment attempts succeed | PostHog `invoice.paid` vs attempts |

### Alert thresholds (when to get paged)
- **Availability:** alert immediately on any `/api/ready` 503.
- **Latency:** alert if p95 > 500 ms sustained for 10 min.
- **Error rate:** alert if 5xx rate > 1% over a 5-min window.

Set these in whatever backend scrapes `/api/metrics` (Grafana alerting rules),
plus the UptimeRobot availability alert above.

---

## TL;DR — what to do now vs later

**Now (zero setup):**
- Visit `https://uberize.ai/api/metrics.json` anytime to see live health.
- Set up an UptimeRobot monitor on `/api/ready` (5 min, free) for downtime alerts.

**When you're ready (5 min each):**
- Turn on PostHog: set `POSTHOG_KEY` + `POSTHOG_HOST`, republish.
- Plug `/api/metrics` into Grafana/Datadog for dashboards + latency/error alerts.
- Optionally set `METRICS_TOKEN` to lock the metrics endpoint.

Everything above ships in the codebase today. Republish from the Runable
preview UI after adding any env var for it to take effect on uberize.ai.
