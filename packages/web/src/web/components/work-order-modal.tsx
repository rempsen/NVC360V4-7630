import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  ChevronDown,
  StickyNote,
  Type,
  CheckSquare,
  DollarSign,
  TrendingUp,
  Paperclip,
  BookOpen,
  Hash,
  GripVertical,
  Package,
  Wrench,
  Layers,
  Search,
  X,
  Ruler,
} from "lucide-react";
import { useWorkerNoun } from "../lib/use-brand";
import { api } from "../lib/api";
import { Modal, Field, inputCls, BtnGhost, BtnPrimary } from "./modal";
import { PRIORITY_META, money } from "../lib/utils";
import { RateModelEditor } from "./rate-model-editor";
import {
  EMPTY_RATE_MODEL,
  parseRateModel,
  computeSubtotal,
  type RateModel,
} from "../../shared/pricing";
import {
  buildLineItem,
  buildUnitLineItem,
  sumLineItems,
  normalizeCatalogItem,
  itemUnitPrice,
  type CatalogItem,
  type LineItem,
} from "../../shared/catalog";
import { lookupTax, regionFromAddress } from "../../shared/tax";
import { AddressAutocomplete } from "./address-autocomplete";

// ─── Custom field types ──────────────────────────────────────────────────────

export type CfType =
  | "notes"
  | "text"
  | "checkbox"
  | "flat_fee"
  | "price_logic"
  | "file"
  | "instructions"
  | "number";

export interface CustomField {
  id: string;
  type: CfType;
  label: string;
  // type-specific config
  placeholder?: string;       // text / notes
  defaultChecked?: boolean;   // checkbox
  amount?: number;            // flat_fee
  // price_logic: multiplier per unit
  logicRate?: number;
  logicUnit?: string;         // e.g. "per hour", "per sqft"
  // instructions: markdown-style body
  body?: string;
  required?: boolean;
}

