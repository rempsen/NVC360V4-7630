/**
 * Shared pricing + tax engine. Used by backend (work order create/recompute,
 * payouts) and frontend (live price preview in form builder + work order modal).
 *
 * Fully flexible RateModel — every component optional, mix and match:
 *  - flatRate: fixed $ that INCLUDES includedMinutes + includedKm
 *  - timeRate: $ per unit (minute|hour) billed for time beyond includedMinutes
 *  - kmRate:   $ per km billed for distance beyond includedKm
 * Pure per-minute / per-hour / per-km models = set flatRate 0 and included* 0.
 */

export type TimeUnit = "minute" | "hour";

export interface RateModel {
  flatRate: number;          // $ base charge
  includedMinutes: number;   // minutes covered by flat rate
  includedKm: number;        // km covered by flat rate
  timeRate: number;          // $ per timeUnit after included time
  timeUnit: TimeUnit;        // minute | hour
  kmRate: number;            // $ per km after included km
  minCharge: number;         // optional floor for the subtotal (0 = none)
}

export const EMPTY_RATE_MODEL: RateModel = {
  flatRate: 0,
  includedMinutes: 0,
  includedKm: 0,
  timeRate: 0,
  timeUnit: "hour",
  kmRate: 0,
  minCharge: 0,
};

export function parseRateModel(json: string | null | undefined): RateModel | null {
  if (!json) return null;
  try {
    const o = JSON.parse(json);
    return { ...EMPTY_RATE_MODEL, ...o };
  } catch {
    return null;
  }
}

export interface PriceLineItem {
  label: string;
  qty: number;
  unit: string;
  rate: number;
  amount: number;
}

export interface PriceResult {
  subtotal: number;
  items: PriceLineItem[];
}

/** Compute the client subtotal (pre-tax) given a rate model + actuals. */
export function computeSubtotal(
  rm: RateModel,
  actualMinutes: number,
  actualKm: number
): PriceResult {
  const items: PriceLineItem[] = [];
  const round = (n: number) => Math.round(n * 100) / 100;

  if (rm.flatRate > 0) {
    const incl: string[] = [];
    if (rm.includedMinutes > 0) incl.push(`${rm.includedMinutes} min`);
    if (rm.includedKm > 0) incl.push(`${rm.includedKm} km`);
    items.push({
      label: incl.length ? `Flat rate (incl. ${incl.join(" + ")})` : "Flat rate",
      qty: 1,
      unit: "job",
      rate: rm.flatRate,
      amount: round(rm.flatRate),
    });
  }

  // time overage
  if (rm.timeRate > 0) {
    const billableMin = Math.max(0, actualMinutes - rm.includedMinutes);
    if (rm.timeUnit === "hour") {
      const hrs = round(billableMin / 60);
      if (hrs > 0)
        items.push({ label: "Additional time", qty: hrs, unit: "hr", rate: rm.timeRate, amount: round(hrs * rm.timeRate) });
    } else {
      if (billableMin > 0)
        items.push({ label: "Additional time", qty: round(billableMin), unit: "min", rate: rm.timeRate, amount: round(billableMin * rm.timeRate) });
    }
  }

  // km overage
  if (rm.kmRate > 0) {
    const billableKm = round(Math.max(0, actualKm - rm.includedKm));
    if (billableKm > 0)
      items.push({ label: "Mileage", qty: billableKm, unit: "km", rate: rm.kmRate, amount: round(billableKm * rm.kmRate) });
  }

  let subtotal = round(items.reduce((s, i) => s + i.amount, 0));
  if (rm.minCharge > 0 && subtotal < rm.minCharge) {
    items.push({ label: "Minimum charge adjustment", qty: 1, unit: "", rate: 0, amount: round(rm.minCharge - subtotal) });
    subtotal = rm.minCharge;
  }
  return { subtotal, items };
}

/** Human-readable one-line summary of a rate model (for cards/lists). */
export function describeRateModel(rm: RateModel): string {
  const parts: string[] = [];
  if (rm.flatRate > 0) {
    let s = `$${rm.flatRate.toFixed(2)} flat`;
    const inc: string[] = [];
    if (rm.includedMinutes) inc.push(`${rm.includedMinutes}m`);
    if (rm.includedKm) inc.push(`${rm.includedKm}km`);
    if (inc.length) s += ` (incl ${inc.join("/")})`;
    parts.push(s);
  }
  if (rm.timeRate > 0) parts.push(`+$${rm.timeRate.toFixed(2)}/${rm.timeUnit === "hour" ? "hr" : "min"}`);
  if (rm.kmRate > 0) parts.push(`+$${rm.kmRate.toFixed(2)}/km`);
  if (!parts.length) return "No pricing set";
  return parts.join(" ");
}
