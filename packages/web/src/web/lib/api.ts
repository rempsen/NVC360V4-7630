import { hc } from "hono/client";
import type { AppType } from "../../api";
import { getToken } from "./auth";

/**
 * Shared auth/tenant headers for every API request.
 * Used by the typed hono client AND any raw `fetch` calls so they all carry
 * the bearer token + superadmin company-switch header consistently.
 */
export function apiHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  const token = getToken();
  if (token) h.Authorization = `Bearer ${token}`;
  const active =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("active_company")
      : null;
  if (active) h["X-Company-Id"] = active;
  return h;
}

const client = hc<AppType>("/", {
  headers: () => apiHeaders(),
});

export const api = client.api;
