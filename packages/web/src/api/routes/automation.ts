import { Hono } from "hono";
import * as schema from "../database/schema";
import { eq } from "drizzle-orm";
import { requireAuth, tx } from "../middleware/auth";

export const automationRoutes = new Hono()
  .get("/", requireAuth, async (c) => {
    const rows = await tx(c).select(schema.automationRules);
    return c.json({ rules: rows }, 200);
  })
  .post("/", requireAuth, async (c) => {
    const b = await c.req.json();
    const [r] = await tx(c).insert(schema.automationRules, {
      name: b.name,
      description: b.description ?? "",
      trigger: b.trigger,
      conditions: JSON.stringify(b.conditions ?? {}),
      action: b.action,
      actionConfig: JSON.stringify(b.actionConfig ?? {}),
      enabled: b.enabled ?? true,
    });
    return c.json({ rule: r }, 201);
  })
  .patch("/:id", requireAuth, async (c) => {
    const b = await c.req.json();
    const set: any = {};
    for (const k of ["name", "description", "trigger", "action", "enabled"])
      if (b[k] !== undefined) set[k] = b[k];
    if (b.conditions !== undefined) set.conditions = JSON.stringify(b.conditions);
    if (b.actionConfig !== undefined)
      set.actionConfig = JSON.stringify(b.actionConfig);
    const [r] = await tx(c).update(
      schema.automationRules,
      set,
      eq(schema.automationRules.id, c.req.param("id")),
    );
    return c.json({ rule: r }, 200);
  })
  .delete("/:id", requireAuth, async (c) => {
    await tx(c).delete(
      schema.automationRules,
      eq(schema.automationRules.id, c.req.param("id")),
    );
    return c.json({ ok: true }, 200);
  });
