/**
 * Superadmin tenant switching. The active company id is persisted in
 * localStorage and injected as the X-Company-Id header by the api client
 * (lib/api.ts). The server validates it against the companies allow-list and
 * ignores it for non-superadmins.
 */
const KEY = "active_company";

export function activeCompany(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(KEY);
}

/** Switch into a tenant (or back to home when id is "default"/empty) and reload. */
export function switchCompany(id: string | null) {
  if (typeof localStorage === "undefined") return;
  if (!id || id === "default") localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, id);
  // hard reload so every query re-fetches under the new tenant header.
  window.location.reload();
}
