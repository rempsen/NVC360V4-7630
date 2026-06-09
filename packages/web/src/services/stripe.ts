import Stripe from "stripe";
import { log } from "../api/lib/logger";

/**
 * Stripe client (lazily constructed). Real test keys live in env:
 *   STRIPE_SECRET_KEY        — sk_test_…
 *   STRIPE_PUBLISHABLE_KEY   — pk_test_… (sent to the browser)
 *   STRIPE_WEBHOOK_SECRET    — whsec_…  (from `stripe listen` / dashboard)
 *
 * If STRIPE_SECRET_KEY is absent we fall back to a clearly-flagged disabled
 * client so dev environments boot without payments configured.
 */

const SECRET = process.env.STRIPE_SECRET_KEY ?? "";
export const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY ?? "";
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

export const stripeEnabled = SECRET.startsWith("sk_");

let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (!stripeEnabled) {
    throw new Error("Stripe is not configured (STRIPE_SECRET_KEY missing)");
  }
  if (!_stripe) {
    _stripe = new Stripe(SECRET, {
      apiVersion: "2025-09-30.clover",
      typescript: true,
      appInfo: { name: "NVC360", version: "1.0.0" },
    });
    log.info("stripe client initialized", { livemode: SECRET.startsWith("sk_live") });
  }
  return _stripe;
}

/** Stripe works in the smallest currency unit (cents). Convert both ways. */
export function toMinor(amount: number): number {
  return Math.round(amount * 100);
}
export function fromMinor(minor: number): number {
  return Math.round(minor) / 100;
}
