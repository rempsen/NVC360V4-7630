/**
 * Shared Redis connection factory.
 *
 * Redis is OPTIONAL. With no REDIS_URL the app runs exactly as before on a
 * single node (in-memory bus + rate-limit store). Set REDIS_URL to unlock
 * multi-node: horizontal scaling, zero-downtime rolling deploys, and a shared
 * realtime fan-out + rate-limit window across every instance.
 *
 * We keep separate connections for different concerns because a Redis
 * connection in subscriber mode cannot issue normal commands:
 *   - getRedis()        → general commands (rate limiter, publishing)
 *   - getRedisSub()     → a dedicated SUBSCRIBE connection for the realtime bus
 */
import Redis, { type RedisOptions } from "ioredis";
import { log } from "./logger";

const URL = process.env.REDIS_URL;

export function redisEnabled(): boolean {
  return Boolean(URL);
}

const baseOpts: RedisOptions = {
  // Fail fast and keep retrying with backoff; never throw synchronously at call sites.
  maxRetriesPerRequest: 2,
  enableReadyCheck: true,
  retryStrategy: (times) => Math.min(times * 200, 5_000),
  lazyConnect: false,
};

let client: Redis | null = null;
let subscriber: Redis | null = null;

function instrument(conn: Redis, label: string): Redis {
  conn.on("ready", () => log.info(`redis ${label} ready`));
  conn.on("error", (e) => log.error(`redis ${label} error`, { err: e.message }));
  conn.on("close", () => log.warn(`redis ${label} connection closed`));
  return conn;
}

/** General-purpose connection (commands + PUBLISH). Null if Redis disabled. */
export function getRedis(): Redis | null {
  if (!URL) return null;
  if (!client) client = instrument(new Redis(URL, baseOpts), "client");
  return client;
}

/** Dedicated SUBSCRIBE connection for pub/sub. Null if Redis disabled. */
export function getRedisSub(): Redis | null {
  if (!URL) return null;
  if (!subscriber) subscriber = instrument(new Redis(URL, baseOpts), "subscriber");
  return subscriber;
}

/** Graceful shutdown — close both connections. */
export async function closeRedis(): Promise<void> {
  await Promise.allSettled([client?.quit(), subscriber?.quit()]);
  client = null;
  subscriber = null;
}
