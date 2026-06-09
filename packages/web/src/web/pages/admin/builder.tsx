import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { FullLoader } from "../../components/loader";
import { PageWrap } from "../../components/brand";
import { PageHead } from "./shell";
import { ConfirmModal } from "../../components/modal";
import { RateModelEditor } from "../../components/rate-model-editor";
import { EMPTY_RATE_MODEL, parseRateModel, type RateModel } from "../../../shared/pricing";
import { useBrand } from "../../lib/use-brand";
import { getIndustryPreset } from "../../../services/industry-presets";
import {
  Type,
  Hash,
  CheckSquare,
  List,
  Camera,
  PenLine,
  Calendar,
  Trash2,
  Plus,
  Save,
  GripVertical,
  LayoutTemplate,
  Copy,
  Pencil,
} from "lucide-react";

type FieldType = "text" | "number" | "checkbox" | "select" | "photo" | "signature" | "date";

interface Field {
  id: string;
  type: FieldType;
  label: string;
  required?: boolean;
}

const PALETTE: { type: FieldType; label: string; icon: any }[] = [
  { type: "text", label: "Text", icon: Type },
  { type: "number", label: "Number", icon: Hash },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare },
  { type: "select", label: "Dropdown", icon: List },
  { type: "photo", label: "Photo", icon: Camera },
  { type: "signature", label: "Signature", icon: PenLine },
  { type: "date", label: "Date", icon: Calendar },
];

const iconFor = (t: FieldType) => PALETTE.find((p) => p.type === t)?.icon ?? Type;
const uid = () => Math.random().toString(36).slice(2);

