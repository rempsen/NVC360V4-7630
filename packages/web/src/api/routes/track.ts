import { Hono } from "hono";
import { db } from "../database";
import { tdb } from "../database/tenant";
import * as schema from "../database/schema";
import { eq } from "drizzle-orm";
import { sendSms, trackingUrl } from "../../services/sms";
import { computeRoute } from "./geo";
import { trackLimiter } from "../lib/rate-limit";
import { streamSSE } from "hono/streaming";
import { subscribeTrack } from "../../services/realtime";

// Resolve a booking by its public token, enforcing expiry. Returns null when
// the token is unknown OR has expired (PII link safety).
async function resolveByToken(token: string) {
  const [b] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.publicToken, token));
  if (!b) return null;
  if (b.tokenExpiresAt && b.tokenExpiresAt < Date.now()) return null;
  return b;
}

// road-route cache so the 2.5s public poll never hammers Google Directions.
// recompute at most once per ~12s per booking (driver hasn't moved far in that).
const ROUTE_TTL_MS = 12_000;
const routeCache = new Map<
  string,
  { at: number; oLat: number; oLng: number; route: Awaited<ReturnType<typeof computeRoute>> }
>();

async function cachedRoute(
  bookingId: string,
  oLat: number,
  oLng: number,
  dLat: number,
  dLng: number,
) {
  const now = Date.now();
  const c = routeCache.get(bookingId);
  // reuse cache unless it's stale OR the driver moved >120m since last route
  if (c) {
    const moved =
      Math.abs(c.oLat - oLat) > 0.0011 || Math.abs(c.oLng - oLng) > 0.0011;
    if (now - c.at < ROUTE_TTL_MS && !moved) return c.route;
  }
  const route = await computeRoute(oLat, oLng, dLat, dLng);
  routeCache.set(bookingId, { at: now, oLat, oLng, route });
  return route;
}

/** Build the full public tracking snapshot for a booking row. */
async function buildSnapshot(b: typeof schema.bookings.$inferSelect) {
  const t = tdb(b.companyId);
  const svc = await t.selectOne(schema.services, eq(schema.services.id, b.serviceId));

  // Company (tenant) contact info — shown on the public page so a client can
  // reach the company directly, especially once the job is complete and the
  // live map is no longer relevant.
  const [co] = await db
    .select()
    .from(schema.companies)
    .where(eq(schema.companies.id, b.companyId));
  // tenant settings carry brand vocabulary (what they call their field worker)
  const cs = await t.selectOne(schema.companySettings);
  const workerNoun = cs?.workerNoun || "Technician";
  const company = co
    ? { name: co.name, email: co.contactEmail || "", phone: co.phone || "" }
    : null;

  let tech: any = null;
  if (b.riderId) {
    const r = await t.selectOne(schema.riders, eq(schema.riders.id, b.riderId));
    if (r) {
      const [ru] = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, r.userId));
      tech = {
        name: ru?.name,
        phone: r.phone || ru?.phone || "",
        vehicle: r.vehicle,
        rating: r.rating,
        skillClass: r.skillClass,
        color: r.color,
        photoUrl: r.photoUrl,
        lat: r.lat,
        lng: r.lng,
      };
    }
  }

  const latestRows = await t.select(
    schema.trackingPings,
    eq(schema.trackingPings.bookingId, b.id),
  );
  latestRows.sort((a, z) => Number(z.createdAt) - Number(a.createdAt));
  const latest = latestRows[0];

  const techLocation = latest
    ? { lat: latest.lat, lng: latest.lng }
    : tech?.lat
      ? { lat: tech.lat, lng: tech.lng }
      : null;

  let route: { lat: number; lng: number }[] | null = null;
  let etaMins = b.etaMins;
  let etaDistanceKm = b.etaDistanceKm ?? null;
  if (
    techLocation &&
    ["assigned", "enroute"].includes(b.status) &&
    b.lat != null &&
    b.lng != null
  ) {
    const r = await cachedRoute(b.id, techLocation.lat, techLocation.lng, b.lat, b.lng);
    if (r) {
      route = r.path.map(([lat, lng]) => ({ lat, lng }));
      etaMins = r.etaMins;
      etaDistanceKm = r.distanceKm;
    }
  }

  return {
    id: b.id,
    token: b.publicToken,
    title: b.title || svc?.name || "Service",
    status: b.status,
    etaMins,
    etaDistanceKm,
    service: svc ? { name: svc.name, icon: svc.icon } : null,
    company,
    workerNoun,
    destination: { lat: b.lat, lng: b.lng, address: b.address },
    tech,
    techLocation,
    route,
  };
}

