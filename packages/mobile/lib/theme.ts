// NVC360 dark brand — mirrors web (@theme in styles.css)
export const C = {
  brand: "#0ea5e9",
  brandDeep: "#0369a1",
  sky: "#06b6d4",
  cyan: "#22d3ee",
  // dark surfaces
  bg: "#070b12",
  bg2: "#0c1220",
  bg3: "#131c2e",
  card: "#0c1220",
  cardHi: "#131c2e",
  text: "#f1f5f9",
  sub: "#94a3b8",
  muted: "#64748b",
  border: "#1e293b",
  borderHi: "#334155",
  green: "#10b981",
  greenBg: "rgba(16,185,129,0.14)",
  amber: "#f59e0b",
  amberBg: "rgba(245,158,11,0.14)",
  red: "#ef4444",
  redBg: "rgba(239,68,68,0.14)",
};

export const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "#f59e0b", bg: "rgba(245,158,11,0.14)" },
  confirmed: { label: "Confirmed", color: "#38bdf8", bg: "rgba(56,189,248,0.14)" },
  assigned: { label: "Assigned", color: "#a78bfa", bg: "rgba(167,139,250,0.16)" },
  enroute: { label: "On the way", color: "#22d3ee", bg: "rgba(34,211,238,0.14)" },
  arrived: { label: "Arrived", color: "#2dd4bf", bg: "rgba(45,212,191,0.14)" },
  in_progress: { label: "In progress", color: "#fb923c", bg: "rgba(251,146,60,0.16)" },
  completed: { label: "Completed", color: "#10b981", bg: "rgba(16,185,129,0.16)" },
  cancelled: { label: "Cancelled", color: "#f87171", bg: "rgba(248,113,113,0.16)" },
};

export function money(n: number) {
  return `$${(n ?? 0).toFixed(2)}`;
}

export function fmtDate(d: string | number | Date) {
  return new Date(d).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtTime(d: string | number | Date) {
  return new Date(d).toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function initials(name?: string | null) {
  return (name ?? "T")
    .trim()
    .split(/\s+/)
    .map((x) => x[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Absolute URL for /uploads/* assets served by the API
import Constants from "expo-constants";
const API = ((Constants.expoConfig?.extra?.apiUrl as string) ?? "").replace(/\/$/, "");
export function assetUrl(path?: string | null) {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `${API}${path}`;
}