export default function BuilderPage() {
  const qc = useQueryClient();
  const brand = useBrand();
  const preset = getIndustryPreset(brand.industry);
  // Category options come from the tenant's Primary Industry (ICP); fall back
  // to a generic spread when no industry is set.
  const categoryOptions = preset?.categories ?? ["General", "Residential", "Commercial", "Service"];
  const defaultCategory = categoryOptions[0];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState(defaultCategory);
  const [estimatedMins, setEstimatedMins] = useState(60);
  const [rateModel, setRateModel] = useState<RateModel>({ ...EMPTY_RATE_MODEL });
  const [fields, setFields] = useState<Field[]>([]);
  const [dragType, setDragType] = useState<FieldType | null>(null);
  const [over, setOver] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);

  const templates = useQuery({
    queryKey: ["templates"],
    queryFn: async () => (await api.templates.$get()).json(),
  });

  // When the tenant's industry resolves after mount, adopt its default category
  // for a fresh (non-editing) template if the current one isn't a valid option.
  useEffect(() => {
    if (!editingId && !categoryOptions.includes(category)) {
      setCategory(defaultCategory);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand.industry]);

  function reset() {
    setEditingId(null);
    setName("");
    setCategory(defaultCategory);
    setEstimatedMins(60);
    setRateModel({ ...EMPTY_RATE_MODEL });
    setFields([]);
  }

  function loadTemplate(t: any) {
    setEditingId(t.id);
    setName(t.name);
    setCategory(t.category || "General");
    setEstimatedMins(t.estimatedMins || 60);
    setRateModel(parseRateModel(t.rateModel) ?? { ...EMPTY_RATE_MODEL });
    let parsed: Field[] = [];
    try {
      parsed = (JSON.parse(t.fields || "[]") as any[]).map((f) => ({
        id: uid(),
        type: f.type,
        label: f.label,
        required: !!f.required,
      }));
    } catch {
      parsed = [];
    }
    setFields(parsed);
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        category,
        estimatedMins,
        rateModel,
        fields: fields.map((f) => ({ type: f.type, label: f.label, required: !!f.required })),
      };
      if (editingId) {
        return (await api.templates[":id"].$patch({ param: { id: editingId }, json: payload })).json();
      }
      return (await api.templates.$post({ json: payload })).json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      reset();
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) =>
      (await api.templates[":id"].$delete({ param: { id } })).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      setDelId(null);
      if (delId === editingId) reset();
    },
  });

  function duplicate(t: any) {
    loadTemplate({ ...t, name: `${t.name} (copy)` });
    setEditingId(null);
  }

  function addField(type: FieldType) {
    setFields((f) => [
      ...f,
      { id: uid(), type, label: PALETTE.find((p) => p.type === type)!.label + " field" },
    ]);
  }

  const delTarget = (templates.data?.templates ?? []).find((t: any) => t.id === delId);

  return (
    <PageWrap>
      <PageHead
        title="Form Builder Templates"
        subtitle={editingId ? "Editing an existing template" : "Design custom work-order templates — drag field types onto the canvas"}
      />

      <div className="grid gap-5 lg:grid-cols-[200px_1fr_280px]">
        {/* palette */}
        <div className="nvc-card h-fit p-3">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Field types</p>
          <div className="space-y-1.5">
            {PALETTE.map((p) => (
              <div
                key={p.type}
                draggable
                // draggable palette item; needs to be a div for HTML5 DnD.
                // eslint-disable-next-line jsx-a11y/prefer-tag-over-role
                role="button"
                tabIndex={0}
                aria-label={`Add ${p.label} field`}
                onDragStart={() => setDragType(p.type)}
                onDragEnd={() => setDragType(null)}
                onClick={() => addField(p.type)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    addField(p.type);
                  }
                }}
                className={`flex cursor-grab items-center gap-2 rounded-lg border border-white/10 bg-ink-3/60 px-3 py-2 text-sm text-slate-300 transition hover:border-brand/40 hover:text-white active:cursor-grabbing ${
                  dragType === p.type ? "dragging" : ""
                }`}
              >
                <p.icon className="h-4 w-4 text-cyan-glow" /> {p.label}
              </div>
            ))}
          </div>
        </div>

        {/* canvas */}
        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={() => { if (dragType) addField(dragType); setDragType(null); setOver(false); }}
          className={`nvc-card min-h-[420px] p-5 transition ${over ? "drop-active" : ""}`}
        >
          {editingId && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-brand/10 px-3 py-2 text-xs text-cyan-glow">
              <Pencil className="h-3.5 w-3.5" /> Editing template — saving will update it.
              <button onClick={reset} className="ml-auto font-semibold underline hover:text-white">
                Cancel edit
              </button>
            </div>
          )}
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="tpl-name" className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Template name
              </label>
              <input id="tpl-name" aria-label="Template name (e.g. Furnace Tune-Up)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Template name (e.g. Furnace Tune-Up)"
                className="w-full rounded-lg border border-white/10 bg-ink-3/60 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-brand focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label htmlFor="tpl-category" className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Category
                </label>
                <select id="tpl-category" aria-label="Category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-ink-3/60 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
                >
                  {/* keep an unknown legacy category selectable so editing never loses it */}
                  {!categoryOptions.includes(category) && category && (
                    <option value={category}>{category}</option>
                  )}
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="w-28">
                <label htmlFor="tpl-mins" className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Est. minutes
                </label>
                <input id="tpl-mins" aria-label="Estimated minutes"
                  type="number"
                  min={0}
                  value={estimatedMins}
                  onChange={(e) => setEstimatedMins(+e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-ink-3/60 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
                  title="Estimated time on site, in minutes"
                />
              </div>
            </div>
          </div>

          {/* pricing / rate model */}
          <details className="mb-4 rounded-xl border border-white/10 bg-ink-3/30 p-3" open>
            <summary className="cursor-pointer select-none text-xs font-bold uppercase tracking-wide text-slate-400">
              Pricing &amp; rate model
            </summary>
            <p className="mb-3 mt-2 text-[11px] text-slate-500">
              Mix any components. Charged on completion using actual on-site time + tracked mileage.
            </p>
            <RateModelEditor value={rateModel} onChange={setRateModel} />
          </details>

          {fields.length === 0 ? (
            <div className="grid h-56 place-items-center rounded-xl border-2 border-dashed border-white/10 text-center">
              <div>
                <LayoutTemplate className="mx-auto mb-2 h-8 w-8 text-slate-700" />
                <p className="text-sm text-slate-500">Drag or click field types to build your form</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {fields.map((f, i) => {
                const Icon = iconFor(f.type);
                return (
                  <div key={f.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-ink-3/60 p-2.5">
                    <GripVertical className="h-4 w-4 text-slate-600" />
                    <Icon className="h-4 w-4 shrink-0 text-cyan-glow" />
                    <input aria-label="Label"
                      value={f.label}
                      onChange={(e) =>
                        setFields((arr) => arr.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                      }
                      className="flex-1 bg-transparent text-sm text-white focus:outline-none"
                    />
                    <label className="flex items-center gap-1 text-xs text-slate-400">
                      <input aria-label="Required"
                        type="checkbox"
                        checked={!!f.required}
                        onChange={(e) =>
                          setFields((arr) => arr.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)))
                        }
                        className="accent-brand"
                      />
                      required
                    </label>
                    <button
                      onClick={() => setFields((arr) => arr.filter((_, j) => j !== i))}
                      className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-5 flex gap-2">
            <button
              disabled={!name || fields.length === 0 || save.isPending}
              onClick={() => save.mutate()}
              className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {save.isPending ? "Saving…" : editingId ? "Update template" : "Save template"}
            </button>
            {(name || fields.length > 0) && (
              <button
                onClick={reset}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/5"
              >
                New blank
              </button>
            )}
          </div>
        </div>

        {/* existing templates */}
        <div className="nvc-card h-fit p-3">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Saved templates</p>
          {templates.isLoading ? (
            <FullLoader />
          ) : (
            <div className="space-y-2">
              {(templates.data?.templates ?? []).map((t: any) => {
                const fc = (() => {
                  try { return JSON.parse(t.fields || "[]").length; } catch { return 0; }
                })();
                const active = editingId === t.id;
                return (
                  <div
                    key={t.id}
                    className={`group rounded-lg border bg-ink-3/60 p-3 transition ${
                      active ? "border-brand/60 ring-1 ring-brand/30" : "border-white/10 hover:border-brand/40"
                    }`}
                  >
                    <button onClick={() => loadTemplate(t)} className="block w-full text-left">
                      <p className="text-sm font-semibold text-white">{t.name}</p>
                      <p className="text-xs text-slate-500">{t.category} · {fc} fields · ~{t.estimatedMins}m</p>
                    </button>
                    <div className="mt-2 flex gap-1">
                      <button
                        onClick={() => loadTemplate(t)}
                        className="flex flex-1 items-center justify-center gap-1 rounded-md bg-white/5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-white/10"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                      <button
                        onClick={() => duplicate(t)}
                        className="flex flex-1 items-center justify-center gap-1 rounded-md bg-white/5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-white/10"
                      >
                        <Copy className="h-3 w-3" /> Copy
                      </button>
                      <button
                        onClick={() => setDelId(t.id)}
                        className="grid h-6 w-7 place-items-center rounded-md bg-white/5 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {(templates.data?.templates ?? []).length === 0 && (
                <p className="px-1 py-4 text-xs text-slate-600">No templates yet</p>
              )}
            </div>
          )}
          <button
            onClick={reset}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 py-2 text-xs font-semibold text-slate-400 hover:bg-white/5"
          >
            <Plus className="h-3.5 w-3.5" /> New blank
          </button>
        </div>
      </div>

      <ConfirmModal
        open={!!delId}
        onClose={() => setDelId(null)}
        onConfirm={() => delId && del.mutate(delId)}
        title="Delete template"
        message={`Delete "${(delTarget as any)?.name ?? "this template"}"? Work orders already using it are unaffected.`}
        pending={del.isPending}
      />
    </PageWrap>
  );
}
