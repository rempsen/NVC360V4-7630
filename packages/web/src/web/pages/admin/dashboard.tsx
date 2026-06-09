import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { api } from "../../lib/api";
import { FullLoader } from "../../components/loader";
import { StatusBadge, PageWrap } from "../../components/brand";
import { PageHead } from "./shell";
import { fmtDate, money, TECH_STATUS } from "../../lib/utils";
import { useWorkerNoun } from "../../lib/use-brand";
import {
  ClipboardList,
  Activity,
  CheckCircle2,
  DollarSign,
  Users,
  Wrench,
  ArrowRight,
  MapPin,
  CalendarDays,
  X,
} from "lucide-react";

// ---- date-range helpers ----------------------------------------------------
type Basis = "scheduled" | "created";
type RangeKey = "all" | "today" | "last7" | "month" | "custom";

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const fmtInput = (d: Date) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
};

/** Resolve a preset (or custom dates) into [from, to) epoch-ms bounds. */
function resolveRange(
  key: RangeKey,
  customFrom: string,
  customTo: string,
): { from: number | null; to: number | null } {
  const now = new Date();
  if (key === "today") {
    const f = startOfDay(now);
    const t = new Date(f);
    t.setDate(t.getDate() + 1);
    return { from: f.getTime(), to: t.getTime() };
  }
  if (key === "last7") {
    const t = startOfDay(now);
    t.setDate(t.getDate() + 1); // through end of today
    const f = new Date(t);
    f.setDate(f.getDate() - 7);
    return { from: f.getTime(), to: t.getTime() };
  }
  if (key === "month") {
    const f = new Date(now.getFullYear(), now.getMonth(), 1);
    const t = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { from: f.getTime(), to: t.getTime() };
  }
  if (key === "custom") {
    const f = customFrom ? startOfDay(new Date(customFrom + "T00:00:00")) : null;
    let t: Date | null = null;
    if (customTo) {
      t = startOfDay(new Date(customTo + "T00:00:00"));
      t.setDate(t.getDate() + 1); // inclusive end day
    }
    return { from: f ? f.getTime() : null, to: t ? t.getTime() : null };
  }
  return { from: null, to: null }; // all
}

const PRESETS: { key: RangeKey; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "last7", label: "Last 7 days" },
  { key: "month", label: "This month" },
  { key: "custom", label: "Custom" },
];

const FLEET_SORT: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "enroute", label: "En Route" },
  { key: "available", label: "Available" },
  { key: "onsite", label: "On Site" },
  { key: "busy", label: "Busy" },
  { key: "break", label: "Break" },
  { key: "offline", label: "Offline" },
];

// priority order for the "all" view — most relevant first
const STATUS_ORDER: Record<string, number> = {
  enroute: 0,
  onsite: 1,
  busy: 2,
  available: 3,
  break: 4,
  offline: 5,
};

