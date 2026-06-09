import { Hono } from "hono";
import { db } from "../database";
import { tdb } from "../database/tenant";
import * as schema from "../database/schema";
import { eq, isNull, and } from "drizzle-orm";
import { requireAuth, tenantId, tx } from "../middleware/auth";
import { isAdminRole } from "../lib/permissions";
import { Err } from "../lib/errors";
import { fireEvent } from "../../services/dispatch";
import { recomputeBooking } from "../../services/billing";
import { reconcileRiderStatus } from "../../services/presence";
import { applyBookingStatus } from "../../services/booking-status";
import { putObject } from "../lib/storage";
import { capture } from "../lib/analytics";
import { incr } from "../lib/metrics";

type SessionUser = { id: string; role?: string; email: string; name: string };

// status -> notification mapping


async function enrich(b: typeof schema.bookings.$inferSelect) {
  const t = tdb(b.companyId);
  const svc = await t.selectOne(schema.services, eq(schema.services.id, b.serviceId));
  let rider: any = null;
  if (b.riderId) {
    const r = await t.selectOne(schema.riders, eq(schema.riders.id, b.riderId));
    if (r) {
      const [ru] = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, r.userId));
      rider = { ...r, name: ru?.name, phone: ru?.phone };
    }
  }
  const [cust] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.id, b.customerId));
  return {
    ...b,
    service: svc ?? null,
    rider,
    customer: cust ? { id: cust.id, name: cust.name, phone: cust.phone, email: cust.email } : null,
  };
}

async function enrichById(companyId: string, id: string) {
  const fresh = await tdb(companyId).selectOne(schema.bookings, eq(schema.bookings.id, id));
  return enrich(fresh!);
}

