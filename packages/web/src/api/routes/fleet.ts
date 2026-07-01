import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { requireAuth, requireAdmin, tx } from "../middleware/auth";
import { sendSms } from "../../services/sms";

type SessionUser = { id: string; role?: string; name: string };

const ACTIVE_STATUSES = ["assigned", "enroute", "arrived", "in_progress"];

export const fleetRoutes = new Hono()
  // full fleet snapshot for the live map: every tech + their current task
  .get("/", requireAuth, async (c) => {
    const t = tx(c);
    const techs = await t.select(schema.riders);
    const result = (await Promise.allSettled(
      techs.map(async (r) => {
        const [ru] = await db
          .select()
          .from(schema.user)
          .where(eq(schema.user.id, r.userId))
          .catch(() => [undefined]);
        // current active work order for this tech
        const activeAll = await t.select(
          schema.bookings,
          and(
            eq(schema.bookings.riderId, r.id),
            inArray(schema.bookings.status, ACTIVE_STATUSES),
          ),
        ).catch(() => []);
        activeAll.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
        const active = activeAll.slice(0, 1);
        let task: any = null;
        if (active[0]) {
          // guard: serviceId may be null if service was deleted
          const svc = active[0].serviceId
            ? await t.selectOne(schema.services, eq(schema.services.id, active[0].serviceId)).catch(() => null)
            : null;
          task = {
            id: active[0].id,
            title: active[0].title || svc?.name || "Job",
            status: active[0].status,
            address: active[0].address,
            priority: active[0].priority,
            etaMins: (active[0] as any).etaMins ?? null,
            destLat: active[0].lat,
            destLng: active[0].lng,
          };
        }
        return {
          id: r.id,
          userId: r.userId,
          name: ru?.name ?? "Technician",
          phone: r.phone || ru?.phone || "",
          vehicle: r.vehicle,
          skillClass: r.skillClass,
          color: r.color,
          photoUrl: r.photoUrl,
          status: r.status,
          rating: r.rating,
          completedJobs: r.completedJobs,
          lat: r.lat,
          lng: r.lng,
          locationUpdatedAt: r.locationUpdatedAt,
          task,
        };
      }),
    )).filter((s) => s.status === "fulfilled").map((s) => (s as PromiseFulfilledResult<any>).value);
    return c.json({ fleet: result }, 200);
  })
  // unassigned / pending work orders (for dispatch + auto-assign)
  .get("/pending", requireAuth, async (c) => {
    const rows = await tx(c).select(
      schema.bookings,
      eq(schema.bookings.status, "pending"),
    );
    return c.json({ pending: rows }, 200);
  })
  // send a real SMS to a technician (admin -> Twilio)
  .post("/:techId/sms", requireAdmin, async (c) => {
    const techId = c.req.param("techId");
    const { body } = await c.req.json();
    if (!body?.trim()) return c.json({ message: "Message is required" }, 400);
    const r = await tx(c).selectOne(schema.riders, eq(schema.riders.id, techId));
    if (!r) return c.json({ message: "Technician not found" }, 404);
    const [ru] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, r.userId));
    const phone = r.phone || ru?.phone || "";
    if (!phone) return c.json({ message: "No phone number on file" }, 400);
    const res = await sendSms(phone, body);
    return c.json(
      { ok: res.ok, skipped: res.skipped, sid: res.sid, error: res.error },
      res.ok || res.skipped ? 200 : 502,
    );
  })
  // direct dispatcher<->tech chat thread + (optional) current job thread
  .get("/:techId/thread", requireAdmin, async (c) => {
    const techId = c.req.param("techId");
    const t = tx(c);
    // only riderId-scoped messages (not booking-scoped)
    const direct = await t.select(
      schema.messages,
      and(eq(schema.messages.riderId, techId), isNull(schema.messages.bookingId)),
    );
    direct.sort((a, b) => Number(a.createdAt) - Number(b.createdAt));

    // mark unread tech messages as read (dispatcher is viewing)
    if (direct.some((m) => !m.read && m.senderRole === "tech")) {
      await t.update(
        schema.messages,
        { read: true },
        and(eq(schema.messages.riderId, techId), isNull(schema.messages.bookingId)),
      );
    }

    // current active job + its thread
    const activeAll = await t.select(
      schema.bookings,
      and(
        eq(schema.bookings.riderId, techId),
        inArray(schema.bookings.status, ACTIVE_STATUSES),
      ),
    );
    activeAll.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
    const active = activeAll.slice(0, 1);

    let job: { id: string; title: string; messages: any[] } | null = null;
    if (active[0]) {
      const jobMsgs = await t.select(
        schema.messages,
        eq(schema.messages.bookingId, active[0].id),
      );
      jobMsgs.sort((a, b) => Number(a.createdAt) - Number(b.createdAt));
      job = {
        id: active[0].id,
        title: active[0].title || "Active job",
        messages: jobMsgs,
      };
    }
    return c.json({ direct, job }, 200);
  })
  // unread count: how many unread tech→dispatch messages in direct thread
  .get("/:techId/unread", requireAdmin, async (c) => {
    const techId = c.req.param("techId");
    const rows = await tx(c).select(
      schema.messages,
      and(
        eq(schema.messages.riderId, techId),
        isNull(schema.messages.bookingId),
        eq(schema.messages.read, false),
      ),
    );
    const count = rows.filter((m) => m.senderRole === "tech").length;
    return c.json({ count }, 200);
  })

  // post into the direct dispatcher<->tech thread
  .post("/:techId/thread", requireAdmin, async (c) => {
    const techId = c.req.param("techId");
    const u = c.get("user") as SessionUser;
    const { body } = await c.req.json();
    if (!body?.trim()) return c.json({ message: "Message is required" }, 400);
    const t = tx(c);
    const r = await t.selectOne(schema.riders, eq(schema.riders.id, techId));
    if (!r) return c.json({ message: "Technician not found" }, 404);
    const [m] = await t.insert(schema.messages, {
      riderId: techId,
      senderRole: "dispatch",
      senderName: u.name,
      body,
      channel: "app",
    });
    // notify the technician
    await t.insert(schema.notifications, {
      userId: r.userId,
      type: "reminder",
      title: "Message from dispatch",
      body,
    });
    return c.json({ message: m }, 201);
  });
