/**
 * Shared catalog math. Single source of truth for item pricing, assembly
 * roll-ups, and work-order line-item totals. Used by backend (booking
 * recompute, catalog API) and frontend (catalog editor, work-order picker).
 *
 * Money is rounded to cents at every boundary to keep records reconcilable.
 */

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type CatalogKind = "service" | "product" | "assembly";
/** Line-item kind: catalog kinds plus ad-hoc per-unit lines added directly on a work order. */
export type LineKind = CatalogKind | "unit";
export type PriceMode = "auto" | "manual";

export interface AssemblyComponent {
  itemId: string;
  qty: number;
}

export interface CatalogItem {
  id: string;
  kind: CatalogKind;
  name: string;
  sku: string;
  category: string;
  description: string;
  image: string;
  unit: string;
  unitCost: number;
  markupPct: number;
  priceMode: PriceMode;
  unitPrice: number;
  taxable: boolean;
  components: AssemblyComponent[];
  active?: boolean;
}

/** Per-unit cost of an item. Assemblies sum their components' resolved cost. */
export function itemUnitCost(item: CatalogItem, lookup: (id: string) => CatalogItem | undefined): number {
  if (item.kind === "assembly") {
    let cost = 0;
    for (const c of item.components ?? []) {
      const child = lookup(c.itemId);
      if (!child) continue;
      cost += itemUnitCost(child, lookup) * (c.qty || 0);
    }
    return round2(cost);
  }
  return round2(item.unitCost || 0);
}

/** Per-unit customer price of an item.
 *  - auto:   cost * (1 + markup%)   (assemblies: roll up children's resolved price)
 *  - manual: explicit unitPrice     (assemblies: sum children's resolved price unless overridden) */
export function itemUnitPrice(item: CatalogItem, lookup: (id: string) => CatalogItem | undefined): number {
  if (item.kind === "assembly") {
    // assemblies roll up children's resolved price; a manual unitPrice (>0) overrides the roll-up
    if (item.priceMode === "manual" && item.unitPrice > 0) return round2(item.unitPrice);
    let price = 0;
    for (const c of item.components ?? []) {
      const child = lookup(c.itemId);
      if (!child) continue;
      price += itemUnitPrice(child, lookup) * (c.qty || 0);
    }
    return round2(price);
  }
  if (item.priceMode === "manual") return round2(item.unitPrice || 0);
  return round2((item.unitCost || 0) * (1 + (item.markupPct || 0) / 100));
}

/** Margin % = (price - cost) / price * 100. Returns 0 when price is 0. */
export function marginPct(cost: number, price: number): number {
  if (price <= 0) return 0;
  return round2(((price - cost) / price) * 100);
}

/** A resolved line item attached to a work order (snapshot — independent of later catalog edits). */
export interface LineItem {
  itemId: string;
  kind: LineKind;
  name: string;
  sku: string;
  unit: string;
  qty: number;
  unitCost: number;   // resolved per-unit cost at time of add (for "unit" lines: per-unit TECH PAY rate)
  unitPrice: number;  // resolved per-unit price at time of add (for "unit" lines: per-unit CUSTOMER CHARGE)
  taxable: boolean;
  cost: number;       // unitCost * qty  (for "unit" lines: total tech pay)
  price: number;      // unitPrice * qty (for "unit" lines: total customer charge)
  // for assemblies, the expanded child breakdown (display only)
  components?: { name: string; qty: number; unit: string; unitCost: number; unitPrice: number }[];
}

/** Build an ad-hoc per-unit line item (not from the catalog).
 *  Carries BOTH a customer charge rate (unitPrice) and a tech-pay rate (unitPayRate).
 *  A line with unitPrice = 0 is "pay-only" and won't appear on the customer invoice. */
