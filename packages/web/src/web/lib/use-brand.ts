import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

/**
 * Tenant brand + vocabulary, read from the active company's settings.
 *
 * The big payoff of AI onboarding: a company that calls its field staff
 * "Plumbers" or "Drivers" sees that word everywhere instead of a generic
 * "Technician". Use `noun`/`nounPlural` for any user-facing label that refers
 * to the worker who goes out to the job.
 *
 * Cached for the session (settings rarely change); falls back to sane NVC360
 * defaults while loading or for unauthenticated views.
 */
export interface TenantBrand {
  noun: string; // singular worker noun, e.g. "Technician"
  nounPlural: string; // plural, e.g. "Technicians"
  brandColor: string;
  accentColor: string;
  logo: string;
  name: string;
  tagline: string;
  industry: string; // Primary Industry (ICP) preset id, e.g. "hvac"
}

const DEFAULTS: TenantBrand = {
  noun: "Technician",
  nounPlural: "Technicians",
  brandColor: "#06B6D4",
  accentColor: "#0e7490",
  logo: "",
  name: "NVC 360",
  tagline: "",
  industry: "",
};

export function useBrand(): TenantBrand {
  const q = useQuery({
    queryKey: ["tenant-brand"],
    queryFn: async () => {
      const r = await api.settings.$get();
      const j = (await r.json()) as { settings?: Record<string, unknown> };
      return j.settings ?? {};
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
  const s = (q.data ?? {}) as Record<string, unknown>;
  const str = (v: unknown, fb: string) =>
    typeof v === "string" && v.trim() ? (v as string) : fb;
  return {
    noun: str(s.workerNoun, DEFAULTS.noun),
    nounPlural: str(s.workerNounPlural, DEFAULTS.nounPlural),
    brandColor: str(s.brandColor, DEFAULTS.brandColor),
    accentColor: str(s.accentColor, DEFAULTS.accentColor),
    logo: str(s.logo, DEFAULTS.logo),
    name: str(s.name, DEFAULTS.name),
    tagline: str(s.tagline, DEFAULTS.tagline),
    industry: str(s.industry, DEFAULTS.industry),
  };
}

/** Convenience: just the worker noun pair. */
export function useWorkerNoun(): { noun: string; nounPlural: string } {
  const b = useBrand();
  return { noun: b.noun, nounPlural: b.nounPlural };
}
