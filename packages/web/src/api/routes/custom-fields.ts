import { Hono } from "hono";
import * as schema from "../database/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin, tx } from "../middleware/auth";
import { audit } from "../lib/audit";

type SessionUser = { id: string; name?: string };

export const customFieldsRoutes = new Hono()
  // list field definitions for an entity type: client | tech | work_order
  .get("/", requireAuth, async (c) => {
    const entity = c.req.query("entity");
    let rows = await tx(c).select(schema.customFields);
    rows.sort((a, b) => a.sortOrder - b.sortOrder);
    if (entity) rows = rows.filter((f) => f.entity === entity);
    return c.json({ fields: rows }, 200);
  })
  .post("/", requireAdmin, async (c) => {
    const me = c.get("user") as SessionUser;
    const b = await c.req.json();
    if (!b.entity || !b.label) return c.json({ message: "entity and label required" }, 400);
    const existing = await tx(c).select(
      schema.customFields,
      eq(schema.customFields.entity, b.entity),
    );
    const [field] = await tx(c).insert(schema.customFields, {
      entity: b.entity,
      label: b.label,
      type: b.type || "text",
      options: JSON.stringify(b.options ?? []),
      placeholder: b.placeholder ?? "",
      required: !!b.required,
      section: b.section || "General",
      sortOrder: b.sortOrder ?? existing.length,
    });
    await audit({ actorId: me?.id, actorName: me?.name, action: "create", entityType: "custom_field", entityId: field.id, summary: `Added field "${b.label}" to ${b.entity}` });
    return c.json({ field }, 201);
  })
  .put("/:id", requireAdmin, async (c) => {
    const id = c.req.param("id");
    const b = await c.req.json();
    const patch: Record<string, unknown> = {};
    for (const k of ["label", "type", "placeholder", "required", "section", "sortOrder", "active"]) {
      if (k in b) patch[k] = b[k];
    }
    if ("options" in b) patch.options = JSON.stringify(b.options ?? []);
    const [field] = await tx(c).update(
      schema.customFields,
      patch as Partial<typeof schema.customFields.$inferInsert>,
      eq(schema.customFields.id, id),
    );
    return c.json({ field }, 200);
  })
  .delete("/:id", requireAdmin, async (c) => {
    const me = c.get("user") as SessionUser;
    const id = c.req.param("id");
    await tx(c).delete(schema.customFields, eq(schema.customFields.id, id));
    await audit({ actorId: me?.id, actorName: me?.name, action: "delete", entityType: "custom_field", entityId: id, summary: "Removed custom field" });
    return c.json({ ok: true }, 200);
  })
  // get stored values for an entity instance
  .get("/values/:type/:id", requireAuth, async (c) => {
    const entityType = c.req.param("type");
    const entityId = c.req.param("id");
    const rows = await tx(c).select(
      schema.customFieldValues,
      and(
        eq(schema.customFieldValues.entityType, entityType),
        eq(schema.customFieldValues.entityId, entityId),
      ),
    );
    const map: Record<string, string> = {};
    for (const r of rows) map[r.fieldId] = r.value;
    return c.json({ values: map }, 200);
  })
  // upsert values for an entity instance
  .put("/values/:type/:id", requireAuth, async (c) => {
    const entityType = c.req.param("type");
    const entityId = c.req.param("id");
    const { values } = (await c.req.json()) as { values: Record<string, string> };
    const fieldIds = Object.keys(values || {});
    if (fieldIds.length) {
      const t = tx(c);
      const existing = await t.select(
        schema.customFieldValues,
        and(
          eq(schema.customFieldValues.entityType, entityType),
          eq(schema.customFieldValues.entityId, entityId),
          inArray(schema.customFieldValues.fieldId, fieldIds),
        ),
      );
      const existingMap = new Map(existing.map((e) => [e.fieldId, e.id]));
      for (const fid of fieldIds) {
        if (existingMap.has(fid)) {
          await t.update(
            schema.customFieldValues,
            { value: values[fid], updatedAt: new Date() },
            eq(schema.customFieldValues.id, existingMap.get(fid)!),
          );
        } else {
          await t.insert(schema.customFieldValues, {
            fieldId: fid,
            entityType,
            entityId,
            value: values[fid],
            updatedAt: new Date(),
          });
        }
      }
    }
    return c.json({ ok: true }, 200);
  });
