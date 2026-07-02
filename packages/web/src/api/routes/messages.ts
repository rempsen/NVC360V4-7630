import { Hono } from "hono";
import { db } from "../database";
import { tdb } from "../database/tenant";
import * as schema from "../database/schema";
import { eq, and, or, isNull, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin, tx, tenantId } from "../middleware/auth";
import { isAdminRole } from "../lib/permissions";
import { sendSms, trackingUrl } from "../../services/sms";
import { sendPush } from "../../services/push";

type SessionUser = { id: string; role?: string; name: string };

function roleLabel(role?: string): "client" | "tech" | "dispatch" {
  if (role === "rider") return "tech";
  if (isAdminRole(role)) return "dispatch";
  return "client";
}

/**
 * Unread count for a rider's direct dispatcher thread — same query the
 * `/direct/unread` endpoint uses. Used to set the push notification's
 * `badge` so the closed/backgrounded app's icon shows the right number
 * (this is what actually drives the red counter on the home-screen icon;
 * the app itself has no way to update its own badge while not running).
 */
async function unreadDirectCountForRider(companyId: string, riderId: string): Promise<number> {
  const rows = await tdb(companyId).select(
    schema.messages,
    and(eq(schema.messages.riderId, riderId), isNull(schema.messages.bookingId), eq(schema.messages.read, false)),
  );
  return rows.filter((m) => m.senderRole === "dispatch").length;
}