export const bookingsRoutes = new Hono()
  // list for current user (customer sees own, rider sees assigned, admin sees all)
  .get("/", requireAuth, async (c) => {
    const u = c.get("user") as SessionUser;
    const t = tx(c);
    let rows: (typeof schema.bookings.$inferSelect)[];
    if (isAdminRole(u.role)) {
      rows = await t.select(schema.bookings, isNull(schema.bookings.deletedAt));
    } else if (u.role === "rider") {
      const rp = await t.selectOne(schema.riders, eq(schema.riders.userId, u.id));
      rows = rp ? await t.select(schema.bookings, eq(schema.bookings.riderId, rp.id)) : [];
    } else {
      rows = await t.select(schema.bookings, eq(schema.bookings.customerId, u.id));
    }
    rows.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
    const enriched = await Promise.all(rows.map(enrich));
    return c.json({ bookings: enriched }, 200);
  })
  .get("/:id", requireAuth, async (c) => {
    const b = await tx(c).selectOne(schema.bookings, eq(schema.bookings.id, c.req.param("id")));
    if (!b) return c.json({ message: "Not found" }, 404);
    return c.json({ booking: await enrich(b) }, 200);
  })
  // create a booking (customer)
  .post("/", requireAuth, async (c) => {
    const u = c.get("user") as SessionUser;
    const co = tenantId(c);
    const t = tx(c);
    const body = await c.req.json();
    const svc = await t.selectOne(schema.services, eq(schema.services.id, body.serviceId));
    if (!svc) return c.json({ message: "Service not found" }, 404);

    const [cu] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, u.id));
    const [b] = await t.insert(schema.bookings, {
      customerId: u.id,
      serviceId: body.serviceId,
      templateId: body.templateId ?? null,
      title: body.title ?? svc.name,
      priority: body.priority ?? "normal",
      status: "confirmed",
      scheduledAt: new Date(body.scheduledAt),
      address: body.address,
      lat: body.lat ?? 43.6532,
      lng: body.lng ?? -79.3832,
      notes: body.notes ?? "",
      fieldData: body.fieldData ? JSON.stringify(body.fieldData) : "{}",
      customerPhone: body.phone ?? cu?.phone ?? "",
      region: body.region ?? "",
      rateModel: body.rateModel ? JSON.stringify(body.rateModel) : "",
      lineItems: Array.isArray(body.lineItems) ? JSON.stringify(body.lineItems) : "",
      price: svc.basePrice,
    });

    // compute estimate from rate model + region (no actuals yet -> uses included-only quote)
    const bill = await recomputeBooking(co, b.id);

    // create invoice (unpaid)
    const num = `INV-${Date.now().toString().slice(-6)}`;
    const amount = bill?.subtotal ?? svc.basePrice;
    const tax = bill?.taxAmount ?? +(svc.basePrice * 0.13).toFixed(2);
    await t.insert(schema.invoices, {
      bookingId: b.id,
      customerId: u.id,
      number: num,
      amount,
      tax,
      total: bill?.total ?? +(amount + tax).toFixed(2),
    });

    // fire "created" event through the configurable dispatch engine
    await fireEvent("created", b.id);

    incr("bookings_created_total");
    capture("booking.created", co, { bookingId: b.id, serviceId: body.serviceId, source: "customer" });

    return c.json({ booking: await enrichById(co, b.id) }, 201);
  })
  // admin creates a work order on behalf of a client
  .post("/admin", requireAuth, async (c) => {
    const u = c.get("user") as SessionUser;
    if (!isAdminRole(u.role)) return c.json({ message: "Forbidden" }, 403);
    const body = await c.req.json();
    if (!body.customerId) return c.json({ message: "Client is required" }, 400);
    if (!body.scheduledAt) return c.json({ message: "Schedule date is required" }, 400);

    const co = tenantId(c);
    const t = tx(c);
    const svc = await t.selectOne(schema.services, eq(schema.services.id, body.serviceId));
    if (!svc) return c.json({ message: "Service not found" }, 404);

    const [cu] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, body.customerId));
    if (!cu) return c.json({ message: "Client not found" }, 404);

    const assignedRider = body.riderId || null;
    const [b] = await t.insert(schema.bookings, {
      customerId: body.customerId,
      serviceId: body.serviceId,
      riderId: assignedRider,
      templateId: body.templateId ?? null,
      title: body.title || svc.name,
      priority: body.priority ?? "normal",
      status: assignedRider ? "assigned" : "confirmed",
      scheduledAt: new Date(body.scheduledAt),
      address: body.address ?? "",
      lat: body.lat ?? 43.6532,
      lng: body.lng ?? -79.3832,
      notes: body.notes ?? "",
      customerPhone: body.phone ?? cu.phone ?? "",
      region: body.region ?? "",
      rateModel: body.rateModel ? JSON.stringify(body.rateModel) : "",
      lineItems: Array.isArray(body.lineItems) ? JSON.stringify(body.lineItems) : "",
      price: svc.basePrice,
    });

    const bill = await recomputeBooking(co, b.id);

    const num = `INV-${Date.now().toString().slice(-6)}`;
    const amount = bill?.subtotal ?? svc.basePrice;
    const tax = bill?.taxAmount ?? +(svc.basePrice * 0.13).toFixed(2);
    await t.insert(schema.invoices, {
      bookingId: b.id,
      customerId: body.customerId,
      number: num,
      amount,
      tax,
      total: bill?.total ?? +(amount + tax).toFixed(2),
    });

    if (assignedRider) {
      await reconcileRiderStatus(co, assignedRider);
    }

    await fireEvent("created", b.id);
    incr("bookings_created_total");
    capture("booking.created", co, { bookingId: b.id, serviceId: body.serviceId, source: "admin" });
    if (assignedRider) {
      await t.update(
        schema.bookings,
        { assignStatus: "offered", assignedAt: new Date() },
        eq(schema.bookings.id, b.id),
      );
      await fireEvent("assigned", b.id);
      incr("dispatch_assigned_total");
      capture("dispatch.assigned", co, { bookingId: b.id, riderId: assignedRider });
    }

    return c.json({ booking: await enrichById(co, b.id) }, 201);
  })
  // reschedule a work order (admin) -> set scheduledAt (drag onto a calendar day)
  .post("/:id/schedule", requireAuth, async (c) => {
    const u = c.get("user") as SessionUser;
    if (!isAdminRole(u.role)) return c.json({ message: "Forbidden" }, 403);
    const id = c.req.param("id");
    const { scheduledAt } = await c.req.json();
    if (!scheduledAt) return c.json({ message: "scheduledAt required" }, 400);
    const t = tx(c);
    const prev = await t.selectOne(schema.bookings, eq(schema.bookings.id, id));
    if (!prev) return c.json({ message: "Not found" }, 404);
    const set: Record<string, unknown> = { scheduledAt: new Date(scheduledAt) };
    const [b] = await t.update(schema.bookings, set, eq(schema.bookings.id, id));
    return c.json({ booking: await enrich(b) }, 200);
  })
  // admin edits any field on a work order (address, schedule, service, pricing, etc.)
  .patch("/:id", requireAuth, async (c) => {
    const u = c.get("user") as SessionUser;
    if (!isAdminRole(u.role)) return c.json({ message: "Forbidden" }, 403);
    const id = c.req.param("id");
    const co = tenantId(c);
    const t = tx(c);
    const body = await c.req.json();
    const prev = await t.selectOne(schema.bookings, eq(schema.bookings.id, id));
    if (!prev) return c.json({ message: "Not found" }, 404);

    const set: Record<string, unknown> = {};
    if (body.title !== undefined) set.title = body.title;
    if (body.priority !== undefined) set.priority = body.priority;
    if (body.address !== undefined) set.address = body.address;
    if (body.notes !== undefined) set.notes = body.notes;
    if (body.customerId !== undefined) set.customerId = body.customerId;
    if (body.serviceId !== undefined) set.serviceId = body.serviceId;
    if (body.templateId !== undefined) set.templateId = body.templateId || null;
    if (body.region !== undefined) set.region = body.region ?? "";
    if (body.lat !== undefined) set.lat = body.lat;
    if (body.lng !== undefined) set.lng = body.lng;
    if (body.customerPhone !== undefined) set.customerPhone = body.customerPhone;
    if (body.scheduledAt !== undefined && body.scheduledAt)
      set.scheduledAt = new Date(body.scheduledAt);
    if (body.rateModel !== undefined)
      set.rateModel = body.rateModel ? JSON.stringify(body.rateModel) : "";
    if (body.lineItems !== undefined)
      set.lineItems = Array.isArray(body.lineItems) ? JSON.stringify(body.lineItems) : "";

    // handle (re)assignment if the rider changed
    const newRider = body.riderId;
    if (newRider !== undefined && newRider !== (prev.riderId ?? "")) {
      if (newRider) {
        set.riderId = newRider;
        if (["pending", "confirmed", "unassigned"].includes(prev.status))
          set.status = "assigned";
        set.assignStatus = "offered";
        set.assignedAt = new Date();
        set.acceptedAt = null;
        set.declineReason = "";
      } else {
        set.riderId = null;
        if (["assigned"].includes(prev.status)) set.status = "confirmed";
        set.assignStatus = "";
      }
    }

    await t.update(schema.bookings, set, eq(schema.bookings.id, id));

    // keep busy status + offer flow in sync on a real reassignment
    if (newRider !== undefined && newRider !== (prev.riderId ?? "")) {
      if (newRider) {
        await reconcileRiderStatus(co, newRider);
        await fireEvent("assigned", id);
      }
      // free the previous tech if they were assigned (clears their stale "busy")
      if (prev.riderId) await reconcileRiderStatus(co, prev.riderId);
    }

    // re-price whenever pricing-relevant fields move
    if (
      body.rateModel !== undefined ||
      body.region !== undefined ||
      body.serviceId !== undefined ||
      body.templateId !== undefined ||
      body.lineItems !== undefined
    ) {
      await recomputeBooking(co, id);
    }

    return c.json({ booking: await enrichById(co, id) }, 200);
  })
  // assign a rider (admin) -> offers the job; tech must accept before en route
  .post("/:id/assign", requireAuth, async (c) => {
    const co = tenantId(c);
    const { riderId } = await c.req.json();
    const id = c.req.param("id");
    const [b] = await tx(c).update(
      schema.bookings,
      { riderId, status: "assigned", assignStatus: "offered", assignedAt: new Date(), acceptedAt: null, declineReason: "" },
      eq(schema.bookings.id, id),
    );
    await reconcileRiderStatus(co, riderId);

    await fireEvent("assigned", id);
    return c.json({ booking: await enrich(b) }, 200);
  })
  // tech accepts an offered job.
  // Compare-and-set: only transitions a job that is STILL "offered". If the
  // office reassigned, cancelled, or another tech already grabbed it (or a
  // duplicate tap / multi-node race fires twice), 0 rows update and we return
  // 409 instead of silently clobbering a newer state.
  .post("/:id/accept", requireAuth, async (c) => {
    const id = c.req.param("id");
    const [b] = await tx(c).update(
      schema.bookings,
      { assignStatus: "accepted", acceptedAt: new Date() },
      and(eq(schema.bookings.id, id), eq(schema.bookings.assignStatus, "offered")),
    );
    if (!b) throw Err.conflict("This job is no longer available to accept.");
    await fireEvent("accepted", id);
    return c.json({ booking: await enrich(b) }, 200);
  })
  // tech declines an offered job -> back to dispatch queue, notify office
  .post("/:id/decline", requireAuth, async (c) => {
    const id = c.req.param("id");
    const { reason } = await c.req.json().catch(() => ({ reason: "" }));
    const t = tx(c);
    const cur = await t.selectOne(schema.bookings, eq(schema.bookings.id, id));
    // Only an OFFERED job can be declined. Guards against a stale tap after the
    // office already pulled/reassigned the job (would otherwise wrongly null
    // out a freshly-assigned rider).
    if (!cur || cur.assignStatus !== "offered") {
      throw Err.conflict("This job is no longer pending your response.");
    }
    // free the tech, return to queue (unassigned + confirmed)
    if (cur.riderId) {
      await t.update(schema.riders, { status: "available" }, eq(schema.riders.id, cur.riderId));
    }
    // fire declined first (while riderId still resolves to the tech who declined)
    await fireEvent("declined", id);
    const [b] = await t.update(
      schema.bookings,
      { riderId: null, status: "confirmed", assignStatus: "declined", declineReason: reason || "" },
      and(eq(schema.bookings.id, id), eq(schema.bookings.assignStatus, "offered")),
    );
    if (!b) throw Err.conflict("This job is no longer pending your response.");
    return c.json({ booking: await enrich(b) }, 200);
  })
  // update status (rider/admin) -> triggers notifications + emails
  .post("/:id/status", requireAuth, async (c) => {
    const co = tenantId(c);
    const { status } = await c.req.json();
    const id = c.req.param("id");
    const b = await applyBookingStatus(co, id, status);
    if (!b) return c.json({ error: "not found" }, 404);
    return c.json({ booking: await enrich(b) }, 200);
  })
  .post("/:id/cancel", requireAuth, async (c) => {
    const co = tenantId(c);
    const id = c.req.param("id");
    const t = tx(c);
    const prev = await t.selectOne(schema.bookings, eq(schema.bookings.id, id));
    const [b] = await t.update(schema.bookings, { status: "cancelled" }, eq(schema.bookings.id, id));
    await fireEvent("cancelled", id);
    // free the assigned tech so they don't stay stuck "busy" after a cancel
    if (prev?.riderId) await reconcileRiderStatus(co, prev.riderId);
    return c.json({ booking: await enrich(b) }, 200);
  })
  // review
  .post("/:id/review", requireAuth, async (c) => {
    const u = c.get("user") as SessionUser;
    const id = c.req.param("id");
    const { rating, comment } = await c.req.json();
    const t = tx(c);
    const b = await t.selectOne(schema.bookings, eq(schema.bookings.id, id));
    if (!b) return c.json({ message: "Not found" }, 404);
    const [r] = await t.insert(schema.reviews, {
      bookingId: id,
      customerId: u.id,
      riderId: b.riderId,
      rating,
      comment: comment ?? "",
    });
    return c.json({ review: r }, 201);
  })
  // list job photos for a work order
  .get("/:id/photos", requireAuth, async (c) => {
    const rows = await tx(c).select(
      schema.jobPhotos,
      eq(schema.jobPhotos.bookingId, c.req.param("id")),
    );
    rows.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
    return c.json({ photos: rows }, 200);
  })
  // upload a job photo (tech). multipart: file, optional caption
  .post("/:id/photos", requireAuth, async (c) => {
    const id = c.req.param("id");
    const t = tx(c);
    const b = await t.selectOne(schema.bookings, eq(schema.bookings.id, id));
    if (!b) return c.json({ message: "Not found" }, 404);
    const form = await c.req.formData();
    const file = form.get("file");
    const caption = String(form.get("caption") || "");
    if (!(file instanceof File)) return c.json({ message: "No file" }, 400);
    if (file.size > 15 * 1024 * 1024) return c.json({ message: "Image too large (max 15MB)" }, 400);
    const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
    if (file.type && !ALLOWED.includes(file.type))
      return c.json({ message: `Unsupported type ${file.type}` }, 400);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().slice(0, 8);
    const key = `job-photos/${id}/${crypto.randomUUID()}.${ext}`;
    const stored = await putObject(
      key,
      Buffer.from(await file.arrayBuffer()),
      file.type || "image/jpeg",
    );
    const [p] = await t.insert(schema.jobPhotos, {
      bookingId: id,
      url: stored.url,
      caption,
      source: "upload",
    });
    return c.json({ photo: p }, 201);
  });