const CF_TYPES: { type: CfType; icon: React.ReactNode; label: string; desc: string }[] = [
  { type: "notes",        icon: <StickyNote className="h-4 w-4" />,    label: "Notes",            desc: "Multi-line text note from dispatcher" },
  { type: "text",         icon: <Type className="h-4 w-4" />,          label: "Text field",       desc: "Single-line text input" },
  { type: "number",       icon: <Hash className="h-4 w-4" />,          label: "Number",           desc: "Numeric entry (qty, measurements, etc.)" },
  { type: "checkbox",     icon: <CheckSquare className="h-4 w-4" />,   label: "Checkbox",         desc: "Yes / No toggle" },
  { type: "flat_fee",     icon: <DollarSign className="h-4 w-4" />,    label: "Flat fee",         desc: "Fixed add-on to the job price" },
  { type: "price_logic",  icon: <TrendingUp className="h-4 w-4" />,    label: "Price logic",      desc: "Rate × quantity (per hour, sqft, unit…)" },
  { type: "file",         icon: <Paperclip className="h-4 w-4" />,     label: "File / Photo",     desc: "Technician can attach a file or photo" },
  { type: "instructions", icon: <BookOpen className="h-4 w-4" />,      label: "Instructions",     desc: "Static text block visible to the technician" },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Pill for the type picker ────────────────────────────────────────────────
function TypePicker({ onPick }: { onPick: (t: CfType) => void }) {
  const { noun } = useWorkerNoun();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-brand/50 bg-brand/5 px-3 py-2 text-sm font-medium text-brand hover:bg-brand/10 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Add field
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-white/10 bg-[#0d1b2a] shadow-2xl py-1.5">
          {CF_TYPES.map((t) => (
            <button
              key={t.type}
              type="button"
              onClick={() => { onPick(t.type); setOpen(false); }}
              className="flex w-full items-start gap-3 px-3.5 py-2.5 text-left hover:bg-white/5 transition-colors"
            >
              <span className="mt-0.5 shrink-0 text-brand">{t.icon}</span>
              <span>
                <span className="block text-sm font-semibold text-white">{t.label}</span>
                <span className="block text-xs text-slate-500">{t.desc.replace(/technician/g, noun.toLowerCase())}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Single custom field card ─────────────────────────────────────────────────
function CfCard({
  cf,
  onChange,
  onRemove,
}: {
  cf: CustomField;
  onChange: (updated: CustomField) => void;
  onRemove: () => void;
}) {
  const { noun } = useWorkerNoun();
  const meta = CF_TYPES.find((t) => t.type === cf.type)!;
  const upd = (patch: Partial<CustomField>) => onChange({ ...cf, ...patch });

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      {/* header row */}
      <div className="flex items-center gap-2 mb-3">
        <GripVertical className="h-4 w-4 shrink-0 text-slate-600 cursor-grab" />
        <span className="shrink-0 text-brand">{meta.icon}</span>
        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{meta.label}</span>
        <div className="flex-1" />
        <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
          <input
            aria-label="Required"
            type="checkbox"
            checked={!!cf.required}
            onChange={(e) => upd({ required: e.target.checked })}
            className="accent-brand"
          />
          Required
        </label>
        <button
          type="button"
          aria-label="Remove field"
          onClick={onRemove}
          className="ml-1 rounded-md p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* label */}
      {cf.type !== "instructions" && (
        <div className="mb-3">
          <span className="mb-1 block text-xs font-semibold text-slate-400">Field label</span>
          <input aria-label="Field label"
            value={cf.label}
            onChange={(e) => upd({ label: e.target.value })}
            placeholder={`${meta.label} label…`}
            className={inputCls}
          />
        </div>
      )}

      {/* type-specific config */}
      {(cf.type === "text" || cf.type === "notes") && (
        <div>
          <span className="mb-1 block text-xs font-semibold text-slate-400">Placeholder text (optional)</span>
          <input aria-label="Placeholder text (optional)"
            value={cf.placeholder ?? ""}
            onChange={(e) => upd({ placeholder: e.target.value })}
            placeholder="e.g. Describe the issue…"
            className={inputCls}
          />
        </div>
      )}

      {cf.type === "number" && (
        <div>
          <span className="mb-1 block text-xs font-semibold text-slate-400">Placeholder (optional)</span>
          <input aria-label="Placeholder (optional)"
            value={cf.placeholder ?? ""}
            onChange={(e) => upd({ placeholder: e.target.value })}
            placeholder="e.g. Enter quantity"
            className={inputCls}
          />
        </div>
      )}

      {cf.type === "checkbox" && (
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
          <input
            aria-label="Default checked"
            type="checkbox"
            checked={!!cf.defaultChecked}
            onChange={(e) => upd({ defaultChecked: e.target.checked })}
            className="accent-brand"
          />
          Default to checked
        </label>
      )}

      {cf.type === "flat_fee" && (
        <div>
          <span className="mb-1 block text-xs font-semibold text-slate-400">Add-on amount ($)</span>
          <div className="relative">
            <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
            <input aria-label="Add-on amount ($)"
              type="number"
              min={0}
              step={0.01}
              value={cf.amount ?? ""}
              onChange={(e) => upd({ amount: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
              className={`${inputCls} pl-7`}
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            This amount will be added to the job total when enabled.
          </p>
        </div>
      )}

      {cf.type === "price_logic" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="mb-1 block text-xs font-semibold text-slate-400">Rate ($ per unit)</span>
            <div className="relative">
              <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
              <input aria-label="Rate ($ per unit)"
                type="number"
                min={0}
                step={0.01}
                value={cf.logicRate ?? ""}
                onChange={(e) => upd({ logicRate: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                className={`${inputCls} pl-7`}
              />
            </div>
          </div>
          <div>
            <span className="mb-1 block text-xs font-semibold text-slate-400">Unit label</span>
            <input aria-label="Unit label"
              value={cf.logicUnit ?? ""}
              onChange={(e) => upd({ logicUnit: e.target.value })}
              placeholder="per hour, per sqft…"
              className={inputCls}
            />
          </div>
          <div className="col-span-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-400">
            {noun} enters a quantity → <span className="text-white font-semibold">${(cf.logicRate ?? 0).toFixed(2)} × qty</span> is added to the invoice.
          </div>
        </div>
      )}

      {cf.type === "file" && (
        <p className="text-xs text-slate-500">
          {noun} will see a file/photo attachment button for this field in the job screen.
        </p>
      )}

      {cf.type === "instructions" && (
        <div>
          <span className="mb-1 block text-xs font-semibold text-slate-400">Heading (optional)</span>
          <input aria-label="Heading (optional)"
            value={cf.label}
            onChange={(e) => upd({ label: e.target.value })}
            placeholder="e.g. Safety instructions"
            className={`${inputCls} mb-3`}
          />
          <span className="mb-1 block text-xs font-semibold text-slate-400">Instructions body</span>
          <textarea aria-label={`Write step-by-step instructions or any notes for the ${noun.toLowerCase()}…`}
            value={cf.body ?? ""}
            onChange={(e) => upd({ body: e.target.value })}
            rows={4}
            placeholder={`Write step-by-step instructions or any notes for the ${noun.toLowerCase()}…`}
            className={inputCls}
          />
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toLocalInput(d?: Date) {
  const dt = d ?? new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function WorkOrderModal({
  open,
  onClose,
  defaultDate,
  defaultRiderId,
  editBooking,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  defaultDate?: Date;
  defaultRiderId?: string;
  editBooking?: any;
  onCreated?: () => void;
}) {
  const isEdit = !!editBooking;
  const qc = useQueryClient();
  const { noun } = useWorkerNoun();

  // core fields
  const [customerId, setCustomerId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("normal");
  const [scheduledAt, setScheduledAt] = useState(toLocalInput(defaultDate));
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [riderId, setRiderId] = useState(defaultRiderId ?? "");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  const [region, setRegion] = useState("");
  const [rateModel, setRateModel] = useState<RateModel>({ ...EMPTY_RATE_MODEL });
  const [rateTouched, setRateTouched] = useState(false);
  const [estMinutes, setEstMinutes] = useState("60");
  const [estKm, setEstKm] = useState("0");

  // custom fields
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  // catalog line items
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  const catalog = useQuery({
    queryKey: ["catalog"],
    queryFn: async () => (await api.catalog.$get({ query: {} })).json(),
    enabled: open,
  });
  const catalogItems = useMemo<CatalogItem[]>(
    () => (((catalog.data as any)?.items ?? []) as any[]).map(normalizeCatalogItem),
    [catalog.data],
  );
  const catalogLookup = useMemo(() => {
    const m = new Map(catalogItems.map((i) => [i.id, i]));
    return (id: string) => m.get(id);
  }, [catalogItems]);

  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => (await api.admin.users.$get()).json(),
    enabled: open,
  });
  const services = useQuery({
    queryKey: ["services"],
    queryFn: async () => (await api.services.$get()).json(),
    enabled: open,
  });
  const templates = useQuery({
    queryKey: ["templates"],
    queryFn: async () => (await api.templates.$get()).json(),
    enabled: open,
  });
  const riders = useQuery({
    queryKey: ["riders"],
    queryFn: async () => (await api.riders.$get()).json(),
    enabled: open,
  });

  const clients = useMemo(
    () => (users.data?.users ?? []).filter((u: any) => u.role === "customer"),
    [users.data],
  );

  // default rate model from template / service
  useEffect(() => {
    if (rateTouched) return;
    const tpl = (templates.data?.templates ?? []).find((t: any) => t.id === templateId);
    const svc = (services.data?.services ?? []).find((s: any) => s.id === serviceId);
    const fromTpl = parseRateModel(tpl?.rateModel);
    const fromSvc = parseRateModel(svc?.rateModel);
    const next = fromTpl ?? fromSvc;
    if (next) setRateModel(next);
    else if (svc) setRateModel({ ...EMPTY_RATE_MODEL, flatRate: svc.basePrice || 0 });
  }, [templateId, serviceId, templates.data, services.data, rateTouched]);

  // infer region from address
  useEffect(() => {
    if (!region && address) {
      const r = regionFromAddress(address);
      if (r) setRegion(r);
    }
  }, [address]); // eslint-disable-line

  // default est. minutes from template/service
  useEffect(() => {
    const tpl = (templates.data?.templates ?? []).find((t: any) => t.id === templateId);
    const svc = (services.data?.services ?? []).find((s: any) => s.id === serviceId);
    const mins = tpl?.estimatedMins ?? svc?.durationMins;
    if (mins) setEstMinutes(String(mins));
  }, [templateId, serviceId, templates.data, services.data]);

  // live price preview (includes flat-fee custom fields)
  const quote = useMemo(() => {
    const { subtotal: base, items } = computeSubtotal(
      rateModel,
      Math.max(0, Number(estMinutes) || 0),
      Math.max(0, Number(estKm) || 0),
    );
    const cfExtra = customFields
      .filter((f) => f.type === "flat_fee" && f.amount)
      .reduce((s, f) => s + (f.amount ?? 0), 0);
    const catalogLines = lineItems.filter((l) => l.kind !== "unit");
    const unitLines = lineItems.filter((l) => l.kind === "unit");
    const cat = sumLineItems(catalogLines);
    const unit = sumLineItems(unitLines);
    const li = sumLineItems(lineItems);
    const subtotal = Math.round((base + cfExtra + li.price) * 100) / 100;
    const tax = lookupTax(region);
    const taxRate = tax?.rate ?? 0;
    // service/labor base + cf are taxable; line items respect their own taxable flag
    const taxableBase = base + cfExtra + li.taxablePrice;
    const taxAmount = Math.round(taxableBase * taxRate) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;
    // unit lines: charge = price, tech pay = cost
    const unitCharge = unit.price;
    const unitPay = unit.cost;
    return {
      subtotal,
      items,
      cfExtra,
      lineItemsPrice: cat.price,
      lineItemsCost: cat.cost,
      lineItemsMargin: cat.margin,
      unitCharge,
      unitPay,
      taxLabel: tax?.label ?? "No tax region",
      taxAmount,
      total,
    };
  }, [rateModel, estMinutes, estKm, region, customFields, lineItems]);

  // populate from editBooking
  useEffect(() => {
    if (!open) return;
    setErr("");
    if (editBooking) {
      const b = editBooking;
      setCustomerId(b.customerId ?? "");
      setServiceId(b.serviceId ?? "");
      setTemplateId(b.templateId ?? "");
      setTitle(b.title ?? "");
      setPriority(b.priority ?? "normal");
      setScheduledAt(b.scheduledAt ? toLocalInput(new Date(b.scheduledAt)) : toLocalInput());
      setAddress(b.address ?? "");
      setLat(b.lat ?? null);
      setLng(b.lng ?? null);
      setRiderId(b.riderId ?? "");
      setNotes(b.notes ?? "");
      setRegion(b.region ?? "");
      const rm = parseRateModel(b.rateModel);
      if (rm) { setRateModel(rm); setRateTouched(true); }
      try {
        const li = typeof b.lineItems === "string" ? JSON.parse(b.lineItems || "[]") : b.lineItems;
        setLineItems(Array.isArray(li) ? li : []);
      } catch { setLineItems([]); }
      // restore custom fields if any
      try {
        const fd = JSON.parse(b.fieldData || "{}");
        if (Array.isArray(fd._customFields)) setCustomFields(fd._customFields);
        else setCustomFields([]);
      } catch { setCustomFields([]); }
    } else {
      setScheduledAt(toLocalInput(defaultDate));
      setRiderId(defaultRiderId ?? "");
      setCustomFields([]);
      setLineItems([]);
    }
  }, [open, defaultDate, defaultRiderId, editBooking]);

  // ── mutations ──────────────────────────────────────────────────────────────

  function buildPayload() {
    return {
      customerId,
      serviceId,
      templateId: templateId || undefined,
      title: title || undefined,
      priority,
      scheduledAt: new Date(scheduledAt).toISOString(),
      address,
      lat: lat ?? undefined,
      lng: lng ?? undefined,
      notes,
      riderId: riderId || undefined,
      region: region || undefined,
      rateModel,
      lineItems,
      fieldData: { _customFields: customFields },
    };
  }

  const create = useMutation({
    mutationFn: async () => {
      const res = await api.bookings.admin.$post({ json: buildPayload() as any });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}) as any);
        throw new Error((e as any).message || "Failed to create work order");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["scheduler"] });
      qc.invalidateQueries({ queryKey: ["riders"] });
      reset();
      onCreated?.();
      onClose();
    },
    onError: (e: any) => setErr(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const res = await api.bookings[":id"].$patch({
        param: { id: editBooking.id },
        json: {
          ...buildPayload(),
          templateId: templateId || "",
          riderId: riderId || "",
          region: region || "",
        } as any,
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}) as any);
        throw new Error((e as any).message || "Failed to update work order");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["scheduler"] });
      qc.invalidateQueries({ queryKey: ["riders"] });
      onCreated?.();
      onClose();
    },
    onError: (e: any) => setErr(e.message),
  });

  function reset() {
    setCustomerId(""); setServiceId(""); setTemplateId(""); setTitle("");
    setPriority("normal"); setAddress(""); setLat(null); setLng(null);
    setRiderId(""); setNotes(""); setRegion("");
    setRateModel({ ...EMPTY_RATE_MODEL }); setRateTouched(false);
    setEstMinutes("60"); setEstKm("0"); setCustomFields([]); setLineItems([]);
  }

  function addCatalogItem(item: CatalogItem, qty: number) {
    const li = buildLineItem(item, qty, catalogLookup);
    setLineItems((prev) => {
      const idx = prev.findIndex((p) => p.itemId === li.itemId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = buildLineItem(item, (prev[idx].qty || 0) + qty, catalogLookup);
        return next;
      }
      return [...prev, li];
    });
  }
  function setLineQty(itemId: string, qty: number) {
    setLineItems((prev) =>
      prev.map((p) => {
        if (p.itemId !== itemId) return p;
        const item = catalogLookup(itemId);
        if (item) return buildLineItem(item, qty, catalogLookup);
        return { ...p, qty, cost: Math.round(p.unitCost * qty * 100) / 100, price: Math.round(p.unitPrice * qty * 100) / 100 };
      }),
    );
  }
  function removeLine(itemId: string) {
    setLineItems((prev) => prev.filter((p) => p.itemId !== itemId));
  }

  // ── ad-hoc per-unit lines (charge + tech pay) ──
  function addUnitLine() {
    setLineItems((prev) => [
      ...prev,
      buildUnitLineItem({ name: "", unit: "sq/ft", qty: 1, unitPrice: 0, unitPayRate: 0 }),
    ]);
  }
  function updateUnitLine(
    itemId: string,
    patch: Partial<{ name: string; unit: string; qty: number; unitPrice: number; unitPayRate: number; taxable: boolean }>,
  ) {
    setLineItems((prev) =>
      prev.map((p) => {
        if (p.itemId !== itemId || p.kind !== "unit") return p;
        return buildUnitLineItem({
          itemId: p.itemId,
          name: patch.name ?? p.name,
          unit: patch.unit ?? p.unit,
          qty: patch.qty ?? p.qty,
          unitPrice: patch.unitPrice ?? p.unitPrice,
          unitPayRate: patch.unitPayRate ?? p.unitCost,
          taxable: patch.taxable ?? p.taxable,
        });
      }),
    );
  }

  function submit() {
    setErr("");
    if (!customerId) return setErr("Select a client");
    if (!serviceId) return setErr("Select a service");
    if (!scheduledAt) return setErr("Pick a schedule date");
    if (isEdit) update.mutate();
    else create.mutate();
  }

  function addField(type: CfType) {
    const meta = CF_TYPES.find((t) => t.type === type)!;
    setCustomFields((prev) => [
      ...prev,
      { id: uid(), type, label: meta.label, required: false },
    ]);
  }

  const busy = create.isPending || update.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Work Order" : "New Work Order"}
      subtitle={isEdit ? "Adjust any detail of this job" : "Schedule a job on behalf of a client"}
      size="lg"
      footer={
        <>
          <BtnGhost onClick={onClose}>Cancel</BtnGhost>
          <BtnPrimary onClick={submit} disabled={busy}>
            {busy ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save Changes" : "Create Work Order")}
          </BtnPrimary>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">

        {/* ── Core fields ── */}
        <Field label="Client">
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputCls}>
            <option value="">Select client…</option>
            {clients.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name} — {c.email}</option>
            ))}
          </select>
        </Field>

        <Field label="Service">
          <select value={serviceId} onChange={(e) => {
            setServiceId(e.target.value);
            const s = (services.data?.services ?? []).find((x: any) => x.id === e.target.value);
            if (s && !title) setTitle(s.name);
          }} className={inputCls}>
            <option value="">Select service…</option>
            {(services.data?.services ?? []).map((s: any) => (
              <option key={s.id} value={s.id}>{s.name} — ${s.basePrice}</option>
            ))}
          </select>
        </Field>

        <Field label="Template" hint="Optional checklist preset">
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={inputCls}>
            <option value="">None</option>
            {(templates.data?.templates ?? []).map((t: any) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Priority">
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
            {Object.entries(PRIORITY_META).map(([k, v]: any) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Title">
          <input aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Job title" className={inputCls} />
        </Field>

        <Field label="Schedule">
          <input aria-label="Schedule" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={inputCls} />
        </Field>

        {/* ── Address autocomplete ── */}
        <div className="sm:col-span-2">
          <Field label="Address">
            <AddressAutocomplete
              value={address}
              onResolve={(v) => {
                setAddress(v.address);
                setLat(v.lat);
                setLng(v.lng);
                if (v.address && !region) {
                  const r = regionFromAddress(v.address);
                  if (r) setRegion(r);
                }
              }}
              placeholder="Start typing an address…"
            />
          </Field>
        </div>

        <Field label={`Assign ${noun}`} hint="Optional — auto-dispatches">
          <select aria-label={`Assign ${noun}`} value={riderId} onChange={(e) => setRiderId(e.target.value)} className={inputCls}>
            <option value="">Leave unassigned</option>
            {(riders.data?.riders ?? []).map((r: any) => (
              <option key={r.id} value={r.id}>{r.name} {r.status ? `(${r.status})` : ""}</option>
            ))}
          </select>
        </Field>

        <Field label="Tax region">
          <select value={region} onChange={(e) => setRegion(e.target.value)} className={inputCls}>
            <option value="">Auto-detect from address</option>
            <option value="ON">Ontario (HST 13%)</option>
            <option value="BC">British Columbia (GST+PST 12%)</option>
            <option value="AB">Alberta (GST 5%)</option>
            <option value="QC">Québec (GST+QST 14.975%)</option>
            <option value="MB">Manitoba (GST+PST 12%)</option>
            <option value="SK">Saskatchewan (GST+PST 11%)</option>
            <option value="NS">Nova Scotia (HST 15%)</option>
            <option value="NB">New Brunswick (HST 15%)</option>
            <option value="PE">PEI (HST 15%)</option>
            <option value="NL">Newfoundland (HST 15%)</option>
          </select>
        </Field>

        <Field label="Est. minutes on site" hint="Billable time">
          <input aria-label="Est. minutes on site" type="number" inputMode="numeric" min={0} value={estMinutes}
            onChange={(e) => setEstMinutes(e.target.value)}
            onBlur={(e) => setEstMinutes(String(Math.max(0, Number(e.target.value) || 0)))}
            className={inputCls} />
        </Field>

        <Field label="Est. mileage (km)" hint="Round-trip travel">
          <input aria-label="Est. mileage (km)" type="number" inputMode="decimal" min={0} value={estKm}
            onChange={(e) => setEstKm(e.target.value)}
            onBlur={(e) => setEstKm(String(Math.max(0, Number(e.target.value) || 0)))}
            className={inputCls} />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Notes">
            <textarea aria-label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={3} placeholder="Additional details…" className={inputCls} />
          </Field>
        </div>

        {/* ── Catalog line items ── */}
        <div className="sm:col-span-2">
          <CatalogLineItems
            items={catalogItems}
            lineItems={lineItems.filter((l) => l.kind !== "unit")}
            lookup={catalogLookup}
            onAdd={addCatalogItem}
            onQty={setLineQty}
            onRemove={removeLine}
          />
        </div>

        {/* ── Per-unit line items (charge + tech pay) ── */}
        <div className="sm:col-span-2">
          <UnitLineItems
            lines={lineItems.filter((l) => l.kind === "unit")}
            workerNoun={noun}
            onAdd={addUnitLine}
            onChange={updateUnitLine}
            onRemove={removeLine}
          />
        </div>

        {/* ── Rate model ── */}
        <div className="sm:col-span-2">
          <RateModelEditor
            value={rateModel}
            onChange={(v) => { setRateModel(v); setRateTouched(true); }}
          />
        </div>

        {/* ── Price preview ── */}
        <div className="sm:col-span-2 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-400">
            Price preview
          </div>
          <div className="space-y-1 text-sm">
            {quote.items.length === 0 && !quote.cfExtra && !quote.lineItemsPrice && !quote.unitCharge && !quote.unitPay ? (
              <p className="text-slate-500">Pick a service or add fields to see pricing.</p>
            ) : (
              <>
                {quote.items.map((it: any, i: number) => (
                  <div key={i} className="flex justify-between text-slate-300">
                    <span>{it.label}</span>
                    <span>${it.amount.toFixed(2)}</span>
                  </div>
                ))}
                {quote.cfExtra > 0 && (
                  <div className="flex justify-between text-slate-300">
                    <span>Custom field add-ons</span>
                    <span>+${quote.cfExtra.toFixed(2)}</span>
                  </div>
                )}
                {quote.lineItemsPrice > 0 && (
                  <div className="flex justify-between text-slate-300">
                    <span>
                      Catalog items{" "}
                      <span className="text-[11px] text-emerald-400">
                        (margin ${quote.lineItemsMargin.toFixed(2)})
                      </span>
                    </span>
                    <span>+${quote.lineItemsPrice.toFixed(2)}</span>
                  </div>
                )}
                {quote.unitCharge > 0 && (
                  <div className="flex justify-between text-slate-300">
                    <span>Per-unit line items</span>
                    <span>+${quote.unitCharge.toFixed(2)}</span>
                  </div>
                )}
                {(quote.items.length > 0 || quote.cfExtra > 0 || quote.lineItemsPrice > 0 || quote.unitCharge > 0) && (
                  <>
                    <div className="flex justify-between border-t border-white/10 pt-1 text-slate-400">
                      <span>Subtotal</span><span>${quote.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>{quote.taxLabel}</span><span>${quote.taxAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-1 text-base font-semibold text-white">
                      <span>Total</span><span>${quote.total.toFixed(2)}</span>
                    </div>
                    {quote.unitPay > 0 && (
                      <div className="mt-1 flex justify-between border-t border-white/10 pt-1.5 text-amber-400">
                        <span>{noun} pay (per-unit lines)</span>
                        <span>${quote.unitPay.toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Custom fields section ── */}
        <div className="sm:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Custom fields</p>
              <p className="text-xs text-slate-500">Add extra data collection, instructions, or pricing rules to this job.</p>
            </div>
            <TypePicker onPick={addField} />
          </div>

          {customFields.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 py-8 text-center text-sm text-slate-600">
              No custom fields yet — click <span className="text-brand font-medium">Add field</span> to start.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {customFields.map((cf, _i) => (
                <CfCard
                  key={cf.id}
                  cf={cf}
                  onChange={(updated) =>
                    setCustomFields((prev) =>
                      prev.map((x) => (x.id === cf.id ? updated : x)),
                    )
                  }
                  onRemove={() =>
                    setCustomFields((prev) => prev.filter((x) => x.id !== cf.id))
                  }
                />
              ))}
              {/* add another inline */}
              <div className="pt-1">
                <TypePicker onPick={addField} />
              </div>
            </div>
          )}
        </div>
      </div>

      {err && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{err}</p>
      )}
    </Modal>
  );
}

// ─── Catalog line-item picker ────────────────────────────────────────────────

const KIND_ICON = { service: Wrench, product: Package, assembly: Layers } as const;

function CatalogLineItems({
  items,
  lineItems,
  lookup,
  onAdd,
  onQty,
  onRemove,
}: {
  items: CatalogItem[];
  lineItems: LineItem[];
  lookup: (id: string) => CatalogItem | undefined;
  onAdd: (item: CatalogItem, qty: number) => void;
  onQty: (itemId: string, qty: number) => void;
  onRemove: (itemId: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState("");

  const totals = sumLineItems(lineItems);
  const filtered = items.filter((i) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      i.name.toLowerCase().includes(s) ||
      i.sku.toLowerCase().includes(s) ||
      i.category.toLowerCase().includes(s)
    );
  });

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Products & materials</p>
          <p className="text-xs text-slate-500">
            Add catalog items (parts, materials, fixed services, assemblies).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPicking((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-deep"
        >
          <Plus className="h-3.5 w-3.5" /> Add from catalog
        </button>
      </div>

      {picking && (
        <div className="mb-3 rounded-lg border border-white/10 bg-ink-2 p-2">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              aria-label="Search catalog"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search catalog…"
              className="w-full rounded-md border border-white/10 bg-ink px-2.5 py-1.5 pl-8 text-sm outline-none focus:border-brand"
            />
          </div>
          <div className="max-h-52 space-y-1 overflow-y-auto">
            {filtered.map((i) => {
              const Icon = KIND_ICON[i.kind];
              const price = itemUnitPrice(i, lookup);
              return (
                <button
                  type="button"
                  key={i.id}
                  onClick={() => {
                    onAdd(i, 1);
                    setPicking(false);
                    setQ("");
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-white/5"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{i.name}</span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {money(price)}/{i.unit}
                  </span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-slate-500">No items found.</p>
            )}
          </div>
        </div>
      )}

      {lineItems.length === 0 ? (
        <p className="text-xs text-slate-500">No items added.</p>
      ) : (
        <div className="space-y-1.5">
          {lineItems.map((li) => {
            const Icon = KIND_ICON[li.kind] ?? Package;
            return (
              <div key={li.itemId} className="rounded-lg bg-white/5 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white">{li.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {money(li.unitPrice)}/{li.unit}
                      {!li.taxable && <span className="ml-1 text-slate-600">· no tax</span>}
                    </div>
                  </div>
                  <input
                    aria-label={`Quantity for ${li.name}`}
                    type="number"
                    min={0}
                    step="any"
                    value={li.qty}
                    inputMode="decimal"
                    onChange={(e) => {
                      const v = e.target.value;
                      onQty(li.itemId, v === "" ? 0 : Math.max(0, Number(v) || 0));
                    }}
                    className="w-16 rounded-md border border-white/10 bg-ink-2 px-2 py-1 text-sm outline-none focus:border-brand"
                  />
                  <span className="w-20 shrink-0 text-right text-sm font-semibold text-white">
                    {money(li.price)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(li.itemId)}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-white/10 hover:text-red-400"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {li.components && li.components.length > 0 && (
                  <div className="mt-1.5 space-y-0.5 border-l border-white/10 pl-4">
                    {li.components.map((c, idx) => (
                      <div key={idx} className="flex justify-between text-[11px] text-slate-500">
                        <span>
                          {c.name} × {c.qty} {c.unit}
                        </span>
                        <span>{money(c.unitPrice * c.qty)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex items-center justify-between border-t border-white/10 pt-2 text-xs">
            <span className="text-slate-400">
              {lineItems.length} item{lineItems.length > 1 ? "s" : ""} · cost {money(totals.cost)}
            </span>
            <span className="text-emerald-400">
              {money(totals.price)} · {totals.marginPct}% margin
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Ad-hoc per-unit line items (charge + tech pay) ──────────────────────────

const UNIT_OPTIONS = ["sq/ft", "sq/yd", "linear ft", "piece", "each", "hour"];

function UnitLineItems({
  lines,
  workerNoun,
  onAdd,
  onChange,
  onRemove,
}: {
  lines: LineItem[];
  workerNoun: string;
  onAdd: () => void;
  onChange: (
    itemId: string,
    patch: Partial<{ name: string; unit: string; qty: number; unitPrice: number; unitPayRate: number; taxable: boolean }>,
  ) => void;
  onRemove: (itemId: string) => void;
}) {
  const totalCharge = lines.reduce((s, l) => s + (l.price || 0), 0);
  const totalPay = lines.reduce((s, l) => s + (l.cost || 0), 0);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
            <Ruler className="h-4 w-4 text-brand" /> Per-unit line items
          </p>
          <p className="text-xs text-slate-500">
            Charge the client and pay the {workerNoun.toLowerCase()} by measured unit
            (e.g. $6.00/sq-yd carpet install). Set charge to $0 for a pay-only line.
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-deep"
        >
          <Plus className="h-3.5 w-3.5" /> Add line
        </button>
      </div>

      {lines.length === 0 ? (
        <p className="text-xs text-slate-500">No per-unit lines added.</p>
      ) : (
        <div className="space-y-2">
          {/* header (sm+) */}
          <div className="hidden gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:grid sm:grid-cols-[1fr_88px_64px_92px_92px_84px_28px]">
            <span>Description</span>
            <span>Unit</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Charge/unit</span>
            <span className="text-right">Pay/unit</span>
            <span className="text-right">Line</span>
            <span />
          </div>

          {lines.map((l) => {
            const lineCharge = l.price || 0;
            const linePay = l.cost || 0;
            const customUnit = !UNIT_OPTIONS.includes(l.unit);
            return (
              <div
                key={l.itemId}
                className="grid grid-cols-2 gap-2 rounded-lg bg-white/5 p-2 sm:grid-cols-[1fr_88px_64px_92px_92px_84px_28px] sm:items-center sm:bg-transparent sm:p-1"
              >
                {/* description */}
                <input
                  aria-label="Line description"
                  value={l.name}
                  onChange={(e) => onChange(l.itemId, { name: e.target.value })}
                  placeholder="e.g. LVP install"
                  className="col-span-2 rounded-md border border-white/10 bg-ink-2 px-2 py-1.5 text-sm outline-none focus:border-brand sm:col-span-1"
                />

                {/* unit */}
                <div className="flex flex-col gap-1">
                  <select
                    aria-label="Unit"
                    value={customUnit ? "__custom__" : l.unit}
                    onChange={(e) => {
                      const v = e.target.value;
                      onChange(l.itemId, { unit: v === "__custom__" ? "" : v });
                    }}
                    className="rounded-md border border-white/10 bg-ink-2 px-1.5 py-1.5 text-xs outline-none focus:border-brand"
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                    <option value="__custom__">Custom…</option>
                  </select>
                  {customUnit && (
                    <input
                      aria-label="Custom unit"
                      value={l.unit}
                      onChange={(e) => onChange(l.itemId, { unit: e.target.value })}
                      placeholder="unit"
                      className="rounded-md border border-white/10 bg-ink-2 px-1.5 py-1 text-xs outline-none focus:border-brand"
                    />
                  )}
                </div>

                {/* qty */}
                <input
                  aria-label="Quantity"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={l.qty}
                  onChange={(e) =>
                    onChange(l.itemId, { qty: e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0) })
                  }
                  className="rounded-md border border-white/10 bg-ink-2 px-2 py-1.5 text-right text-sm outline-none focus:border-brand"
                />

                {/* charge per unit */}
                <div className="relative">
                  <span aria-hidden className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">$</span>
                  <input
                    aria-label="Charge per unit"
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={l.unitPrice}
                    onChange={(e) => onChange(l.itemId, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-full rounded-md border border-white/10 bg-ink-2 py-1.5 pl-5 pr-1.5 text-right text-sm outline-none focus:border-brand"
                  />
                </div>

                {/* pay per unit */}
                <div className="relative">
                  <span aria-hidden className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-amber-500/70">$</span>
                  <input
                    aria-label="Pay per unit"
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={l.unitCost}
                    onChange={(e) => onChange(l.itemId, { unitPayRate: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-full rounded-md border border-white/10 bg-ink-2 py-1.5 pl-5 pr-1.5 text-right text-sm text-amber-300 outline-none focus:border-brand"
                  />
                </div>

                {/* line totals */}
                <div className="text-right text-sm leading-tight">
                  <div className="font-semibold text-white">{money(lineCharge)}</div>
                  <div className="text-[11px] text-amber-400">pay {money(linePay)}</div>
                </div>

                {/* remove */}
                <button
                  type="button"
                  aria-label="Remove line"
                  onClick={() => onRemove(l.itemId)}
                  className="grid h-7 w-7 shrink-0 place-items-center justify-self-end rounded-md text-slate-500 hover:bg-white/10 hover:text-red-400"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}

          <div className="flex items-center justify-between border-t border-white/10 pt-2 text-xs">
            <span className="text-slate-400">
              {lines.length} line{lines.length > 1 ? "s" : ""}
            </span>
            <span className="flex gap-3">
              <span className="text-white">charge {money(totalCharge)}</span>
              <span className="text-amber-400">{workerNoun.toLowerCase()} pay {money(totalPay)}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
