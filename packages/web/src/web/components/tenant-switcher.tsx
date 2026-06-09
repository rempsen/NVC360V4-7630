import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../hooks/use-auth";
import { activeCompany, switchCompany } from "../lib/tenant";
import { Building2, ChevronsUpDown, Check } from "lucide-react";

type Company = { id: string; name: string };

/**
 * Top-bar tenant selector. Renders ONLY for superadmins. Lets them act on any
 * provisioned company; selection persists to localStorage and reloads.
 */
export function TenantSwitcher() {
  const { role } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = activeCompany() ?? "default";

  const { data } = useQuery({
    queryKey: ["superadmin", "companies", "switcher"],
    queryFn: async () => (await api.superadmin.companies.$get()).json(),
    enabled: role === "superadmin",
  });

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (role !== "superadmin") return null;

  const companies = ((data as any)?.companies ?? []) as Company[];
  // ensure the home/default tenant is always selectable
  const list = companies.some((c) => c.id === "default")
    ? companies
    : [{ id: "default", name: "NVC 360 (Home)" }, ...companies];
  const current = list.find((c) => c.id === active);

  return (
    <div ref={ref} className="relative px-3 py-3">
      <div className="mb-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400/70">
        Acting as tenant
      </div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-200 transition hover:border-amber-500/50"
        title="Switch active tenant"
      >
        <Building2 className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">{current?.name ?? "Select tenant"}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
      </button>

      {open && (
        <div className="absolute left-3 right-3 z-50 mt-2 overflow-hidden rounded-xl border border-white/10 bg-ink-2 shadow-2xl">
          <div className="max-h-72 overflow-y-auto py-1">
            {list.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setOpen(false);
                  if (c.id !== active) switchCompany(c.id);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-300 transition hover:bg-white/5"
              >
                <span className="min-w-0">
                  <span className="block truncate">{c.name}</span>
                  <span className="block truncate text-xs text-slate-500">{c.id}</span>
                </span>
                {c.id === active && <Check className="h-4 w-4 text-cyan-glow" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
