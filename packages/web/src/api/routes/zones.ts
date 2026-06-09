import { Hono } from "hono";
import * as schema from "../database/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin, tx } from "../middleware/auth";
import { audit } from "../lib/audit";

type SessionUser = { id: string; name?: string };

export const zonesRoutes = new Hono()
  .get("/", requireAuth, async (c) => {
    const rows = await tx(c).select(schema.serviceZones);
    return c.json({ zones: rows.map((z) => ({ ...z, polygon: JSON.parse(z.polygon || "[]") })) }, 200);
  })
  .post("/", requireAdmin, async (c) => {
    const me = c.get("user") as SessionUser;
    const b = await c.req.json();
    if (!b.name) return c.json({ message: "name required" }, 400);
    const [zone] = await tx(c).insert(schema.serviceZones, {
      name: b.name,
      color: b.color || "#06B6D4",
      polygon: JSON.stringify(b.polygon ?? []),
      surgeMultiplier: b.surgeMultiplier ?? 1,
      active: b.active ?? true,
    });
    await audit({ actorId: me?.id, actorName: me?.name, action: "create", entityType: "service_zone", entityId: zone.id, summary: `Created zone "${b.name}"` });
    return c.json({ zone: { ...zone, polygon: JSON.parse(zone.polygon) } }, 201);
  })
  .put("/:id", requireAdmin, async (c) => {
    const id = c.req.param("id");
    const b = await c.req.json();
    const patch: Record<string, unknown> = {};
    for (const k of ["name", "color", "surgeMultiplier", "active"]) if (k in b) patch[k] = b[k];
    if ("polygon" in b) patch.polygon = JSON.stringify(b.polygon ?? []);
    const [zone] = await tx(c).update(
      schema.serviceZones,
      patch as Partial<typeof schema.serviceZones.$inferInsert>,
      eq(schema.serviceZones.id, id),
    );
    return c.json({ zone: { ...zone, polygon: JSON.parse(zone.polygon) } }, 200);
  })
  .delete("/:id", requireAdmin, async (c) => {
    const me = c.get("user") as SessionUser;
    const id = c.req.param("id");
    await tx(c).delete(schema.serviceZones, eq(schema.serviceZones.id, id));
    await audit({ actorId: me?.id, actorName: me?.name, action: "delete", entityType: "service_zone", entityId: id, summary: "Deleted zone" });
    return c.json({ ok: true }, 200);
  });