/**
 * PUBLIC tracking — accessed via SMS link /t/:token, no auth required.
 * Exposes only what a client needs to track + contact their technician.
 */
export const trackRoutes = new Hono()
  // public live tracking by token (snapshot — also used as SSE fallback)
  .get("/:token", trackLimiter, async (c) => {
    const token = c.req.param("token");
    const b = await resolveByToken(token);
    if (!b) return c.json({ message: "Not found" }, 404);
    return c.json(await buildSnapshot(b), 200);
  })
  // SSE live stream — pushes a fresh snapshot on every driver ping / status
  // change instead of the client polling every 2.5s. Falls back gracefully:
  // clients that can't hold the stream still have GET /:token.
  .get("/:token/stream", async (c) => {
    const token = c.req.param("token");
    const b = await resolveByToken(token);
    if (!b) return c.json({ message: "Not found" }, 404);

    return streamSSE(c, async (stream) => {
      // initial snapshot immediately so the map paints without waiting
      const snap = await buildSnapshot(b);
      await stream.writeSSE({ event: "snapshot", data: JSON.stringify(snap) });

      // All socket writes happen on this main async loop. Hono's streamSSE does
      // not reliably flush writes issued from a detached setInterval while the
      // generator is parked, so the realtime callback only flips a dirty flag
      // and the loop drains it on its next tick.
      let closed = false;
      let dirty = false;
      const unsub = subscribeTrack(token, () => {
        dirty = true; // coalesced: only the newest snapshot matters
      });
      stream.onAbort(() => {
        closed = true;
        unsub();
      });

      const TICK_MS = 1_000;
      const PING_EVERY = 20; // ticks → 20s heartbeat
      let sinceData = 0;
      while (!closed) {
        await stream.sleep(TICK_MS);
        if (closed) break;
        if (dirty) {
          dirty = false;
          const fresh = await resolveByToken(token);
          if (fresh) {
            const s = await buildSnapshot(fresh);
            await stream.writeSSE({ event: "snapshot", data: JSON.stringify(s) });
            sinceData = 0;
            continue;
          }
        }
        if (++sinceData >= PING_EVERY) {
          sinceData = 0;
          await stream.writeSSE({ event: "ping", data: "1" });
        }
      }
    });
  })
  // public message thread for a tracked work order
  .get("/:token/messages", trackLimiter, async (c) => {
    const token = c.req.param("token");
    const b = await resolveByToken(token);
    if (!b) return c.json({ message: "Not found" }, 404);
    const rows = await tdb(b.companyId).select(
      schema.messages,
      eq(schema.messages.bookingId, b.id),
    );
    rows.sort((a, z) => Number(a.createdAt) - Number(z.createdAt));
    return c.json({ messages: rows }, 200);
  })
  // client posts a message from the public tracking page
  .post("/:token/messages", trackLimiter, async (c) => {
    const token = c.req.param("token");
    const { body, senderName } = await c.req.json();
    const b = await resolveByToken(token);
    if (!b) return c.json({ message: "Not found" }, 404);
    const t = tdb(b.companyId);
    const [m] = await t.insert(schema.messages, {
      bookingId: b.id,
      senderRole: "client",
      senderName: senderName || "Client",
      body,
      channel: "app",
    });
    // in-app notify + text the assigned technician so they get a real SMS
    if (b.riderId) {
      const r = await t.selectOne(schema.riders, eq(schema.riders.id, b.riderId));
      if (r) {
        await t.insert(schema.notifications, {
          userId: r.userId,
          bookingId: b.id,
          type: "reminder",
          title: "New message from client",
          body,
        });
        // forward to the tech as an SMS with a link back to the live thread
        const [ru] = await db
          .select()
          .from(schema.user)
          .where(eq(schema.user.id, r.userId));
        const techPhone = r.phone || ru?.phone || "";
        if (techPhone && b.publicToken) {
          const who = m.senderName || "Customer";
          await sendSms(
            techPhone,
            `NVC360: Message from ${who}: "${body}" — Reply: ${trackingUrl(b.publicToken)}`,
          ).catch(() => {});
        }
      }
    }
    return c.json({ message: m }, 201);
  });
