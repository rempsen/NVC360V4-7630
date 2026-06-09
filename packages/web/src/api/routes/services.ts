import { Hono } from "hono";
import * as schema from "../database/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, tx } from "../middleware/auth";

export const servicesRoutes = new Hono()
  .get("/", async (c) => {
    const t = tx(c);
    const list = (await t.select(schema.services, eq(schema.services.active, true)))
      .sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
    return c.json({ services: list }, 200);
  })
  .get("/:id", async (c) => {
    const svc = await tx(c).selectOne(schema.services, eq(schema.services.id, c.req.param("id")));
    if (!svc) return c.json({ message: "Not found" }, 404);
    return c.json({ service: svc }, 200);
  })
  .post("/", requireAdmin, async (c) => {
    const body = await c.req.json();
    const [svc] = await tx(c).insert(schema.services, {
      name: body.name,
      category: body.category,
      description: body.description ?? "",
      icon: body.icon ?? "wrench",
      image: body.image ?? "",
      basePrice: body.basePrice ?? 0,
      durationMins: body.durationMins ?? 60,
      rateModel:
        body.rateModel !== undefined
          ? typeof body.rateModel === "string"
            ? body.rateModel
            : JSON.stringify(body.rateModel)
          : "",
    });
    return c.json({ service: svc }, 201);
  })
  .patch("/:id", requireAdmin, async (c) => {
    const body = await c.req.json();
    const set: any = { ...body };
    // never allow a write to move a service to another tenant
    delete set.companyId;
    if (body.rateModel !== undefined)
      set.rateModel =
        typeof body.rateModel === "string" ? body.rateModel : JSON.stringify(body.rateModel);
    const [svc] = await tx(c).update(schema.services, set, eq(schema.services.id, c.req.param("id")));
    if (!svc) return c.json({ message: "Not found" }, 404);
    return c.json({ service: svc }, 200);
  })
  .delete("/:id", requireAdmin, async (c) => {
    await tx(c).update(schema.services, { active: false }, eq(schema.services.id, c.req.param("id")));
    return c.json({ success: true }, 200);
  });
