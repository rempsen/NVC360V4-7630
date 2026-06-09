# Starter Catalog Seeding (15 industries × 12+ items)

## Goal
Every new company pre-populated with ≥12 catalog_items (mix service/product/assembly),
accurate CAD wholesale unitCost + markup → auto price, image on each.
Plus ≥3 starter templates (already done via template-scout).
Backfill existing tenants with empty catalogs.

## Decisions
- Currency: CAD cost (wholesale/COGS), USD-equiv note in description.
- Pricing: priceMode=auto, unitCost=COGS, markupPct set per item → customer price.
- Images: web photos for products, generated for abstract services. Store URL in `image`.
- Mix: services + products + assemblies each industry.
- Apply: new companies (superadmin create) + backfill existing empty-catalog tenants.

## Schema target: catalog_items
{kind(service|product|assembly), name, sku, category, description, image, unit,
 unitCost, markupPct, priceMode=auto, unitPrice, taxable, components[], active}

## Industries (15)
hvac, plumbing, electrical, restoration, appliance, courier, security, telecom,
roofing, landscaping, construction, waste, utility, healthcare, municipal

## Plan
1. [ ] Build src/services/catalog-presets.ts — CATALOG_PRESETS[industry] = 12+ items.
2. [ ] Source images (web for products; generate for services) → store URLs.
3. [ ] Seed block in superadmin.ts (2f) inserting catalog_items per preset.
4. [ ] Backfill script for existing empty-catalog tenants.
5. [ ] tsc + oxlint + vite build + restart + verify in catalog UI.

## Image strategy
- Use upload command to host generated service images; web image URLs used directly
  if hotlinkable & stable, else download+upload to our storage for reliability.
- Need stable URLs (catalog renders <img src>). Prefer uploading to our bucket.
