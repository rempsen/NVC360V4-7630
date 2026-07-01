import { drizzle } from "drizzle-orm/libsql";
import { createClient, type Client, type InValue } from "@libsql/client";
import * as schema from "./schema";

/**
 * Turso (libsql) over HTTP can drop its keep-alive socket, surfacing as
 * `ECONNRESET` / "socket connection was closed unexpectedly". A bare client has
 * no retry, so a single dropped socket turns into a 500 on every downstream
 * read (e.g. /api/auth/get-session), which intermittently strips the
 * superadmin role off the session and hides superadmin-only UI.
 *
 * This is especially visible right after a cold start (server restart / host
 * resume): the very first statements race the socket coming up.
 *
 * We wrap the client so transient connection errors are retried with an
 * exponential backoff + jitter. Retries are safe here: the failures we catch
 * happen at the transport layer before the statement is applied.
 */
const TRANSIENT = [
  "ECONNRESET",
  "socket connection was closed",
  "stream closed",
  "fetch failed",
  "Hrana",
  "WebSocket",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "EPIPE",
  "EAI_AGAIN", // transient DNS failure during cold start
  "Client network socket disconnected",
  "and 503", // libsql surfaces upstream 503s as "... and 503 ..."
  "502",
  "503",
  "504",
];

function isTransient(err: unknown): boolean {
  const msg =
    (err as { message?: string })?.message ??
    (err as { code?: string })?.code ??
    String(err);
  const code = String((err as any)?.code ?? "");
  return TRANSIENT.some((t) => msg.includes(t) || code.includes(t));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Exponential backoff with jitter. Total worst-case wait is roughly
 * 100 + 250 + 600 + 1200 + 2000 ≈ 4.15s across 5 retries — enough to ride out a
 * cold reconnect without ever surfacing a 500 to the user, while still failing
 * fast on a genuinely-down database.
 */
const BASE_DELAYS = [100, 250, 600, 1200, 2000];

function nextDelay(attempt: number): number {
  const base = BASE_DELAYS[Math.min(attempt, BASE_DELAYS.length - 1)];
  // +/- 25% jitter to avoid thundering-herd reconnects across nodes
  const jitter = base * 0.25 * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(base + jitter));
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const maxRetries = BASE_DELAYS.length; // 5 retries (6 total attempts)
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries && isTransient(err)) {
        const delay = nextDelay(attempt);
        console.warn(
          `[db] transient ${label} failure (attempt ${attempt + 1}/${maxRetries}); retrying in ${delay}ms`,
        );
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

const raw = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

/**
 * Proxy the libsql client so `execute` / `batch` transparently retry transient
 * transport failures. Everything else passes through untouched.
 */
const client = new Proxy(raw, {
  get(target, prop, receiver) {
    if (prop === "execute") {
      return (
        stmt:
          | string
          | { sql: string; args?: InValue[] | Record<string, InValue> },
        args?: InValue[] | Record<string, InValue>,
      ) =>
        withRetry(
          () =>
            (target.execute as (...a: unknown[]) => Promise<unknown>)(
              stmt,
              args,
            ),
          "execute",
        );
    }
    if (prop === "batch") {
      return (...a: unknown[]) =>
        withRetry(
          () => (target.batch as (...x: unknown[]) => Promise<unknown>)(...a),
          "batch",
        );
    }
    return Reflect.get(target, prop, receiver);
  },
}) as Client;

export const db = drizzle(client, { schema });

/**
 * Warm-up / liveness ping. Called on server boot so the very first real user
 * request never races a cold socket. Also reusable by the /ready probe.
 * Returns true if the DB answered, false otherwise (never throws).
 */
export async function pingDb(): Promise<boolean> {
  try {
    await client.execute("select 1");
    return true;
  } catch (err) {
    console.warn("[db] warm-up ping failed:", (err as Error)?.message ?? err);
    return false;
  }
}

/**
 * Boot-time warm-up: retry the ping a few times so a host-resume cold start
 * settles the connection before traffic arrives. Fire-and-forget from server.ts.
 */
export async function warmUpDb(): Promise<void> {
  for (let i = 0; i < 4; i++) {
    if (await pingDb()) {
      if (i > 0) console.log(`[db] connection warmed up after ${i + 1} tries`);
      return;
    }
    await sleep(nextDelay(i));
  }
  console.warn("[db] warm-up did not confirm a connection (will retry on first request)");
}
