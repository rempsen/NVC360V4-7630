import { Hono } from "hono";
import * as schema from "../database/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, tx, tenantId } from "../middleware/auth";
import { fireEvent, seedNotificationRules, EVENT_META, defaultTemplateFor, interpolateSample, TEMPLATE_VARS, renderDesignPreview, sendDesignTest, type NvcEvent } from "../../services/dispatch";
import { starterDesigns } from "../../services/email-render";
import { putObject } from "../lib/storage";
import { resendAvailable, triggerVerify, removeDomain } from "../../services/email-domains";

const EVENTS = Object.keys(EVENT_META) as NvcEvent[];
const RECIPIENTS = ["client", "tech", "office"] as const;

/**
 * Resolve (creating if needed) the single notification_channels row for the
 * active company. Tenancy: one row per company, keyed by companyId. The legacy
 * `id="default"` singleton no longer exists.
 */
async function getOrCreateChannels(c: any) {
  const t = tx(c);
  let row = await t.selectOne(schema.notificationChannels);
  if (!row) {
    const co = await t.selectOne(schema.companySettings);
    [row] = await t.insert(schema.notificationChannels, {
      emailFromName: co?.name || "NVC 360",
      emailFromAddress: co?.email || "",
    });
  }
  return row;
}

export const notifConfigRoutes = new Hono()
  // full rule matrix (seeds defaults on first call)
  .get("/rules", requireAdmin, async (c) => {
    await seedNotificationRules(tenantId(c));
    const t = tx(c);
    const rules = await t.select(schema.notificationRules);
    // ensure a row exists for every event×recipient so the UI grid is complete
    const have = new Set(rules.map((r) => `${r.event}:${r.recipient}`));
    const toAdd: any[] = [];
    for (const event of EVENTS)
      for (const recipient of RECIPIENTS)
        if (!have.has(`${event}:${recipient}`))
          toAdd.push({ event, recipient, inApp: false, email: false, sms: false, webhook: false, enabled: true });
    if (toAdd.length) {
      await t.insert(schema.notificationRules, toAdd);
    }
    const all = await t.select(schema.notificationRules);
    const meta = EVENTS.map((e) => ({ event: e, label: EVENT_META[e].label }));
    return c.json({ rules: all, events: meta, recipients: RECIPIENTS }, 200);
  })
  // update one rule (toggle a channel etc.)
  .patch("/rules/:id", requireAdmin, async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of ["inApp", "email", "sms", "webhook", "enabled", "template", "emailSubject", "emailDesign"]) {
      if (k in body) patch[k] = body[k];
    }
    const [r] = await tx(c).update(schema.notificationRules, patch as any, eq(schema.notificationRules.id, id));
    return c.json({ rule: r }, 200);
  })
  // bulk set a whole column for an event row (convenience)
  .post("/rules/bulk", requireAdmin, async (c) => {
    const { event, channel, value } = await c.req.json();
    if (!["inApp", "email", "sms", "webhook"].includes(channel)) return c.json({ message: "bad channel" }, 400);
    await tx(c).update(
      schema.notificationRules,
      { [channel]: value, updatedAt: new Date() } as any,
      eq(schema.notificationRules.event, event),
    );
    return c.json({ ok: true }, 200);
  })

  // ---- single event detail (all 3 recipient rows + meta + sample template vars) ----
  .get("/events/:event", requireAdmin, async (c) => {
    await seedNotificationRules(tenantId(c));
    const event = c.req.param("event") as NvcEvent;
    if (!EVENT_META[event]) return c.json({ message: "unknown event" }, 404);
    const t = tx(c);
    const rows = await t.select(schema.notificationRules, eq(schema.notificationRules.event, event));
    // make sure all 3 recipient rows exist
    const have = new Set(rows.map((r) => r.recipient));
    const toAdd = RECIPIENTS.filter((r) => !have.has(r)).map((recipient) => ({ event, recipient, inApp: false, email: false, sms: false, webhook: false, enabled: true }));
    if (toAdd.length) await t.insert(schema.notificationRules, toAdd);
    const all = await t.select(schema.notificationRules, eq(schema.notificationRules.event, event));
    return c.json({
      event,
      meta: EVENT_META[event],
      rules: all,
      defaults: Object.fromEntries(RECIPIENTS.map((r) => [r, defaultTemplateFor(event, r as any)])),
      vars: TEMPLATE_VARS,
    }, 200);
  })

  // ---- template preview (interpolate {{vars}} against sample data) ----
  .post("/preview", requireAdmin, async (c) => {
    const { template } = await c.req.json();
    return c.json({ rendered: interpolateSample(template || "") }, 200);
  })

  // ---- render a full branded HTML email from a block design (live editor preview) ----
  .post("/email/render", requireAdmin, async (c) => {
    const { design, footer } = await c.req.json().catch(() => ({}));
    const origin = new URL(c.req.url).origin;
    const html = await renderDesignPreview(tenantId(c), Array.isArray(design) ? design : [], { footer, origin });
    return c.json({ html }, 200);
  })

  // ---- send a test email rendered from a block design ----
  .post("/email/test", requireAdmin, async (c) => {
    const { to, subject, design } = await c.req.json().catch(() => ({}));
    if (!to) return c.json({ message: "recipient email required" }, 400);
    const origin = new URL(c.req.url).origin;
    const r = await sendDesignTest(tenantId(c), to, subject || "", Array.isArray(design) ? design : [], origin);
    return c.json(r, 200);
  })

  // ---- reusable email templates library ----
  .get("/email/templates", requireAdmin, async (c) => {
    const t = tx(c);
    // seed builtin starters once (per company)
    const existing = await t.select(schema.emailTemplates, eq(schema.emailTemplates.isBuiltin, true));
    if (existing.length === 0) {
      for (const s of starterDesigns()) {
        await t.insert(schema.emailTemplates, { name: s.name, description: s.description, subject: s.subject, design: JSON.stringify(s.design), isBuiltin: true });
      }
    }
    const rows = await t.select(schema.emailTemplates);
    rows.sort((a, b) =>
      (Number(b.isBuiltin) - Number(a.isBuiltin)) ||
      (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    );
    return c.json({ templates: rows }, 200);
  })
  .post("/email/templates", requireAdmin, async (c) => {
    const b = await c.req.json();
    const [t] = await tx(c).insert(schema.emailTemplates, {
      name: b.name || "Untitled template",
      description: b.description || "",
      subject: b.subject || "",
      design: typeof b.design === "string" ? b.design : JSON.stringify(b.design || []),
      isBuiltin: false,
    });
    return c.json({ template: t }, 201);
  })
  .patch("/email/templates/:id", requireAdmin, async (c) => {
    const id = c.req.param("id");
    const b = await c.req.json();
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of ["name", "description", "subject"]) if (k in b) patch[k] = b[k];
    if ("design" in b) patch.design = typeof b.design === "string" ? b.design : JSON.stringify(b.design);
    const [t] = await tx(c).update(schema.emailTemplates, patch as any, eq(schema.emailTemplates.id, id));
    return c.json({ template: t }, 200);
  })
  .delete("/email/templates/:id", requireAdmin, async (c) => {
    const t = tx(c);
    const row = await t.selectOne(schema.emailTemplates, eq(schema.emailTemplates.id, c.req.param("id")));
    if (row?.isBuiltin) return c.json({ message: "cannot delete a builtin template" }, 400);
    await t.delete(schema.emailTemplates, eq(schema.emailTemplates.id, c.req.param("id")));
    return c.json({ ok: true }, 200);
  })

  // ---- logo upload for email header (stored under /uploads, returns its URL) ----
  .post("/email/logo", requireAdmin, async (c) => {
    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return c.json({ message: "No file" }, 400);
    if (file.size > 4 * 1024 * 1024) return c.json({ message: "Logo too large (max 4MB)" }, 400);
    if (file.type && !["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"].includes(file.type))
      return c.json({ message: `Unsupported type ${file.type}` }, 400);
    const ext = (file.name.split(".").pop() || "png").toLowerCase().slice(0, 8);
    const key = `email-logos/${crypto.randomUUID()}.${ext}`;
    const stored = await putObject(
      key,
      Buffer.from(await file.arrayBuffer()),
      file.type || "image/png",
    );
    // persist on this company's channel config
    const existing = await getOrCreateChannels(c);
    await tx(c).update(schema.notificationChannels, { emailLogoUrl: stored.url, updatedAt: new Date() }, eq(schema.notificationChannels.id, existing.id));
    return c.json({ url: stored.url }, 200);
  })

  // ---- per-company channel settings (sender identity, quiet hours, master switches) ----
  .get("/channels", requireAdmin, async (c) => {
    const row = await getOrCreateChannels(c);
    return c.json({ channels: row }, 200);
  })
  .patch("/channels", requireAdmin, async (c) => {
    const b = await c.req.json();
    const fields = ["inAppEnabled", "emailEnabled", "smsEnabled", "webhookEnabled", "emailFromName", "emailFromAddress", "emailReplyTo", "emailFooter", "emailBodyTemplate", "smsBodyTemplate", "smsFromNumber", "smsSenderId", "quietHoursEnabled", "quietStart", "quietEnd", "quietChannels", "emailLogoUrl", "emailBrandColor", "emailHeaderStyle", "emailBgColor"];
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of fields) if (k in b) patch[k] = b[k];
    const existing = await getOrCreateChannels(c);
    const [row] = await tx(c).update(schema.notificationChannels, patch as any, eq(schema.notificationChannels.id, existing.id));
    return c.json({ channels: row }, 200);
  })

  // ---- webhooks ----
  .get("/webhooks", requireAdmin, async (c) => {
    const rows = await tx(c).select(schema.webhookEndpoints);
    rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return c.json({ webhooks: rows }, 200);
  })
  .post("/webhooks", requireAdmin, async (c) => {
    const b = await c.req.json();
    const [w] = await tx(c).insert(schema.webhookEndpoints, {
      label: b.label || "",
      url: b.url,
      secret: b.secret || "",
      events: b.events || "*",
      active: b.active ?? true,
    });
    return c.json({ webhook: w }, 201);
  })
  .patch("/webhooks/:id", requireAdmin, async (c) => {
    const id = c.req.param("id");
    const b = await c.req.json();
    const patch: Record<string, unknown> = {};
    for (const k of ["label", "url", "secret", "events", "active"]) if (k in b) patch[k] = b[k];
    const [w] = await tx(c).update(schema.webhookEndpoints, patch as any, eq(schema.webhookEndpoints.id, id));
    return c.json({ webhook: w }, 200);
  })
  .delete("/webhooks/:id", requireAdmin, async (c) => {
    await tx(c).delete(schema.webhookEndpoints, eq(schema.webhookEndpoints.id, c.req.param("id")));
    return c.json({ ok: true }, 200);
  })
  // test-ping a webhook
  .post("/webhooks/:id/test", requireAdmin, async (c) => {
    const w = await tx(c).selectOne(schema.webhookEndpoints, eq(schema.webhookEndpoints.id, c.req.param("id")));
    if (!w) return c.json({ message: "not found" }, 404);
    try {
      const res = await fetch(w.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(w.secret ? { "X-Webhook-Secret": w.secret } : {}) },
        body: JSON.stringify({ event: "test", message: "NVC360 webhook test", at: new Date().toISOString() }),
      });
      return c.json({ ok: res.ok, status: res.status }, 200);
    } catch (e: any) {
      return c.json({ ok: false, error: e?.message }, 200);
    }
  })

  // ---- delivery log ----
  .get("/deliveries", requireAdmin, async (c) => {
    const event = c.req.query("event");
    const t = tx(c);
    const rows = event
      ? await t.select(schema.notificationDeliveries, eq(schema.notificationDeliveries.event, event))
      : await t.select(schema.notificationDeliveries);
    rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return c.json({ deliveries: rows.slice(0, 200) }, 200);
  })

  // ---- fire a test event against a real booking ----
  .post("/test/:event", requireAdmin, async (c) => {
    const event = c.req.param("event") as NvcEvent;
    const { bookingId } = await c.req.json().catch(() => ({}));
    let bid = bookingId;
    if (!bid) {
      const rows = await tx(c).select(schema.bookings);
      rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      bid = rows[0]?.id;
    }
    if (!bid) return c.json({ message: "no booking to test with" }, 400);
    await fireEvent(event, bid);
    return c.json({ ok: true, event, bookingId: bid }, 200);
  })

  // ---- email sending domains (tenant self-serve) ----
  // List the active company's submitted domains (+ parsed DNS records).
  .get("/email-domains", requireAdmin, async (c) => {
    const rows = await tx(c).select(schema.tenantEmailDomains);
    const domains = rows.map((r) => ({
      ...r,
      records: safeParse(r.records),
    }));
    domains.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return c.json({ domains, resendAvailable: resendAvailable() }, 200);
  })

  // Submit a new domain for approval (status starts "pending").
  .post("/email-domains", requireAdmin, async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const raw = String(body.domain || "").trim().toLowerCase();
    // strip scheme / path / leading "www." and any from-address local part
    const domain = raw
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/^.*@/, "")
      .replace(/^www\./, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain))
      return c.json({ message: "Enter a valid domain, e.g. mail.acme.com" }, 400);
    const existing = await tx(c).selectOne(
      schema.tenantEmailDomains,
      eq(schema.tenantEmailDomains.domain, domain),
    );
    if (existing) return c.json({ message: "Domain already submitted" }, 409);
    const user = c.get("user") as { id?: string } | undefined;
    const [row] = await tx(c).insert(schema.tenantEmailDomains, {
      domain,
      status: "pending",
      createdBy: user?.id || "",
    });
    return c.json({ domain: { ...row, records: [] } }, 201);
  })

  // Re-check verification with Resend (tenant "Check verification" button).
  .post("/email-domains/:id/check", requireAdmin, async (c) => {
    const id = c.req.param("id");
    const row = await tx(c).selectOne(
      schema.tenantEmailDomains,
      eq(schema.tenantEmailDomains.id, id),
    );
    if (!row) return c.json({ message: "not found" }, 404);
    if (!row.resendDomainId)
      return c.json({ message: "Awaiting approval — not yet created in Resend." }, 409);
    const updated = await triggerVerify(id);
    return c.json({ domain: { ...updated, records: safeParse(updated.records) } }, 200);
  })

  // Remove a domain (tenant-scoped; also removes it from Resend).
  .delete("/email-domains/:id", requireAdmin, async (c) => {
    const id = c.req.param("id");
    const row = await tx(c).selectOne(
      schema.tenantEmailDomains,
      eq(schema.tenantEmailDomains.id, id),
    );
    if (!row) return c.json({ message: "not found" }, 404);
    await removeDomain(id);
    return c.json({ ok: true }, 200);
  });

function safeParse(s: string | null | undefined) {
  try {
    return JSON.parse(s || "[]");
  } catch {
    return [];
  }
}
