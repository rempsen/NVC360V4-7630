import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "../../lib/api";
import { activate } from "../../lib/utils";
import { FullLoader } from "../../components/loader";
import { PageWrap } from "../../components/brand";
import { PageHead } from "./shell";
import { Modal, Field, inputCls, BtnPrimary, BtnGhost, ConfirmModal } from "../../components/modal";
import { MapPin, Plus, Pencil, Trash2, MousePointer2, Check, X } from "lucide-react";

type LatLng = [number, number];
type Zone = {
  id: string;
  name: string;
  color: string;
  polygon: LatLng[];
  surgeMultiplier: number;
  active: boolean;
};

const WPG: LatLng = [49.8951, -97.1384];

export default function AdminZones() {
  const qc = useQueryClient();
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<Record<string, L.Polygon>>({});
  const draftLayerRef = useRef<L.Polygon | null>(null);
  const draftMarkersRef = useRef<L.CircleMarker[]>([]);

  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<LatLng[]>([]);
  const [editor, setEditor] = useState<{ open: boolean; zone: Zone | null; polygon: LatLng[] }>({
    open: false,
    zone: null,
    polygon: [],
  });
  const [delZone, setDelZone] = useState<Zone | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const drawingRef = useRef(drawing);
  drawingRef.current = drawing;
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const zonesQ = useQuery({
    queryKey: ["zones"],
    queryFn: async () => (await api.zones.$get()).json(),
  });

  const createM = useMutation({
    mutationFn: async (body: Partial<Zone>) =>
      (await api.zones.$post({ json: body as any })).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["zones"] });
      closeEditor();
    },
  });
  const updateM = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<Zone> }) =>
      (await api.zones[":id"].$put({ param: { id }, json: body as any })).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["zones"] });
      closeEditor();
    },
  });
  const deleteM = useMutation({
    mutationFn: async (id: string) => api.zones[":id"].$delete({ param: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["zones"] });
      setDelZone(null);
    },
  });

  const zones: Zone[] = useMemo(
    () => (zonesQ.data as any)?.zones ?? [],
    [zonesQ.data],
  );

  // init map
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, { zoomControl: true, attributionControl: false }).setView(WPG, 11);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => {
      if (!drawingRef.current) return;
      const pt: LatLng = [e.latlng.lat, e.latlng.lng];
      setDraft((d) => [...d, pt]);
    });
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 150);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // render saved zones
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    Object.values(layersRef.current).forEach((l) => l.remove());
    layersRef.current = {};
    zones.forEach((z) => {
      if (!z.polygon || z.polygon.length < 3) return;
      const poly = L.polygon(z.polygon as L.LatLngExpression[], {
        color: z.color,
        weight: 2,
        fillOpacity: z.active ? 0.18 : 0.05,
        dashArray: z.active ? undefined : "6 6",
      }).addTo(map);
      poly.on("click", () => {
        if (drawingRef.current) return;
        setSelected(z.id);
      });
      poly.bindTooltip(`${z.name}${z.surgeMultiplier !== 1 ? ` · ${z.surgeMultiplier}×` : ""}`, { sticky: true });
      layersRef.current[z.id] = poly;
    });
  }, [zones, drawing]);

  // render draft polygon + vertices
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    draftLayerRef.current?.remove();
    draftLayerRef.current = null;
    draftMarkersRef.current.forEach((m) => m.remove());
    draftMarkersRef.current = [];
    if (draft.length >= 2) {
      draftLayerRef.current = L.polygon(draft as L.LatLngExpression[], {
        color: "#06b6d4",
        weight: 2,
        dashArray: "5 5",
        fillOpacity: 0.12,
      }).addTo(map);
    }
    draft.forEach((p) => {
      const m = L.circleMarker(p, { radius: 5, color: "#06b6d4", fillColor: "#0e7490", fillOpacity: 1, weight: 2 }).addTo(map);
      draftMarkersRef.current.push(m);
    });
  }, [draft]);

  function startDraw() {
    setSelected(null);
    setDraft([]);
    setDrawing(true);
  }
  function cancelDraw() {
    setDrawing(false);
    setDraft([]);
  }
  function finishDraw() {
    if (draft.length < 3) return;
    setDrawing(false);
    setEditor({ open: true, zone: null, polygon: draft });
  }
  function closeEditor() {
    setEditor({ open: false, zone: null, polygon: [] });
    setDraft([]);
  }
  function editZone(z: Zone) {
    setEditor({ open: true, zone: z, polygon: z.polygon });
  }

  if (zonesQ.isLoading) return <FullLoader label="Loading service zones…" />;

  const sel = zones.find((z) => z.id === selected) || null;

  return (
    <PageWrap>
      <PageHead
        title="Service Zones"
        subtitle="Draw coverage areas & set surge pricing"
        actions={
          drawing ? (
            <div className="flex items-center gap-2">
              <BtnGhost onClick={cancelDraw}><X className="h-4 w-4" /> Cancel</BtnGhost>
              <BtnPrimary disabled={draft.length < 3} onClick={finishDraw}><Check className="h-4 w-4" /> Done ({draft.length})</BtnPrimary>
            </div>
          ) : (
            <BtnPrimary onClick={startDraw}><Plus className="h-4 w-4" /> Draw zone</BtnPrimary>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="nvc-card relative overflow-hidden p-0">
          {drawing && (
            <div className="absolute left-1/2 top-3 z-[500] -translate-x-1/2 rounded-full bg-brand/90 px-4 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur flex items-center gap-2">
              <MousePointer2 className="h-3.5 w-3.5" /> Click the map to add points · {draft.length} placed
            </div>
          )}
          <div ref={elRef} className="h-[560px] w-full" style={{ zIndex: 0 }} />
        </div>

        <div className="space-y-3">
          <div className="nvc-card p-4">
            <p className="mb-3 text-xs uppercase tracking-wide text-slate-500">{zones.length} zones</p>
            {zones.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No zones yet. Click "Draw zone" and outline an area on the map.</p>
            ) : (
              <div className="space-y-2">
                {zones.map((z) => (
                  <div
                    key={z.id}
                    {...activate(() => { setSelected(z.id); const l = layersRef.current[z.id]; if (l && mapRef.current) mapRef.current.fitBounds(l.getBounds(), { padding: [40, 40] }); })}
                    className={`group flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                      selected === z.id ? "border-brand/50 bg-brand/10" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.05]"
                    }`}
                  >
                    <span className="h-3.5 w-3.5 flex-shrink-0 rounded-sm" style={{ background: z.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{z.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {z.surgeMultiplier !== 1 ? `${z.surgeMultiplier}× surge · ` : ""}
                        {z.active ? "Active" : "Inactive"}
                      </p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); editZone(z); }} className="rounded-lg p-1.5 text-slate-400 opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDelZone(z); }} className="rounded-lg p-1.5 text-slate-400 opacity-0 transition hover:bg-rose-500/15 hover:text-rose-400 group-hover:opacity-100">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {sel && (
            <div className="nvc-card p-4">
              <div className="mb-2 flex items-center gap-2">
                <MapPin className="h-4 w-4" style={{ color: sel.color }} />
                <p className="font-semibold text-white">{sel.name}</p>
              </div>
              <dl className="space-y-1 text-sm">
                <Row k="Surge multiplier" v={`${sel.surgeMultiplier}×`} />
                <Row k="Status" v={sel.active ? "Active" : "Inactive"} />
                <Row k="Vertices" v={String(sel.polygon.length)} />
              </dl>
              <button onClick={() => editZone(sel)} className="mt-3 w-full rounded-xl bg-white/5 py-2 text-sm font-semibold text-white hover:bg-white/10">
                Edit zone
              </button>
            </div>
          )}
        </div>
      </div>

      <ZoneEditor
        state={editor}
        onClose={closeEditor}
        saving={createM.isPending || updateM.isPending}
        onSave={(body) => {
          if (editor.zone) updateM.mutate({ id: editor.zone.id, body });
          else createM.mutate(body);
        }}
      />

      <ConfirmModal
        open={!!delZone}
        onClose={() => setDelZone(null)}
        onConfirm={() => delZone && deleteM.mutate(delZone.id)}
        title="Delete zone?"
        message={`"${delZone?.name}" will be permanently removed.`}
        confirmLabel="Delete"
        danger
      />
    </PageWrap>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{k}</dt>
      <dd className="font-medium text-slate-200">{v}</dd>
    </div>
  );
}

const PALETTE = ["#06b6d4", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#3b82f6", "#14b8a6"];

function ZoneEditor({
  state,
  onClose,
  onSave,
  saving,
}: {
  state: { open: boolean; zone: Zone | null; polygon: LatLng[] };
  onClose: () => void;
  onSave: (body: Partial<Zone>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({ name: "", color: "#06b6d4", surgeMultiplier: 1, active: true });

  useEffect(() => {
    if (state.open) {
      setForm({
        name: state.zone?.name ?? "",
        color: state.zone?.color ?? "#06b6d4",
        surgeMultiplier: state.zone?.surgeMultiplier ?? 1,
        active: state.zone?.active ?? true,
      });
    }
  }, [state.open, state.zone]);

  return (
    <Modal
      open={state.open}
      onClose={onClose}
      title={state.zone ? "Edit zone" : "New service zone"}
      subtitle={`${state.polygon.length} boundary points`}
      footer={
        <>
          <BtnGhost onClick={onClose}>Cancel</BtnGhost>
          <BtnPrimary
            disabled={saving || !form.name.trim()}
            onClick={() => onSave({ ...form, polygon: state.polygon } as Partial<Zone>)}
          >
            {saving ? "Saving…" : state.zone ? "Save changes" : "Create zone"}
          </BtnPrimary>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Zone name">
          <input aria-label="Downtown Core" className={inputCls} value={form.name} placeholder="Downtown Core" onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Color">
          <div className="flex flex-wrap gap-2">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Select color ${c}`}
                onClick={() => setForm({ ...form, color: c })}
                className={`h-8 w-8 rounded-lg border-2 transition ${form.color === c ? "border-white" : "border-transparent"}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </Field>
        <Field label="Surge multiplier" hint="1 = normal pricing, 1.5 = +50%">
          <input aria-label="Surge Multiplier"
            type="number"
            step="0.1"
            min="1"
            className={inputCls}
            value={form.surgeMultiplier}
            onChange={(e) => setForm({ ...form, surgeMultiplier: parseFloat(e.target.value) || 1 })}
          />
        </Field>
        <label className="flex cursor-pointer items-center gap-2.5 rounded-xl bg-white/[0.03] px-3 py-2.5">
          <input aria-label="Active" type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 accent-cyan-500" />
          <span className="text-sm text-slate-200">Zone active</span>
        </label>
      </div>
    </Modal>
  );
}
