import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, tx } from "../middleware/auth";

function distKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

const AVG_KMH = 32; // urban average

export const aiRoutes = new Hono()
  // suggest the best technician for a work order (nearest + skill match + availability)
  .post("/suggest-tech/:bookingId", requireAuth, async (c) => {
    const t = tx(c);
    const b = await t.selectOne(schema.bookings, eq(schema.bookings.id, c.req.param("bookingId")));
    if (!b) return c.json({ message: "Not found" }, 404);
    const svc = await t.selectOne(schema.services, eq(schema.services.id, b.serviceId));
    const techs = await t.select(schema.riders);

    // beyond this we don't trust the location data enough to recommend on distance
    const MAX_SERVICE_RADIUS_KM = 150;
    const bookingHasLoc = b.lat != null && b.lng != null;

    const scored = await Promise.all(
      techs.map(async (t) => {
        const [tu] = await db
          .select()
          .from(schema.user)
          .where(eq(schema.user.id, t.userId));
        const techHasLoc = t.lat != null && t.lng != null;
        const hasLoc = techHasLoc && bookingHasLoc;
        const rawKm = hasLoc ? distKm(t.lat!, t.lng!, b.lat, b.lng) : null;
        // location is unknown OR implausibly far -> don't surface a bogus distance
        const km =
          rawKm != null && rawKm <= MAX_SERVICE_RADIUS_KM ? rawKm : null;
        const skillMatch =
          svc &&
          t.skills.toLowerCase().includes(svc.category.toLowerCase().split(" ")[0]);
        const avail = t.status === "available";
        // lower score is better. unknown location is penalised, not faked as 999.
        let score = km ?? 80; // neutral mid penalty when distance is unknown
        if (!skillMatch) score += 30;
        if (!avail) score += 50;
        if (t.status === "offline") score += 200;
        return {
          techId: t.id,
          name: tu?.name,
          skillClass: t.skillClass,
          status: t.status,
          color: t.color,
          distanceKm: km != null ? +km.toFixed(1) : null,
          etaMins: km != null ? Math.round((km / AVG_KMH) * 60) : null,
          locationKnown: hasLoc,
          skillMatch: !!skillMatch,
          available: avail,
          score: +score.toFixed(1),
        };
      }),
    );
    scored.sort((a, b2) => a.score - b2.score);
    const best = scored[0] ?? null;

    // human-readable reasoning that never confidently asserts a bad distance
    let reasoning: string | null = null;
    if (best) {
      const parts: string[] = [];
      if (best.distanceKm != null) {
        parts.push(`${best.name} is ${best.distanceKm} km away (~${best.etaMins} min)`);
      } else {
        parts.push(`${best.name} is the strongest match`);
      }
      if (best.skillMatch) parts.push(`matches ${best.skillClass} skill`);
      parts.push(best.available ? "available now" : "currently busy");
      reasoning = parts.join(", ") + ".";
      if (best.distanceKm == null) {
        reasoning +=
          " Location data is unavailable, so this is based on skill and availability only.";
      }
    }

    return c.json(
      {
        best,
        ranked: scored.slice(0, 5),
        // signals the UI can use to soften/withhold the recommendation
        confident: !!best && best.available && best.skillMatch,
        locationAvailable: bookingHasLoc && scored.some((s) => s.locationKnown),
        reasoning,
      },
      200,
    );
  })
  // optimize the route/sequence for a technician's assigned stops (nearest-neighbour)
  .get("/optimize-route/:techId", requireAuth, async (c) => {
    const techId = c.req.param("techId");
    const tdb = tx(c);
    const t = await tdb.selectOne(schema.riders, eq(schema.riders.id, techId));
    if (!t) return c.json({ message: "Not found" }, 404);
    const stops = await tdb.select(
      schema.bookings,
      and(
        eq(schema.bookings.riderId, techId),
        inArray(schema.bookings.status, ["assigned", "enroute"]),
      ),
    );

    // nearest-neighbour ordering from tech's current position
    let curLat = t.lat ?? 43.6532;
    let curLng = t.lng ?? -79.3832;
    const remaining = [...stops];
    const ordered: any[] = [];
    let totalKm = 0;
    while (remaining.length) {
      let bestI = 0;
      let bestD = Infinity;
      remaining.forEach((s, i) => {
        const d = distKm(curLat, curLng, s.lat, s.lng);
        if (d < bestD) {
          bestD = d;
          bestI = i;
        }
      });
      const next = remaining.splice(bestI, 1)[0];
      totalKm += bestD;
      ordered.push({
        id: next.id,
        title: next.title,
        address: next.address,
        legKm: +bestD.toFixed(1),
        legMins: Math.round((bestD / AVG_KMH) * 60),
      });
      curLat = next.lat;
      curLng = next.lng;
    }
    // naive original distance (in given order)
    let origKm = 0;
    let pLat = t.lat ?? 43.6532;
    let pLng = t.lng ?? -79.3832;
    for (const s of stops) {
      origKm += distKm(pLat, pLng, s.lat, s.lng);
      pLat = s.lat;
      pLng = s.lng;
    }
    const savedKm = +(origKm - totalKm).toFixed(1);
    return c.json(
      {
        stops: ordered,
        totalKm: +totalKm.toFixed(1),
        totalMins: Math.round((totalKm / AVG_KMH) * 60),
        savedKm: Math.max(0, savedKm),
        savedMins: Math.max(0, Math.round((savedKm / AVG_KMH) * 60)),
      },
      200,
    );
  });