export function buildUnitLineItem(input: {
  itemId?: string;
  name: string;
  unit: string;
  qty: number;
  unitPrice: number;   // customer charge per unit
  unitPayRate: number; // tech pay per unit
  taxable?: boolean;
}): LineItem {
  const q = input.qty || 0;
  const unitPrice = input.unitPrice || 0;
  const unitPayRate = input.unitPayRate || 0;
  return {
    itemId: input.itemId || `unit_${Math.random().toString(36).slice(2, 10)}`,
    kind: "unit",
    name: input.name || "Custom line",
    sku: "",
    unit: input.unit || "each",
    qty: q,
    unitCost: unitPayRate,
    unitPrice,
    taxable: input.taxable !== false,
    cost: round2(unitPayRate * q),
    price: round2(unitPrice * q),
  };
}

/** Build a line-item snapshot from a catalog item + quantity. */
export function buildLineItem(
  item: CatalogItem,
  qty: number,
  lookup: (id: string) => CatalogItem | undefined
): LineItem {
  const unitCost = itemUnitCost(item, lookup);
  const unitPrice = itemUnitPrice(item, lookup);
  const q = qty || 0;
  let components: LineItem["components"];
  if (item.kind === "assembly") {
    components = (item.components ?? []).map((c) => {
      const child = lookup(c.itemId);
      return {
        name: child?.name ?? "Unknown",
        qty: (c.qty || 0) * q,
        unit: child?.unit ?? "each",
        unitCost: child ? itemUnitCost(child, lookup) : 0,
        unitPrice: child ? itemUnitPrice(child, lookup) : 0,
      };
    });
  }
  return {
    itemId: item.id,
    kind: item.kind,
    name: item.name,
    sku: item.sku || "",
    unit: item.unit || "each",
    qty: q,
    unitCost,
    unitPrice,
    taxable: item.taxable !== false,
    cost: round2(unitCost * q),
    price: round2(unitPrice * q),
    components,
  };
}

export interface LineItemsTotals {
  cost: number;          // total COGS
  price: number;         // total customer price (pre-tax)
  taxablePrice: number;  // portion of price that is taxable
  margin: number;        // price - cost
  marginPct: number;
}

/** Sum a set of line items into totals used by billing + reporting. */
export function sumLineItems(items: LineItem[]): LineItemsTotals {
  let cost = 0;
  let price = 0;
  let taxablePrice = 0;
  for (const li of items ?? []) {
    cost += li.cost || 0;
    price += li.price || 0;
    if (li.taxable !== false) taxablePrice += li.price || 0;
  }
  cost = round2(cost);
  price = round2(price);
  taxablePrice = round2(taxablePrice);
  const margin = round2(price - cost);
  return { cost, price, taxablePrice, margin, marginPct: marginPct(cost, price) };
}

/** Total tech-pay contributed by ad-hoc per-unit lines (their `cost` field = tech pay). */
export function sumUnitLinePay(items: LineItem[]): number {
  let pay = 0;
  for (const li of items ?? []) {
    if (li.kind === "unit") pay += li.cost || 0;
  }
  return round2(pay);
}

/** Safe JSON parse of a line-items column. */
export function parseLineItems(json: string | null | undefined): LineItem[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Normalize a raw DB/catalog row into a typed CatalogItem (parses components). */
export function normalizeCatalogItem(row: any): CatalogItem {
  let components: AssemblyComponent[] = [];
  if (Array.isArray(row.components)) components = row.components;
  else if (typeof row.components === "string") {
    try { const a = JSON.parse(row.components); if (Array.isArray(a)) components = a; } catch { /* noop */ }
  }
  return {
    id: row.id,
    kind: (row.kind ?? "product") as CatalogKind,
    name: row.name ?? "",
    sku: row.sku ?? "",
    category: row.category ?? "General",
    description: row.description ?? "",
    image: row.image ?? "",
    unit: row.unit ?? "each",
    unitCost: row.unitCost ?? 0,
    markupPct: row.markupPct ?? 0,
    priceMode: (row.priceMode ?? "auto") as PriceMode,
    unitPrice: row.unitPrice ?? 0,
    taxable: row.taxable !== false,
    components,
    active: row.active !== false,
  };
}
