/**
 * Twilio SMS service — real send via Twilio REST API (no SDK, just fetch).
 * Gracefully no-ops (logs only) when env is not configured.
 */

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const FROM = process.env.TWILIO_FROM_NUMBER;

// API Key auth (preferred): SK SID + Secret for Basic auth, AC Account SID in URL.
const API_KEY_SID = process.env.TWILIO_API_KEY_SID;
const API_KEY_SECRET = process.env.TWILIO_API_KEY_SECRET;
// Legacy: Auth Token used directly with Account SID for Basic auth.
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

// Username:password pair used for Basic auth.
const BASIC_USER = API_KEY_SID || ACCOUNT_SID;
const BASIC_PASS = API_KEY_SECRET || AUTH_TOKEN;

export const smsConfigured = Boolean(ACCOUNT_SID && FROM && BASIC_USER && BASIC_PASS);

export interface SmsResult {
  ok: boolean;
  sid?: string;
  skipped?: boolean;
  error?: string;
}

/** Normalize a phone number to E.164-ish (very light). */
function normalize(phone: string): string {
  const p = phone.trim();
  if (p.startsWith("+")) return p;
  const digits = p.replace(/[^0-9]/g, "");
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  return "+" + digits;
}

export async function sendSms(to: string, body: string): Promise<SmsResult> {
  if (!smsConfigured) {
    console.log(`[sms:skip] would text ${to}: ${body}`);
    return { ok: false, skipped: true };
  }
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`;
    const params = new URLSearchParams({
      To: normalize(to),
      From: FROM!,
      Body: body,
    });
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${BASIC_USER}:${BASIC_PASS}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const json: any = await res.json();
    if (!res.ok) {
      console.error("[sms:error]", json?.message ?? res.status);
      return { ok: false, error: json?.message ?? `HTTP ${res.status}` };
    }
    console.log(`[sms:sent] ${to} sid=${json.sid}`);
    return { ok: true, sid: json.sid };
  } catch (e: any) {
    console.error("[sms:exception]", e?.message);
    return { ok: false, error: e?.message };
  }
}

const SITE = (process.env.WEBSITE_URL || process.env.APP_URL || "http://localhost:4200").replace(/\/$/, "");

export function trackingUrl(token: string): string {
  return `${SITE}/t/${token}`;
}

/** "Tech on the way" message with live tracking link. */
export function enrouteSms(opts: {
  techName: string;
  token: string;
  etaMins?: number | null;
  company?: string;
}): string {
  const eta = opts.etaMins ? ` ETA ~${opts.etaMins} min.` : "";
  const co = opts.company || "NVC360";
  return `${co}: Your technician ${opts.techName} is on the way!${eta} Track live, see ETA & message them: ${trackingUrl(opts.token)}`;
}
