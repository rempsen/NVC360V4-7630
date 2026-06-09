/**
 * Enforced tenant-scoped database access.
 *
 * The core risk with hand-applied `companyId` filters is that the NEXT query a
 * developer writes is one forgotten `.where()` away from leaking across tenants.
 * This module removes that footgun: `tdb(companyId)` returns a thin wrapper whose
 * read/write builders AUTOMATICALLY constrain to the active company for every
 * tenant-owned table — and refuse to touch a tenant table without a companyId.
 *
 * Global tables (role catalog, idempotency keys) are explicitly allow-listed and
 * pass through unscoped.
 *
 * Usage:
 *   const t = tdb(tenantId(c));
 *   const rows = await t.select(schema.services);                 // auto WHERE company_id = ?
 *   const rows = await t.select(schema.services, eq(schema.services.active, true)); // ANDed
 *   const [row] = await t.insert(schema.services, { name: "X" });  // company_id stamped
 *   await t.update(schema.services, { active: false }, eq(schema.services.id, id)); // scoped
 *   await t.delete(schema.services, eq(schema.services.id, id));   // scoped
 *
 * Escape hatch: `db` (the raw drizzle client) is still exported from ./index for
 * the rare cross-tenant/system path (migrations, retention sweeps, webhooks that
 * resolve their own tenant). Those call sites are intentionally explicit.
 */
import { and, eq, type SQL } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { db } from "./index";

/**
 * Tables that are GLOBAL (not tenant-owned). Reads/writes pass through unscoped.
 * Everything else MUST carry a `companyId` column and is auto-scoped.
 */
const GLOBAL_TABLES = new Set<string>([
  "role_permissions", // shared role->permission catalog
  "idempotency_keys", // payment/webhook dedup, keyed by provider event id
  "companies", // GLOBAL tenant registry / allow-list (managed by superadmin)
  "oauth_app_credentials", // GLOBAL platform OAuth app keys (managed by superadmin)
  // better-auth managed tables — auth owns their lifecycle; tenant lives on `user`
  "user",
  "session",
  "account",
  "verification",
]);

/** Drizzle exposes the SQL table name via this internal symbol. */
function tableName(table: SQLiteTable): string {
  // drizzle-orm stores the name on a well-known symbol; fall back defensively.
  const sym = Object.getOwnPropertySymbols(table).find(
    (s) => s.description === "drizzle:Name",
  );
  return sym ? ((table as unknown as Record<symbol, string>)[sym] ?? "") : "";
}

function isGlobal(table: SQLiteTable): boolean {
  return GLOBAL_TABLES.has(tableName(table));
}

/** The companyId column for a tenant table, or throws (fail-closed). */
function companyCol(table: SQLiteTable) {
  const col = (table as unknown as Record<string, unknown>)["companyId"];
  if (!col) {
    throw new Error(
      `tenant scope error: table "${tableName(table)}" has no companyId column. ` +
        `Add it to the schema or allow-list it in GLOBAL_TABLES.`,
    );
  }
  return col as Parameters<typeof eq>[0];
}

export interface TenantDb {
  companyId: string;
  /** SELECT * FROM table WHERE company_id = ? [AND extra]. Returns the rows. */
  select<T extends SQLiteTable>(table: T, extra?: SQL): Promise<T["$inferSelect"][]>;
  /** First matching row or undefined. */
  selectOne<T extends SQLiteTable>(table: T, extra?: SQL): Promise<T["$inferSelect"] | undefined>;
  /** INSERT with company_id auto-stamped. Returns inserted rows. */
  insert<T extends SQLiteTable>(
    table: T,
    values: Partial<T["$inferInsert"]> | Partial<T["$inferInsert"]>[],
  ): Promise<T["$inferSelect"][]>;
  /** UPDATE ... WHERE company_id = ? [AND extra]. */
  update<T extends SQLiteTable>(
    table: T,
    values: Partial<T["$inferInsert"]>,
    extra?: SQL,
  ): Promise<T["$inferSelect"][]>;
  /** DELETE WHERE company_id = ? [AND extra]. */
  delete<T extends SQLiteTable>(table: T, extra?: SQL): Promise<void>;
  /** Build the tenant predicate to AND into a hand-written query. */
  scope<T extends SQLiteTable>(table: T, extra?: SQL): SQL | undefined;
  /** The raw drizzle client — explicit escape hatch for system/cross-tenant work. */
  raw: typeof db;
}

/** Create a tenant-bound DB facade. `companyId` must be a resolved tenant id. */
export function tdb(companyId: string): TenantDb {
  if (!companyId) throw new Error("tdb: companyId is required (fail-closed)");

  function scope<T extends SQLiteTable>(table: T, extra?: SQL): SQL | undefined {
    if (isGlobal(table)) return extra;
    const base = eq(companyCol(table), companyId);
    return extra ? and(base, extra) : base;
  }

  return {
    companyId,
    raw: db,
    scope,

    async select(table, extra) {
      const where = scope(table, extra);
      const q = db.select().from(table as SQLiteTable);
      return (where ? await q.where(where) : await q) as never;
    },

    async selectOne(table, extra) {
      const where = scope(table, extra);
      const q = db.select().from(table as SQLiteTable);
      const rows = where ? await q.where(where).limit(1) : await q.limit(1);
      return rows[0] as never;
    },

    async insert(table, values) {
      const stamp = (v: Record<string, unknown>) =>
        isGlobal(table) ? v : { ...v, companyId };
      const payload = Array.isArray(values)
        ? values.map((v) => stamp(v as Record<string, unknown>))
        : stamp(values as Record<string, unknown>);
      return (await db
        .insert(table as SQLiteTable)
        .values(payload as never)
        .returning()) as never;
    },

    async update(table, values, extra) {
      const where = scope(table, extra);
      // never allow companyId to be reassigned through update
      const safe = { ...(values as Record<string, unknown>) };
      delete safe.companyId;
      const q = db.update(table as SQLiteTable).set(safe as never);
      return (where ? await q.where(where).returning() : await q.returning()) as never;
    },

    async delete(table, extra) {
      const where = scope(table, extra);
      const q = db.delete(table as SQLiteTable);
      if (where) await q.where(where);
      else await q;
    },
  };
}
