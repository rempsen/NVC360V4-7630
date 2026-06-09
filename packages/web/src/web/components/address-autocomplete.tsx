import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { inputCls } from "./modal";

interface Prediction {
  placeId: string;
  description: string;
  main: string;
  secondary: string;
  lat?: number;
  lng?: number;
}

export function AddressAutocomplete({
  value,
  onResolve,
  placeholder = "Start typing an address…",
  source = "auth",
  inputClassName,
  inputStyle,
  theme = "dark",
}: {
  value: string;
  /** Called when a place is picked or text changes; coords null until resolved. */
  onResolve: (v: { address: string; lat: number | null; lng: number | null }) => void;
  placeholder?: string;
  /**
   * "auth" (default) uses the authenticated /geo proxy. "public" uses the
   * unauthenticated, rate-limited /api/public/forms/geo proxy so address fields
   * on public intake pages (no app session) still auto-populate.
   */
  source?: "auth" | "public";
  /** Override the input class (e.g. to match a public form's theme). */
  inputClassName?: string;
  /** Inline style for the input (e.g. brand focus ring on public forms). */
  inputStyle?: React.CSSProperties;
  /** Dropdown palette. "light" for white public forms, "dark" (default) in-app. */
  theme?: "dark" | "light";
}) {
  const [q, setQ] = useState(value);
  const [preds, setPreds] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQ(value), [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function onChange(text: string) {
    setQ(text);
    onResolve({ address: text, lat: coords?.lat ?? null, lng: coords?.lng ?? null });
    if (tRef.current) clearTimeout(tRef.current);
    if (text.trim().length < 3) {
      setPreds([]);
      return;
    }
    setLoading(true);
    tRef.current = setTimeout(async () => {
      try {
        let data: any;
        if (source === "public") {
          const r = await fetch(
            `/api/public/forms/geo/autocomplete?q=${encodeURIComponent(text)}`,
          );
          data = await r.json();
        } else {
          const res = await api.geo.autocomplete.$get({ query: { q: text } });
          data = await res.json();
        }
        setPreds(data.predictions ?? []);
        setOpen(true);
      } catch {
        // network/proxy hiccup — keep the field usable as free text
      } finally {
        setLoading(false);
      }
    }, 280);
  }

  async function pick(p: Prediction) {
    setQ(p.description);
    setOpen(false);
    if (p.lat != null && p.lng != null) {
      setCoords({ lat: p.lat, lng: p.lng });
      onResolve({ address: p.description, lat: p.lat, lng: p.lng });
      return;
    }
    let d: any;
    if (source === "public") {
      const r = await fetch(
        `/api/public/forms/geo/details?placeId=${encodeURIComponent(p.placeId)}&description=${encodeURIComponent(p.description)}`,
      );
      d = await r.json();
    } else {
      const res = await api.geo.details.$get({
        query: { placeId: p.placeId, description: p.description },
      });
      d = await res.json();
    }
    if (d.lat != null) setCoords({ lat: d.lat, lng: d.lng });
    onResolve({ address: d.address || p.description, lat: d.lat ?? null, lng: d.lng ?? null });
  }

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input aria-label={placeholder}
          className={`${inputClassName ?? inputCls} pl-9`}
          style={inputStyle}
          value={q}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => preds.length && setOpen(true)}
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-500" />
        )}
      </div>
      {open && preds.length > 0 && (
        <ul
          className={`absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border py-1 shadow-2xl ${
            theme === "light"
              ? "border-slate-200 bg-white"
              : "border-white/10 bg-ink-2"
          }`}
        >
          {preds.map((p) => (
            <li key={p.placeId}>
              <button
                type="button"
                onClick={() => pick(p)}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm ${
                  theme === "light" ? "hover:bg-slate-100" : "hover:bg-white/5"
                }`}
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                <span className="min-w-0">
                  <span
                    className={`block truncate font-medium ${
                      theme === "light" ? "text-slate-800" : "text-white"
                    }`}
                  >
                    {p.main}
                  </span>
                  <span className="block truncate text-xs text-slate-500">{p.secondary}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
