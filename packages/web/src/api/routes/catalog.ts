import { Hono } from "hono";
import * as schema from "../database/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, tx } from "../middleware/auth";
import { audit } from "../lib/audit";
import { putObject } from "../lib/storage";
import {
  normalizeCatalogItem,
  itemUnitCost,
  itemUnitPrice,
  marginPct,
  type CatalogItem,
} from "../../shared/catalog";

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Decorate a raw row with resolved cost/price/margin (assemblies rolled up). */
function decorate(rows: (typeof schema.catalogItems.$inferSelect)[]) {
  const items: CatalogItem[] = rows.map(normalizeCatalogItem);
  const byId = new Map(items.map((i) => [i.id, i]));
  const lookup = (id: string) => byId.get(id);
  return rows.map((r) => {
    const it = normalizeCatalogItem(r);
    const cost = itemUnitCost(it, lookup);
    const price = itemUnitPrice(it, lookup);
    return {
      ...r,
      components: it.components,
      resolvedUnitCost: cost,
      resolvedUnitPrice: price,
      resolvedMarginPct: marginPct(cost, price),
    };
  });
}

function normComponents(v: unknown): string {
  if (Array.isArray(v)) return JSON.stringify(v);
  if (typeof v === "string") {
    try { const a = JSON.parse(v); return Array.isArray(a) ? JSON.stringify(a) : "[]"; } catch { return "[]"; }
  }
  return "[]";
}

export const catalogRoutes = new Hono()
  // list (optionally filter by kind + search)
  .get("/", async (c) => {
    const kind = c.req.query("kind");
    const q = (c.req.query("q") || "").toLowerCase();
    const includeInactive = c.req.query("all") === "1";
    let rows = await tx(c).select(schema.catalogItems);
    rows = rows.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
    if (!includeInactive) rows = rows.filter((r) => r.active);
    if (kind && kind !== "all") rows = rows.filter((r) => r.kind === kind);
    if (q)
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.sku.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q)
      );
    return c.json({ items: decorate(rows) }, 200);
  })
  // single item (with resolved math)
  .get("/:id", async (c) => {
    const row = await tx(c).selectOne(schema.catalogItems, eq(schema.catalogItems.id, c.req.param("id")));
    if (!row) return c.json({ message: "Not found" }, 404);
    const [dec] = decorate([row]);
    return c.json({ item: dec }, 200);
  })
  // create
  .post("/", requireAdmin, async (c) => {
    const b = await c.req.json();
    const [row] = await tx(c).insert(schema.catalogItems, {
      kind: b.kind ?? "product",
      name: b.name,
      sku: b.sku ?? "",
      category: b.category ?? "General",
      description: b.description ?? "",
      image: b.image ?? "",
      unit: b.unit ?? "each",
      unitCost: b.unitCost ?? 0,
      markupPct: b.markupPct ?? 0,
      priceMode: b.priceMode ?? "auto",
      unitPrice: b.unitPrice ?? 0,
      taxable: b.taxable !== false,
      components: normComponents(b.components),
      serviceId: b.serviceId ?? null,
    });
    await audit(c, "create", "catalog_item", row.id, `Created ${row.kind} "${row.name}"`);
    const [dec] = decorate([row]);
    return c.json({ item: dec }, 201);
  })
  // update
  .patch("/:id", requireAdmin, async (c) => {
    const b = await c.req.json();
    const set: Record<string, unknown> = { ...b };
    if (b.components !== undefined) set.components = normComponents(b.components);
    delete set.id;
    delete set.createdAt;
    delete set.companyId;
    delete set.resolvedUnitCost;
    delete set.resolvedUnitPrice;
    delete set.resolvedMarginPct;
    const [row] = await tx(c).update(
      schema.catalogItems,
      set as Partial<typeof schema.catalogItems.$inferInsert>,
      eq(schema.catalogItems.id, c.req.param("id")),
    );
    if (!row) return c.json({ message: "Not found" }, 404);
    await audit(c, "update", "catalog_item", row.id, `Updated "${row.name}"`);
    const [dec] = decorate([row]);
    return c.json({ item: dec }, 200);
  })
  // soft delete
  .delete("/:id", requireAdmin, async (c) => {
    const [row] = await tx(c).update(
      schema.catalogItems,
      { active: false },
      eq(schema.catalogItems.id, c.req.param("id")),
    );
    if (row) await audit(c, "delete", "catalog_item", row.id, `Archived "${row.name}"`);
    return c.json({ success: true }, 200);
  })
  // image upload (multipart: file)
  .post("/:id/image", requireAdmin, async (c) => {
    const id = c.req.param("id");
    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return c.json({ message: "No file" }, 400);
    if (file.size > MAX_BYTES) return c.json({ message: "File too large (max 15MB)" }, 400);
    if (file.type && !ALLOWED.includes(file.type))
      return c.json({ message: `Unsupported type ${file.type}` }, 400);
    const ext = (file.name.split(".").pop() || "png").toLowerCase().slice(0, 8);
    const key = `catalog/${id}/${crypto.randomUUID()}.${ext}`;
    const stored = await putObject(
      key,
      Buffer.from(await file.arrayBuffer()),
      file.type || "image/png",
    );
    await tx(c).update(schema.catalogItems, { image: stored.url }, eq(schema.catalogItems.id, id));
    return c.json({ url: stored.url }, 200);
  })
  // distinct categories (for filters)
  .get("/meta/categories", async (c) => {
    const rows = await tx(c).select(schema.catalogItems, eq(schema.catalogItems.active, true));
    const cats = Array.from(new Set(rows.map((r) => r.category))).filter(Boolean).sort();
    return c.json({ categories: cats }, 200);
  })
  // migrate legacy services → catalog (idempotent: skips already-migrated by serviceId)
  .post("/seed-from-services", requireAdmin, async (c) => {
    const t = tx(c);
    const services = await t.select(schema.services);
    const existing = await t.select(schema.catalogItems);
    const migrated = new Set(existing.map((e) => e.serviceId).filter(Boolean));
    let created = 0;
    for (const s of services) {
      if (migrated.has(s.id)) continue;
      await t.insert(schema.catalogItems, {
        kind: "service",
        name: s.name,
        category: s.category || "General",
        description: s.description || "",
        image: s.image || "",
        unit: "job",
        unitCost: 0,
        markupPct: 0,
        priceMode: "manual",
        unitPrice: s.basePrice || 0,
        taxable: true,
        serviceId: s.id,
      });
      created++;
    }
    return c.json({ created, total: services.length }, 200);
  });
