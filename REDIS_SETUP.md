# Redis Setup — Step by Step

You created a Redis Cloud database called **database-MPYMD3ZZ**. 
Now we need to (A) get its connection link, and (B) paste that link into your
hosting platform so the live app can use it.

---

## What Redis actually does for you

Right now your app runs fine on ONE server. Redis lets you run on MULTIPLE
servers at once without things breaking (live updates, rate limits, etc. stay
in sync across all of them). Until you set the connection link, the app simply
ignores Redis and works normally on a single server. So this is a "scaling
unlock," not a fix for anything broken.

---

## PART A — Get your connection link (the `rediss://...` URL)

You're on the database page now. Do this:

1. On that page, find the blue **"Connect"** button (bottom, next to
   *"Connect using Redis CLI, Client, or Insight"*). Click it.

2. A panel opens with connection options. Click the tab/option for
   **"Redis Client"** (sometimes labeled "RedisInsight" or shows code snippets).

3. Look for the **connection string / URL**. It looks like one of these:
   ```
   redis://default:SOMEPASSWORD@cook-camera-industry-93833.db.redis.io:13788
   ```
   - `default` = the username (Redis Cloud uses "default")
   - `SOMEPASSWORD` = your database password (a long random string)
   - the rest = your public endpoint (already visible on your page:
     `cook-camera-industry-93833.db.redis.io:13788`)

4. If you don't see the password in the string, you can grab it separately:
   - On the database page, scroll to the **Security** section
   - Find **"Default user password"** and click the eye / **Copy** icon
   - Then build the URL yourself in this exact shape:
     ```
     redis://default:PASTE_PASSWORD_HERE@cook-camera-industry-93833.db.redis.io:13788
     ```

5. **Copy that full URL.** Keep it private — it's like a password.

> Note on `redis://` vs `rediss://`:
> - `redis://` = normal connection
> - `rediss://` (two s's) = encrypted/TLS connection
> Use whichever Redis Cloud shows you. If they offer TLS, prefer `rediss://`.
> If unsure, copy exactly what their Connect panel gives you.

---

## PART B — Put the link into your hosting platform

Wherever your live app is hosted, find the **Environment Variables** settings
(also called "Config Vars", "Secrets", or "Environment"). Then:

1. Add a NEW variable:
   - **Name / Key:** `REDIS_URL`
   - **Value:** the full link you copied above
2. Save.
3. **Redeploy / restart** the app (most platforms ask you to redeploy for new
   env vars to take effect).

---

## PART C — Verify it worked

After redeploy, open this link in your browser (replace with your real domain):

```
https://YOUR_DOMAIN/api/ready
```

You want to see this in the response:

```
"redis":"ok","realtime":"redis"
```

- `"redis":"ok"` → the app connected to your Redis database. 
- `"realtime":"redis"` → live updates now run through Redis (multi-server ready).

If instead you see `"realtime":"memory"` or a redis error, the `REDIS_URL`
wasn't picked up — double-check the value has no extra spaces and that you
redeployed. Send me the response and I'll read it.

---

## Quick recap
1. Click **Connect** on the database page → copy the `redis://...` URL (with password).
2. In your host's **Environment Variables**, add `REDIS_URL` = that URL → save → redeploy.
3. Visit `https://YOUR_DOMAIN/api/ready` and confirm `"redis":"ok"`.

---

## Error Alerting (added 2026-06-04)

Per-tenant error-burst alerting is now wired into the global error handler. When
one company hits a wall of server errors (5xx / crashes), ops gets ONE alert —
debounced so you don't get spammed — by email and/or a Slack-style webhook.

**It's OFF until you set at least one channel.** Add these to your host's
Environment Variables (same place as `REDIS_URL`):

| Variable | What it does | Default |
|---|---|---|
| `ALERT_EMAIL` | Comma-separated ops recipients (e.g. `ops@nvc360.com`). Sends via Resend. | — (off) |
| `ALERT_WEBHOOK_URL` | Slack/Discord/PagerDuty incoming-webhook URL. Gets a `{ text, tenant, count, ctx }` payload. | — (off) |
| `ALERT_ERROR_THRESHOLD` | How many errors in the window before an alert fires. | `5` |
| `ALERT_WINDOW_MS` | Sliding window length (ms). | `60000` (1 min) |
| `ALERT_COOLDOWN_MS` | Min gap between alerts for the SAME tenant. | `900000` (15 min) |

Verify after deploy: the boot log line should read
`alerts: per-tenant error alerting ENABLED`. With Redis set, counting + de-dupe
are cluster-accurate (only one node sends each alert).

> Slack quick-start: in Slack create an Incoming Webhook, copy the
> `https://hooks.slack.com/services/...` URL into `ALERT_WEBHOOK_URL`.