export const messagesRoutes = new Hono()
  // ── Direct dispatcher<->tech thread ──────────────────────────────────────
  // GET /api/messages/direct — rider fetches their own direct thread with dispatch
  .get("/direct", requireAuth, async (c) => {
    const u = c.get("user") as SessionUser;
    if (u.role !== "rider") return c.json({ message: "Forbidden" }, 403);
    const t = tx(c);

    const rider = await t.selectOne(schema.riders, eq(schema.riders.userId, u.id));
    if (!rider) return c.json({ message: "Rider not found" }, 404);

    const direct = await t.select(
      schema.messages,
      and(eq(schema.messages.riderId, rider.id), isNull(schema.messages.bookingId)),
    );
    direct.sort((a, b) => Number(a.createdAt) - Number(b.createdAt));

    // Mark all unread direct messages as read
    if (direct.some((m) => !m.read)) {
      await t.update(
        schema.messages,
        { read: true },
        and(eq(schema.messages.riderId, rider.id), isNull(schema.messages.bookingId)),
      );
    }

    // current active job thread
    const activeAll = await t.select(
      schema.bookings,
      and(
        eq(schema.bookings.riderId, rider.id),
        or(
          eq(schema.bookings.status, "confirmed"),
          eq(schema.bookings.status, "enroute"),
          eq(schema.bookings.status, "in_progress"),
        ),
      ),
    );
    const active = activeAll.slice(0, 1);

    let job: { id: string; title: string; messages: any[] } | null = null;
    if (active.length) {
      const jobMsgs = await t.select(
        schema.messages,
        eq(schema.messages.bookingId, active[0].id),
      );
      jobMsgs.sort((a, b) => Number(a.createdAt) - Number(b.createdAt));
      job = { id: active[0].id, title: active[0].title || "Active Job", messages: jobMsgs };
    }

    return c.json({ direct, job }, 200);
  })

  // POST /api/messages/direct — rider posts to their direct dispatch thread
  .post("/direct", requireAuth, async (c) => {
    const u = c.get("user") as SessionUser;
    if (u.role !== "rider") return c.json({ message: "Forbidden" }, 403);
    const t = tx(c);

    const rider = await t.selectOne(schema.riders, eq(schema.riders.userId, u.id));
    if (!rider) return c.json({ message: "Rider not found" }, 404);

    const { body } = await c.req.json();
    if (!body?.trim()) return c.json({ message: "Message is required" }, 400);

    const [m] = await t.insert(schema.messages, {
      riderId: rider.id,
      senderRole: "tech",
      senderName: u.name,
      body,
      channel: "app",
    });

    // notify all admins (dispatchers)
    const admins = await db
      .select()
      .from(schema.user)
      .where(inArray(schema.user.role, ["admin", "superadmin"]));
    for (const admin of admins) {
      await t.insert(schema.notifications, {
        userId: admin.id,
        type: "reminder",
        title: `Message from ${u.name || "Technician"}`,
        body,
      });
    }

    return c.json({ message: m }, 201);
  })

  // ── Unread count for tech's direct thread ────────────────────────────────
  .get("/direct/unread", requireAuth, async (c) => {
    const u = c.get("user") as SessionUser;
    if (u.role !== "rider") return c.json({ count: 0 }, 200);
    const t = tx(c);

    const rider = await t.selectOne(schema.riders, eq(schema.riders.userId, u.id));
    if (!rider) return c.json({ count: 0 }, 200);

    const rows = await t.select(
      schema.messages,
      and(
        eq(schema.messages.riderId, rider.id),
        isNull(schema.messages.bookingId),
        eq(schema.messages.read, false),
      ),
    );
    const count = rows.filter((m) => m.senderRole === "dispatch").length;
    return c.json({ count }, 200);
  })

  // ── Dispatch side: list every tech's direct thread w/ unread count + tags ─
  .get("/dispatch/threads", requireAdmin, async (c) => {
    const t = tx(c);
    const cId = tenantId(c);
    const riders = await t.select(schema.riders);
    // scope the id->name lookup to this tenant's users (global table, explicit filter)
    const users = await db.select().from(schema.user).where(eq(schema.user.companyId, cId));
    const userById = new Map(users.map((u) => [u.id, u]));

    // all direct messages (no booking)
    const all = await t.select(schema.messages, isNull(schema.messages.bookingId));
    all.sort((a, b) => Number(a.createdAt) - Number(b.createdAt));

    // fetch tags for all riders in this company
    const allEntityTags = await db
      .select({ entityId: schema.entityTags.entityId, tagId: schema.entityTags.tagId })
      .from(schema.entityTags)
      .where(and(eq(schema.entityTags.companyId, cId), eq(schema.entityTags.entityType, "tech")));
    const allTags = await db
      .select()
      .from(schema.tags)
      .where(eq(schema.tags.companyId, cId));
    const tagById = new Map(allTags.map((tg) => [tg.id, tg]));
    // map riderId -> tags array
    const riderTagsMap = new Map<string, Array<{ id: string; label: string; color: string }>>();
    for (const et of allEntityTags) {
      const tg = tagById.get(et.tagId);
      if (!tg) continue;
      if (!riderTagsMap.has(et.entityId)) riderTagsMap.set(et.entityId, []);
      riderTagsMap.get(et.entityId)!.push({ id: tg.id, label: tg.label, color: tg.color });
    }

    const threads = riders.map((r) => {
      const msgs = all.filter((m) => m.riderId === r.id);
      const last = msgs[msgs.length - 1];
      const unread = msgs.filter((m) => !m.read && m.senderRole === "tech").length;
      const u = userById.get(r.userId);
      return {
        techId: r.id,
        name: u?.name ?? "Technician",
        photoUrl: r.photoUrl ?? null,
        color: r.color ?? "#0ea5e9",
        status: r.status ?? "offline",
        skillClass: r.skillClass ?? null,
        tags: riderTagsMap.get(r.id) ?? [],
        lastMessage: last?.body ?? null,
        lastSenderRole: last?.senderRole ?? null,
        lastAt: last?.createdAt ?? null,
        unread,
      };
    });

    threads.sort((a, b) => {
      if (b.unread !== a.unread) return b.unread - a.unread;
      const at = a.lastAt ? new Date(a.lastAt).getTime() : 0;
      const bt = b.lastAt ? new Date(b.lastAt).getTime() : 0;
      if (bt !== at) return bt - at;
      return a.name.localeCompare(b.name);
    });

    const totalUnread = threads.reduce((s, t2) => s + t2.unread, 0);
    return c.json({ threads, totalUnread }, 200);
  })

  // GET /api/messages/dispatch/:techId — full direct thread w/ one tech
  .get("/dispatch/:techId", requireAdmin, async (c) => {
    const techId = c.req.param("techId");
    const t = tx(c);
    const rider = await t.selectOne(schema.riders, eq(schema.riders.id, techId));
    if (!rider) return c.json({ message: "Tech not found" }, 404);

    const msgs = await t.select(
      schema.messages,
      and(eq(schema.messages.riderId, techId), isNull(schema.messages.bookingId)),
    );
    msgs.sort((a, b) => Number(a.createdAt) - Number(b.createdAt));

    if (msgs.some((m) => !m.read && m.senderRole === "tech")) {
      await t.update(
        schema.messages,
        { read: true },
        and(
          eq(schema.messages.riderId, techId),
          isNull(schema.messages.bookingId),
          eq(schema.messages.senderRole, "tech"),
        ),
      );
    }

    const [u] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, rider.userId));

    return c.json(
      {
        tech: {
          techId: rider.id,
          name: u?.name ?? "Technician",
          photoUrl: rider.photoUrl ?? null,
          status: rider.status ?? "offline",
        },
        messages: msgs,
      },
      200,
    );
  })

  // POST /api/messages/dispatch/:techId — dispatcher messages a tech
  .post("/dispatch/:techId", requireAdmin, async (c) => {
    const u = c.get("user") as SessionUser;
    const techId = c.req.param("techId");
    const co = tenantId(c);
    const t = tx(c);
    const rider = await t.selectOne(schema.riders, eq(schema.riders.id, techId));
    if (!rider) return c.json({ message: "Tech not found" }, 404);

    const { body } = await c.req.json();
    if (!body?.trim()) return c.json({ message: "Message is required" }, 400);

    const [m] = await t.insert(schema.messages, {
      riderId: techId,
      senderRole: "dispatch",
      senderName: u.name || "Dispatch",
      body,
      channel: "app",
    });

    await t.insert(schema.notifications, {
      userId: rider.userId,
      type: "reminder",
      title: `Message from dispatch`,
      body,
    });

    // Push to the tech's devices so they get a notification banner even when
    // the app is backgrounded or fully closed — and set the badge count so
    // the closed app's icon shows the number of unread dispatch messages
    // (this is the whole point: they shouldn't have to open the app and
    // scroll down to discover a new message).
    const unread = await unreadDirectCountForRider(co, techId);
    sendPush(rider.userId, `Message from ${u.name || "Dispatch"}`, body, {
      type: "direct_message",
      techId,
    }, unread).catch(() => {});

    return c.json({ message: m }, 201);
  })

  // ── Broadcast: send to all drivers, available drivers, or by tag ──────────
  // POST /api/messages/broadcast
  .post("/broadcast", requireAdmin, async (c) => {
    const u = c.get("user") as SessionUser;
    const t = tx(c);
    const cId = tenantId(c);

    const { body, target } = await c.req.json();
    // target: { type: "all" | "available" | "tag", tagId?: string }
    if (!body?.trim()) return c.json({ message: "Message is required" }, 400);
    if (!target?.type) return c.json({ message: "target.type required" }, 400);

    // get all riders
    let riders = await t.select(schema.riders);

    if (target.type === "available") {
      riders = riders.filter((r) => r.status === "available");
    } else if (target.type === "tag" && target.tagId) {
      const taggedEntityIds = await db
        .select({ entityId: schema.entityTags.entityId })
        .from(schema.entityTags)
        .where(
          and(
            eq(schema.entityTags.companyId, cId),
            eq(schema.entityTags.entityType, "tech"),
            eq(schema.entityTags.tagId, target.tagId),
          ),
        );
      const ids = new Set(taggedEntityIds.map((e) => e.entityId));
      riders = riders.filter((r) => ids.has(r.id));
    } else if (target.type === "skillClass" && target.skillClass) {
      riders = riders.filter(
        (r) => (r.skillClass ?? "General").toLowerCase() === target.skillClass.toLowerCase(),
      );
    } else if (target.type === "skill" && target.skill) {
      // skill is a csv tag stored on riders.skills
      const needle = target.skill.toLowerCase();
      riders = riders.filter((r) => {
        const skills = (r.skills ?? "")
          .split(",")
          .map((s: string) => s.trim().toLowerCase())
          .filter(Boolean);
        return skills.includes(needle);
      });
    }

    if (riders.length === 0) {
      return c.json({ message: "No drivers match this target", sent: 0 }, 200);
    }

    const broadcastId = crypto.randomUUID();
    let sent = 0;
    for (const rider of riders) {
      await t.insert(schema.messages, {
        riderId: rider.id,
        senderRole: "dispatch",
        senderName: u.name || "Dispatch",
        body,
        channel: "broadcast",
        // store broadcastId in a custom field we append to body? No — use channel="broadcast"
        // We embed broadcastId so the mobile can group them — we'll just tag the channel
      });
      await t.insert(schema.notifications, {
        userId: rider.userId,
        type: "reminder",
        title: `Broadcast from ${u.name || "Dispatch"}`,
        body,
      });
      // Same push + badge treatment as a direct message — a broadcast is just
      // as easy to miss as a 1:1 message if the app isn't open.
      const unread = await unreadDirectCountForRider(cId, rider.id);
      sendPush(rider.userId, `Broadcast from ${u.name || "Dispatch"}`, body, {
        type: "broadcast_message",
        broadcastId,
      }, unread).catch(() => {});
      sent++;
    }

    return c.json({ sent, broadcastId }, 201);
  })

  // GET /api/messages/tags — return tech-scoped tags for broadcast targeting
  .get("/tags", requireAdmin, async (c) => {
    const cId = tenantId(c);
    const techTags = await db
      .select()
      .from(schema.tags)
      .where(and(eq(schema.tags.companyId, cId)));
    // include all tags (both + tech scope)
    const filtered = techTags.filter((t) => t.scope === "tech" || t.scope === "both");
    return c.json({ tags: filtered }, 200);
  })

  // GET /api/messages/skill-classes — distinct skill classes across all riders in tenant
  .get("/skill-classes", requireAdmin, async (c) => {
    const t = tx(c);
    const riders = await t.select(schema.riders);
    // collect distinct skill classes
    const classMap = new Map<string, number>();
    for (const r of riders) {
      const sc = (r.skillClass ?? "General").trim();
      if (sc) classMap.set(sc, (classMap.get(sc) ?? 0) + 1);
    }
    const skillClasses = Array.from(classMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return c.json({ skillClasses }, 200);
  })

  // GET /api/messages/skills — distinct individual skills (csv) across all riders
  .get("/skills", requireAdmin, async (c) => {
    const t = tx(c);
    const riders = await t.select(schema.riders);
    const skillMap = new Map<string, number>();
    for (const r of riders) {
      const raw = (r.skills ?? "").split(",").map((s: string) => s.trim()).filter(Boolean);
      for (const s of raw) {
        skillMap.set(s, (skillMap.get(s) ?? 0) + 1);
      }
    }
    const skills = Array.from(skillMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return c.json({ skills }, 200);
  })

  // ── Job thread (booking-scoped) ──────────────────────────────────────────
  .get("/:bookingId", requireAuth, async (c) => {
    const rows = await tx(c).select(
      schema.messages,
      eq(schema.messages.bookingId, c.req.param("bookingId")),
    );
    rows.sort((a, b) => Number(a.createdAt) - Number(b.createdAt));
    return c.json({ messages: rows }, 200);
  })

  // POST /api/messages/:bookingId — tech, dispatch, or client posts to job thread
  .post("/:bookingId", requireAuth, async (c) => {
    const u = c.get("user") as SessionUser;
    const { body } = await c.req.json();
    const bookingId = c.req.param("bookingId");
    const t = tx(c);
    const [m] = await t.insert(schema.messages, {
      bookingId,
      senderRole: roleLabel(u.role),
      senderName: u.name,
      body,
      channel: "app",
    });

    // look up booking for SMS/notification
    const b = await t.selectOne(schema.bookings, eq(schema.bookings.id, bookingId));

    if (b) {
      if (u.role !== "customer") {
        await t.insert(schema.notifications, {
          userId: b.customerId,
          bookingId,
          type: "reminder",
          title: `Message from ${roleLabel(u.role) === "tech" ? "your technician" : "Dispatch"}`,
          body,
        });
        const phone = b.customerPhone;
        const token = b.publicToken;
        if (phone) {
          const from =
            roleLabel(u.role) === "tech" ? u.name || "Your technician" : "Dispatch";
          const trackLink = token ? ` Track & reply: ${trackingUrl(token)}` : "";
          await sendSms(phone, `NVC360: ${from}: "${body}"${trackLink}`).catch(() => {});
        }
      } else {
        if (b.riderId) {
          const r = await t.selectOne(schema.riders, eq(schema.riders.id, b.riderId));
          if (r) {
            await t.insert(schema.notifications, {
              userId: r.userId,
              bookingId,
              type: "reminder",
              title: "New message from customer",
              body,
            });
            const admins = await db
              .select()
              .from(schema.user)
              .where(inArray(schema.user.role, ["admin", "superadmin"]));
            for (const admin of admins) {
              await t.insert(schema.notifications, {
                userId: admin.id,
                bookingId,
                type: "reminder",
                title: `Customer message on ${b.title || "job"}`,
                body,
              });
            }
            const [ru] = await db
              .select()
              .from(schema.user)
              .where(eq(schema.user.id, r.userId));
            const techPhone = r.phone || ru?.phone || "";
            if (techPhone && b.publicToken) {
              const who = m.senderName || "Customer";
              await sendSms(
                techPhone,
                `NVC360: Customer ${who}: "${body}" — View: ${trackingUrl(b.publicToken)}`,
              ).catch(() => {});
            }
          }
        }
      }
    }

    return c.json({ message: m }, 201);
  });