export default function AdminDashboard() {
  const { nounPlural: workerPlural } = useWorkerNoun();
  const [fleetSort, setFleetSort] = useState("all");

  // date-range filter state (drives the top six cards)
  const [rangeKey, setRangeKey] = useState<RangeKey>("all");
  const [basis, setBasis] = useState<Basis>("scheduled");
  const [customFrom, setCustomFrom] = useState(() => fmtInput(new Date()));
  const [customTo, setCustomTo] = useState(() => fmtInput(new Date()));

  const range = useMemo(
    () => resolveRange(rangeKey, customFrom, customTo),
    [rangeKey, customFrom, customTo],
  );
  const hasRange = range.from != null || range.to != null;

  const stats = useQuery({
    queryKey: ["admin-stats", range.from, range.to, basis],
    queryFn: async () => {
      const query: Record<string, string> = {};
      if (range.from != null) query.from = String(range.from);
      if (range.to != null) query.to = String(range.to);
      if (hasRange) query.basis = basis;
      return (await api.admin.stats.$get({ query })).json();
    },
    refetchInterval: 10000,
  });
  const bookings = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => (await api.bookings.$get()).json(),
  });
  const fleet = useQuery({
    queryKey: ["fleet"],
    queryFn: async () => (await api.fleet.$get()).json(),
    refetchInterval: 8000,
  });

  if (stats.isLoading || bookings.isLoading)
    return <FullLoader label="Loading console…" />;
  const s = stats.data!;
  const recent = (bookings.data?.bookings ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 6);

  let techs = (fleet.data?.fleet ?? []).slice();
  if (fleetSort === "all") {
    techs.sort(
      (a, b) =>
        (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99),
    );
  } else {
    techs = techs.filter((t) => t.status === fleetSort);
  }

  const cards = [
    {
      label: "Work orders",
      value: s.totalBookings,
      icon: ClipboardList,
      tint: "bg-brand/15 text-cyan-glow",
      to: "/admin/work-orders",
    },
    {
      label: "Active jobs",
      value: s.activeBookings,
      icon: Activity,
      tint: "bg-amber-warn/15 text-amber-warn",
      to: "/admin/work-orders?status=active",
      hint: s.activeBookings === 0 ? "Nothing in progress" : undefined,
    },
    {
      label: "Completed",
      value: s.completedBookings,
      icon: CheckCircle2,
      tint: "bg-emerald-live/15 text-emerald-live",
      to: "/admin/work-orders?status=completed",
    },
    {
      label: "Revenue",
      value: money(s.revenue),
      icon: DollarSign,
      tint: "bg-emerald-live/15 text-emerald-live",
      to: "/admin/payouts",
      hint:
        s.revenue === 0 && s.completedBookings > 0
          ? "No payments recorded yet"
          : undefined,
    },
    {
      label: "Clients",
      value: s.customers,
      icon: Users,
      tint: "bg-brand/15 text-cyan-glow",
      to: "/admin/clients",
    },
    {
      label: workerPlural,
      value: s.riders,
      icon: Wrench,
      tint: "bg-violet-500/15 text-violet-300",
      to: "/admin/techs",
    },
  ];

  return (
    <PageWrap>
      <PageHead
        title="Operations Dashboard"
        subtitle="Live overview of your field service fleet"
      />

      {/* date-range filter for the metric cards */}
      <div className="nvc-card mb-4 flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
        <div className="flex items-center gap-2 text-slate-400">
          <CalendarDays className="h-4 w-4 text-cyan-glow" />
          <span className="text-xs font-semibold uppercase tracking-wide">
            Date range
          </span>
        </div>

        {/* presets */}
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => {
            const active = rangeKey === p.key;
            return (
              <button
                key={p.key}
                onClick={() => setRangeKey(p.key)}
                className={`rounded-full px-3 py-1 text-[12px] font-semibold transition ${
                  active
                    ? "bg-brand text-white"
                    : "bg-ink-2 text-slate-400 hover:bg-white/5"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* custom date inputs */}
        {rangeKey === "custom" && (
          <div className="flex items-center gap-2">
            <input aria-label="Custom From"
              type="date"
              value={customFrom}
              max={customTo}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-white/10 bg-ink-2 px-2 py-1 text-xs text-slate-200 outline-none focus:border-brand/50"
            />
            <span className="text-xs text-slate-500">to</span>
            <input aria-label="Custom To"
              type="date"
              value={customTo}
              min={customFrom}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-white/10 bg-ink-2 px-2 py-1 text-xs text-slate-200 outline-none focus:border-brand/50"
            />
          </div>
        )}

        {/* basis toggle — which date to filter on (only matters with a range) */}
        {hasRange && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-slate-500">by</span>
            <div className="flex overflow-hidden rounded-lg border border-white/10">
              {(["scheduled", "created"] as Basis[]).map((b) => (
                <button
                  key={b}
                  onClick={() => setBasis(b)}
                  className={`px-2.5 py-1 text-[11px] font-semibold capitalize transition ${
                    basis === b
                      ? "bg-white/10 text-white"
                      : "bg-transparent text-slate-400 hover:bg-white/5"
                  }`}
                >
                  {b} date
                </button>
              ))}
            </div>
            <button
              onClick={() => setRangeKey("all")}
              title="Clear filter"
              className="grid h-6 w-6 place-items-center rounded-md text-slate-500 hover:bg-white/5 hover:text-slate-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="nvc-card group p-4 transition hover:border-brand/40 hover:bg-white/[0.03]"
          >
            <div
              className={`mb-3 grid h-10 w-10 place-items-center rounded-xl ${c.tint}`}
            >
              <c.icon className="h-5 w-5" />
            </div>
            <div className="font-display text-2xl font-extrabold text-white">
              {c.value}
            </div>
            <p className="flex items-center gap-1 text-xs text-slate-400">
              {c.label}
              <ArrowRight className="h-3 w-3 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
            </p>
            {"hint" in c && c.hint && (
              <p className="mt-0.5 text-[11px] text-slate-600">{c.hint}</p>
            )}
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {/* recent work orders */}
        <div className="nvc-card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
            <h2 className="font-bold text-white">Recent work orders</h2>
            <Link
              to="/admin/work-orders"
              className="flex items-center gap-1 text-sm font-semibold text-cyan-glow"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-white/5">
            {recent.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                No work orders yet
              </p>
            ) : (
              recent.map((b) => (
                <Link
                  key={b.id}
                  to="/admin/work-orders"
                  className="flex items-start gap-4 px-5 py-3.5 transition hover:bg-white/[0.03]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-slate-100">
                        {b.customer?.name ?? "—"}
                      </span>
                      <StatusBadge status={b.status} />
                    </div>
                    {b.address && (
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
                        <MapPin className="h-3 w-3 shrink-0" /> {b.address}
                      </p>
                    )}
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
                      <Wrench className="h-3 w-3 shrink-0" />
                      {b.rider?.name ? (
                        <span className="text-slate-400">{b.rider.name}</span>
                      ) : (
                        <span className="text-slate-600">Unassigned</span>
                      )}
                      <span className="text-slate-700">·</span>
                      {fmtDate(b.scheduledAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-white">{money(b.price)}</div>
                    <p className="text-[11px] text-slate-500">
                      {b.title || b.service?.name}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* fleet status */}
        <div className="nvc-card">
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
            <h2 className="font-bold text-white">Fleet status</h2>
            <Link
              to="/admin/fleet"
              className="flex items-center gap-1 text-sm font-semibold text-cyan-glow"
            >
              <MapPin className="h-3.5 w-3.5" /> Map
            </Link>
          </div>
          {/* sort / filter chips */}
          <div className="flex flex-wrap gap-1.5 border-b border-white/5 px-4 py-2.5">
            {FLEET_SORT.map((f) => {
              const count =
                f.key === "all"
                  ? (fleet.data?.fleet ?? []).length
                  : (fleet.data?.fleet ?? []).filter(
                      (t) => t.status === f.key,
                    ).length;
              const active = fleetSort === f.key;
              const meta = TECH_STATUS[f.key];
              return (
                <button
                  key={f.key}
                  onClick={() => setFleetSort(f.key)}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    active
                      ? "bg-brand text-white"
                      : "bg-ink-2 text-slate-400 hover:bg-white/5"
                  }`}
                >
                  {meta && (
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: meta.color }}
                    />
                  )}
                  {f.label}
                  <span
                    className={active ? "text-white/70" : "text-slate-600"}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="max-h-[360px] divide-y divide-white/5 overflow-y-auto">
            {techs.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                No {workerPlural.toLowerCase()} {fleetSort !== "all" && `· ${fleetSort}`}
              </p>
            ) : (
              techs.map((t) => {
                const meta = TECH_STATUS[t.status] ?? {
                  label: t.status,
                  color: "#64748b",
                };
                return (
                  <Link
                    key={t.id}
                    to="/admin/fleet"
                    className="flex items-center gap-3 px-5 py-3 transition hover:bg-white/[0.03]"
                  >
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-ink"
                      style={{ background: t.color }}
                    >
                      {t.name
                        .split(" ")
                        .map((x) => x[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-100">
                        {t.name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {t.task?.title ?? t.skillClass ?? "Idle"}
                      </p>
                    </div>
                    <span
                      className="flex items-center gap-1 text-[11px] font-semibold"
                      style={{ color: meta.color }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: meta.color }}
                      />
                      {meta.label}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>
    </PageWrap>
  );
}
