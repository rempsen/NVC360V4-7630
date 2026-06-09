import { Hono } from "hono";
import * as schema from "../database/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin, tx } from "../middleware/auth";
import { audit } from "../lib/audit";

type SessionUser = { id: string; name?: string };

export const tagsRoutes = new Hono()
  // list all tags (optional ?scope=client|tech)
  .get("/", requireAuth, async (c) => {
    const scope = c.req.query("scope");
    const rows = await tx(c).select(schema.tags);
    const filtered = scope
      ? rows.filter((t) => t.scope === scope || t.scope === "both")
      : rows;
    return c.json({ tags: filtered }, 200);
  })
  .post("/", requireAdmin, async (c) => {
    const me = c.get("user") as SessionUser;
    const { label, color, scope } = await c.req.json();
    if (!label) return c.json({ message: "Label required" }, 400);
    const [tag] = await tx(c).insert(schema.tags, {
      label,
      color: color || "#06B6D4",
      scope: scope || "both",
    });
    await audit({ actorId: me?.id, actorName: me?.name, action: "create", entityType: "tag", entityId: tag.id, summary: `Created tag "${label}"` });
    return c.json({ tag }, 201);
  })
  .put("/:id", requireAdmin, async (c) => {
    const id = c.req.param("id");
    const { label, color, scope } = await c.req.json();
    const [tag] = await tx(c).update(
      schema.tags,
      { ...(label && { label }), ...(color && { color }), ...(scope && { scope }) },
      eq(schema.tags.id, id),
    );
    return c.json({ tag }, 200);
  })
  .delete("/:id", requireAdmin, async (c) => {
    const me = c.get("user") as SessionUser;
    const id = c.req.param("id");
    await tx(c).delete(schema.tags, eq(schema.tags.id, id));
    await audit({ actorId: me?.id, actorName: me?.name, action: "delete", entityType: "tag", entityId: id, summary: "Deleted tag" });
    return c.json({ ok: true }, 200);
  })
  // tags assigned to an entity
  .get("/entity/:type/:id", requireAuth, async (c) => {
    const entityType = c.req.param("type");
    const entityId = c.req.param("id");
    const t = tx(c);
    const links = await t.select(
      schema.entityTags,
      and(eq(schema.entityTags.entityType, entityType), eq(schema.entityTags.entityId, entityId)),
    );
    if (links.length === 0) return c.json({ tags: [] }, 200);
    const tagIds = links.map((l) => l.tagId);
    const tagRows = await t.select(schema.tags, inArray(schema.tags.id, tagIds));
    return c.json({ tags: tagRows }, 200);
  })
  // set the full tag list for an entity (replace)
  .put("/entity/:type/:id", requireAdmin, async (c) => {
    const entityType = c.req.param("type");
    const entityId = c.req.param("id");
    const { tagIds } = (await c.req.json()) as { tagIds: string[] };
    const t = tx(c);
    await t.delete(
      schema.entityTags,
      and(eq(schema.entityTags.entityType, entityType), eq(schema.entityTags.entityId, entityId)),
    );
    if (Array.isArray(tagIds) && tagIds.length) {
      await t.insert(
        schema.entityTags,
        tagIds.map((tagId) => ({ tagId, entityType, entityId })),
      );
    }
    return c.json({ ok: true }, 200);
  });
