import { Hono } from "hono";
import { requireAuth, tenantId } from "../middleware/auth";
import { parseRateModel, computeSubtotal, EMPTY_RATE_MODEL, type RateModel } from "../../shared/pricing";
import { lookupTax, taxRegionOptions } from "../../shared/tax";
import { quoteBooking } from "../../services/billing";

function coerceRateModel(input: any): RateModel {
  if (!input) return { ...EMPTY_RATE_MODEL };
  if (typeof input === "string") return parseRateModel(input) ?? { ...EMPTY_RATE_MODEL };
  return { ...EMPTY_RATE_MODEL, ...input };
}

export const pricingRoutes = new Hono()
  // tax region dropdown options (CA provinces + US states)
  .get("/regions", requireAuth, async (c) => {
    return c.json({ regions: taxRegionOptions() }, 200);
  })
  // live preview: given a rate model + region + actuals, return the breakdown w/ tax
  .post("/quote", requireAuth, async (c) => {
    const body = await c.req.json();
    const rm = coerceRateModel(body.rateModel);
    const actualMinutes = Number(body.actualMinutes ?? body.minutes ?? 0) || 0;
    const actualKm = Number(body.actualKm ?? body.km ?? 0) || 0;
    const { subtotal, items } = computeSubtotal(rm, actualMinutes, actualKm);
    const tax = lookupTax(body.region);
    const taxRatePct = tax?.rate ?? 0;
    const taxLabel = tax?.label ?? "";
    const taxAmount = Math.round(subtotal * taxRatePct) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;
    return c.json(
      { region: body.region ?? "", subtotal, taxRatePct, taxLabel, taxAmount, total, items },
      200
    );
  })
  // recompute/preview an existing booking from its current actuals (no persist)
  .get("/quote/:bookingId", requireAuth, async (c) => {
    const r = await quoteBooking(tenantId(c), c.req.param("bookingId"));
    if (!r) return c.json({ message: "Not found" }, 404);
    return c.json(r, 200);
  });
