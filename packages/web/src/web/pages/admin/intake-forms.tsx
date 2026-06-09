import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiHeaders } from "../../lib/api";
import { Modal, Field, inputCls, BtnPrimary, BtnGhost, ConfirmModal } from "../../components/modal";
import {
  FileText, Plus, Copy, Check, Trash2, ExternalLink, Code2, Pencil,
  GripVertical, ChevronDown, ChevronUp, Mail, LayoutList, Wrench, AlertTriangle,
} from "lucide-react";

// ---------------------------------------------------------------- types
type FieldType =
  | "text" | "textarea" | "email" | "phone" | "number"
  | "select" | "radio" | "checkbox" | "date" | "address" | "file";

type FieldCfg = {
  id: string;
  key: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  options?: string[];
  enabled: boolean;
  required: boolean;
  sectionId?: string;
  width?: "full" | "half";
  fixed?: boolean;
  core?: boolean;
};
type SectionCfg = { id: string; title: string; description?: string };
type IntakeForm = {
  id: string; companyId: string; slug: string; title: string; intro: string;
  fields: FieldCfg[]; sections: SectionCfg[];
  recipientName: string; recipientEmail: string;
  publicKeyId: string; brandColor: string; logoUrl: string;
  successMessage: string; active: boolean; submitCount: number; createdAt: number;
};
type PubKey = { id: string; label: string; prefix: string; keyType: string; active: boolean; publicKey?: string };

const FIELD_TYPES: { value: FieldType; label: string; hasOptions?: boolean }[] = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text / paragraph" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "number", label: "Number" },
  { value: "select", label: "Dropdown", hasOptions: true },
  { value: "radio", label: "Single choice (radio)", hasOptions: true },
  { value: "checkbox", label: "Multi choice (checkboxes)", hasOptions: true },
  { value: "date", label: "Date" },
  { value: "address", label: "Address (autocomplete)" },
  { value: "file", label: "File / photo upload" },
];
const hasOptions = (t: FieldType) => ["select", "radio", "checkbox"].includes(t);

// ---------------------------------------------------------------- api utils
const authHeaders = () => ({ ...apiHeaders(), "Content-Type": "application/json" });
async function jget<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: authHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function jsend<T>(url: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(url, { method, headers: authHeaders(), body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;
const slugFromLabel = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32) || "field";

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button"
      onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5">
      {done ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      {label ?? (done ? "Copied" : "Copy")}
    </button>
  );
}

const DEFAULT_FIELDS: FieldCfg[] = [
  { id: "f_name", key: "name", type: "text", label: "Full name", enabled: true, required: true, fixed: true, core: true, width: "full" },
  { id: "f_email", key: "email", type: "email", label: "Email", enabled: true, required: true, core: true, width: "half" },
  { id: "f_phone", key: "phone", type: "phone", label: "Phone", enabled: true, required: true, core: true, width: "half" },
  { id: "f_address", key: "address", type: "address", label: "Service address", enabled: true, required: true, core: true, width: "full" },
  { id: "f_serviceType", key: "serviceType", type: "select", label: "Service type", enabled: true, required: false, core: true, width: "half" },
  { id: "f_preferredAt", key: "preferredAt", type: "date", label: "Preferred date", enabled: true, required: false, core: true, width: "half" },
  { id: "f_notes", key: "notes", type: "textarea", label: "Notes / describe the problem", enabled: true, required: false, core: true, width: "full" },
  { id: "f_photo", key: "photo", type: "file", label: "Photo upload", enabled: true, required: false, core: true, width: "full" },
];

// ================================================================ PAGE
export default function IntakeFormsPage() {
  const keysQ = useQuery({ queryKey: ["api-keys"], queryFn: () => jget<{ keys: PubKey[] }>("/api/api-keys") });
  const publicKeys = (keysQ.data?.keys ?? []).filter((k) => k.keyType === "public");
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold text-white">Intake Forms</h1>
        <p className="mt-1 text-sm text-slate-400">Build customer-facing forms with custom sections, fields, and a designated recipient. Each submission creates a pipeline lead and emails your recipient.</p>
      </div>
      <IntakeFormsSection publicKeys={publicKeys} />
    </div>
  );
}

// ================================================================ LIST
export function IntakeFormsSection({ publicKeys }: { publicKeys: PubKey[] }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<IntakeForm | null>(null);
  const [creating, setCreating] = useState(false);
  const [delTarget, setDelTarget] = useState<IntakeForm | null>(null);
  const [embedFor, setEmbedFor] = useState<IntakeForm | null>(null);

  const formsQ = useQuery({ queryKey: ["intake-forms"], queryFn: () => jget<{ forms: IntakeForm[]; publicBase: string }>("/api/forms") });
  const forms = formsQ.data?.forms ?? [];
  const base = formsQ.data?.publicBase ?? window.location.origin;
  const activePubKeys = publicKeys.filter((k) => k.keyType === "public" && k.active);

  // Forms route every submission to a bookable service. If the tenant has none,
  // submissions can't be turned into jobs — warn early and offer a one-click fix
  // instead of letting a customer hit a dead-end at submit time.
  const servicesQ = useQuery({ queryKey: ["services"], queryFn: () => jget<{ services: { id: string; name: string }[] }>("/api/services") });
  const serviceCount = servicesQ.data?.services?.length ?? 0;
  const hasNoServices = servicesQ.isSuccess && serviceCount === 0;
  const createServiceM = useMutation({
    mutationFn: () => jsend("/api/services", "POST", {
      name: "General Request",
      category: "general",
      description: "Captures intake form requests. Rename or customize anytime in Catalog → Services.",
      icon: "clipboard-list",
      basePrice: 0,
      durationMins: 60,
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
  });

  const delM = useMutation({
    mutationFn: (id: string) => jsend(`/api/forms/${id}`, "DELETE"),
    onSuccess: () => { setDelTarget(null); qc.invalidateQueries({ queryKey: ["intake-forms"] }); },
  });

  const publicUrl = (f: IntakeForm) => {
    const key = activePubKeys.find((k) => k.id === f.publicKeyId);
    const full = key?.publicKey;
    const u = `${base}/f/${f.companyId}/${f.slug}`;
    return full ? `${u}?k=${full}` : u;
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-ink-2">
      <div className="flex items-center gap-2 border-b border-white/5 px-5 py-4">
        <FileText className="h-5 w-5 text-cyan-glow" />
        <h2 className="font-display text-lg font-bold text-white">Forms</h2>
        <span className="ml-auto text-xs text-slate-500">{forms.length} total</span>
        <BtnPrimary onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New form</BtnPrimary>
      </div>

      {hasNoServices && (
        <div className="mx-5 mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-amber-100">No bookable services yet</div>
            <div className="mt-0.5 text-xs text-amber-200/80">
              Every form submission becomes a job tied to a service. Add at least one so requests don’t dead-end — you can rename and price it later in Catalog → Services.
            </div>
          </div>
          <button
            onClick={() => createServiceM.mutate()}
            disabled={createServiceM.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-amber-950 hover:bg-amber-300 disabled:opacity-60"
          >
            <Wrench className="h-3.5 w-3.5" />
            {createServiceM.isPending ? "Creating…" : "Create a service"}
          </button>
        </div>
      )}

      {activePubKeys.length === 0 && (
        <div className="mx-5 mt-4 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">
          No publishable key yet — that’s fine. Open <span className="font-semibold">New form</span> and click <span className="font-semibold">“+ Create publishable key”</span> right inside the editor.
        </div>
      )}

      {forms.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-slate-500">No intake forms yet. Create one to capture leads.</div>
      ) : (
        <div className="divide-y divide-white/5">
          {forms.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{f.title}</span>
                  {f.active
                    ? <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">Live</span>
                    : <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-[11px] font-semibold text-slate-400">Disabled</span>}
                  {!f.publicKeyId && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">No key bound</span>}
                  {!f.recipientEmail && <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300">No recipient</span>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <code className="text-slate-400">/f/{f.companyId}/{f.slug}</code>
                  <span>{f.submitCount} submission{f.submitCount === 1 ? "" : "s"}</span>
                  <span>{f.fields.filter((x) => x.enabled).length} fields</span>
                  {f.recipientEmail && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {f.recipientEmail}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CopyBtn text={publicUrl(f)} label="Copy link" />
                <a href={publicUrl(f)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5"><ExternalLink className="h-3.5 w-3.5" /> Open</a>
                <button onClick={() => setEmbedFor(f)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5"><Code2 className="h-3.5 w-3.5" /> Embed</button>
                <button onClick={() => setEditing(f)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                <button onClick={() => setDelTarget(f)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-rose-300 hover:bg-white/5"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <FormEditor
          form={editing}
          publicKeys={activePubKeys}
          onKeysChanged={() => qc.invalidateQueries({ queryKey: ["api-keys"] })}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); qc.invalidateQueries({ queryKey: ["intake-forms"] }); }}
        />
      )}

      <EmbedModal form={embedFor} base={base} publicKeys={activePubKeys} onClose={() => setEmbedFor(null)} />

      <ConfirmModal
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        onConfirm={() => delTarget && delM.mutate(delTarget.id)}
        title="Delete intake form?"
        message={`"${delTarget?.title}" and its public link will stop working. Submissions already captured stay in the pipeline.`}
        confirmLabel="Delete"
        pending={delM.isPending}
      />
    </div>
  );
}

// ================================================================ EDITOR
function FormEditor({ form, publicKeys, onKeysChanged, onClose, onSaved }: { form: IntakeForm | null; publicKeys: PubKey[]; onKeysChanged: () => void; onClose: () => void; onSaved: () => void }) {
  const editing = !!form;
  const [title, setTitle] = useState(form?.title ?? "Request Service");
  const [intro, setIntro] = useState(form?.intro ?? "");
  const [slug, setSlug] = useState(form?.slug ?? "");
  const [brandColor, setBrandColor] = useState(form?.brandColor ?? "#06b6d4");
  const [logoUrl, setLogoUrl] = useState(form?.logoUrl ?? "");
  const [successMessage, setSuccessMessage] = useState(form?.successMessage ?? "Thanks! We've received your request and will reach out shortly.");
  const [publicKeyId, setPublicKeyId] = useState(form?.publicKeyId ?? (publicKeys[0]?.id ?? ""));
  const [active, setActive] = useState(form?.active ?? true);
  const [recipientName, setRecipientName] = useState(form?.recipientName ?? "");
  const [recipientEmail, setRecipientEmail] = useState(form?.recipientEmail ?? "");
  const [sections, setSections] = useState<SectionCfg[]>(form?.sections?.length ? form.sections : []);
  const [fields, setFields] = useState<FieldCfg[]>(form?.fields?.length ? form.fields.map((f) => ({ ...f })) : DEFAULT_FIELDS.map((f) => ({ ...f })));

  // ---- field ops ----
  const patchField = (id: string, p: Partial<FieldCfg>) =>
    setFields((cur) => cur.map((f) => (f.id === id ? { ...f, ...p } : f)));
  const removeField = (id: string) => setFields((cur) => cur.filter((f) => f.id !== id));
  const moveField = (id: string, dir: -1 | 1) =>
    setFields((cur) => {
      const i = cur.findIndex((f) => f.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const addField = (sectionId: string) => {
    const id = uid("f");
    setFields((cur) => [...cur, {
      id, key: `custom_${cur.length}_${id.slice(-4)}`, type: "text", label: "New field",
      placeholder: "", options: [], enabled: true, required: false, sectionId, width: "full", core: false,
    }]);
  };

  // ---- section ops ----
  const addSection = () => setSections((cur) => [...cur, { id: uid("s"), title: "New section", description: "" }]);
  const patchSection = (id: string, p: Partial<SectionCfg>) =>
    setSections((cur) => cur.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const removeSection = (id: string) => {
    setSections((cur) => cur.filter((s) => s.id !== id));
    setFields((cur) => cur.map((f) => (f.sectionId === id ? { ...f, sectionId: "" } : f)));
  };

  const createKeyM = useMutation({
    mutationFn: () => jsend<{ key: PubKey }>("/api/api-keys", "POST", { label: `${title || "Intake"} — form key`, keyType: "public" }),
    onSuccess: (d) => { setPublicKeyId(d.key.id); onKeysChanged(); },
  });

  const saveM = useMutation({
    mutationFn: () => {
      // auto-derive key from label for custom fields if still placeholder
      const cleanFields = fields.map((f) => ({
        ...f,
        key: f.core ? f.key : (f.key?.startsWith("custom_") ? slugFromLabel(f.label) || f.key : f.key),
        options: hasOptions(f.type) ? (f.options || []).filter(Boolean) : [],
      }));
      const body = {
        title, intro, slug: slug || undefined, brandColor, logoUrl, successMessage, publicKeyId, active,
        recipientName, recipientEmail, sections, fields: cleanFields,
      };
      return editing ? jsend(`/api/forms/${form!.id}`, "PATCH", body) : jsend("/api/forms", "POST", body);
    },
    onSuccess: onSaved,
  });

  // group fields by section for rendering (unsectioned first)
  const groups: Array<{ sec: SectionCfg | null; items: FieldCfg[] }> = [
    { sec: null, items: fields.filter((f) => !f.sectionId) },
    ...sections.map((s) => ({ sec: s, items: fields.filter((f) => f.sectionId === s.id) })),
  ];

  return (
    <Modal
      open onClose={onClose}
      title={editing ? "Edit intake form" : "New intake form"}
      subtitle="Customer-facing form that creates a new lead on submit and emails your recipient."
      size="lg"
      footer={
        <>
          <BtnGhost onClick={onClose}>Cancel</BtnGhost>
          <BtnPrimary disabled={!title.trim() || saveM.isPending} onClick={() => saveM.mutate()}>
            {saveM.isPending ? "Saving…" : editing ? "Save changes" : "Create form"}
          </BtnPrimary>
        </>
      }
    >
      <div className="space-y-6">
        {/* ---- basics ---- */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Form title"><input aria-label="Title" className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="URL slug" hint="Leave blank to auto-generate from the title."><input aria-label="request-service" className={inputCls} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="request-service" /></Field>
        </div>
        <Field label="Intro text (optional)"><input aria-label="intro" className={inputCls} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="Tell us what you need and we'll get back fast." /></Field>

        {/* ---- MASTER: recipient ---- */}
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Mail className="h-4 w-4 text-cyan-glow" />
            <h3 className="text-sm font-bold text-white">Where submissions are sent</h3>
          </div>
          <p className="mb-3 text-xs text-slate-400">Every submission emails this person the full details (a pipeline lead is still created).</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Recipient name"><input aria-label="Recipient name" className={inputCls} value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Jane Dispatch" /></Field>
            <Field label="Recipient email"><input aria-label="Recipient email" type="email" className={inputCls} value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="intake@company.com" /></Field>
          </div>
        </div>

        {/* ---- branding + key ---- */}
        <Field label="Publishable key" hint="The browser-safe key this form submits with. No key yet? Create one right here.">
          <div className="flex items-center gap-2">
            <select className={inputCls} value={publicKeyId} onChange={(e) => setPublicKeyId(e.target.value)}>
              <option value="">{publicKeys.length ? "— select a publishable key —" : "— no keys yet, create one →"}</option>
              {publicKeys.map((k) => <option key={k.id} value={k.id}>{k.label} ({k.prefix}…)</option>)}
            </select>
            <button type="button" onClick={() => createKeyM.mutate()} disabled={createKeyM.isPending}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-60">
              <Plus className="h-3.5 w-3.5" /> {createKeyM.isPending ? "Creating…" : "Create publishable key"}
            </button>
          </div>
          {createKeyM.isError && <p className="mt-1 text-xs text-rose-400">{String((createKeyM.error as Error)?.message)}</p>}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Brand color"><input aria-label="Brand Color" type="color" className="h-10 w-full rounded-lg border border-white/10 bg-ink-3" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} /></Field>
          <Field label="Logo URL (optional)"><input aria-label="logo" className={inputCls} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…/logo.png" /></Field>
        </div>
        <Field label="Success message"><input aria-label="Success Message" className={inputCls} value={successMessage} onChange={(e) => setSuccessMessage(e.target.value)} /></Field>

        {/* ---- FIELDS + SECTIONS BUILDER ---- */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <LayoutList className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Form fields</span>
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={addSection} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5"><Plus className="h-3.5 w-3.5" /> Section</button>
            </div>
          </div>

          <div className="space-y-4">
            {groups.map(({ sec, items }) => (
              <div key={sec?.id ?? "_unsectioned"} className="rounded-xl border border-white/10 bg-ink-3/30 p-3">
                {sec ? (
                  <div className="mb-3 flex items-start gap-2">
                    <div className="flex-1 space-y-2">
                      <input aria-label="Section title" className={`${inputCls} font-semibold`} value={sec.title} onChange={(e) => patchSection(sec.id, { title: e.target.value })} placeholder="Section title" />
                      <input aria-label="Section description" className={`${inputCls} text-xs`} value={sec.description || ""} onChange={(e) => patchSection(sec.id, { description: e.target.value })} placeholder="Optional description" />
                    </div>
                    <button type="button" onClick={() => removeSection(sec.id)} className="mt-1 rounded-lg p-1.5 text-rose-300 hover:bg-white/5" aria-label="Remove section"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Main fields</div>
                )}

                <div className="space-y-2">
                  {items.map((f) => (
                    <FieldRow
                      key={f.id} f={f} sections={sections}
                      onPatch={(p) => patchField(f.id, p)}
                      onRemove={() => removeField(f.id)}
                      onMoveUp={() => moveField(f.id, -1)}
                      onMoveDown={() => moveField(f.id, 1)}
                    />
                  ))}
                  {items.length === 0 && <div className="px-1 py-2 text-xs text-slate-500">No fields here yet.</div>}
                </div>

                <button type="button" onClick={() => addField(sec?.id ?? "")} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5">
                  <Plus className="h-3.5 w-3.5" /> Add field
                </button>
              </div>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input aria-label="Active" type="checkbox" checked={active} onChange={() => setActive((x) => !x)} className="h-4 w-4 accent-cyan-500" />
          Form is live (accepting submissions)
        </label>

        {saveM.isError && <p className="text-sm text-rose-400">{String((saveM.error as Error)?.message)}</p>}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- single field row
function FieldRow({ f, sections, onPatch, onRemove, onMoveUp, onMoveDown }: {
  f: FieldCfg; sections: SectionCfg[];
  onPatch: (p: Partial<FieldCfg>) => void; onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void;
}) {
  const [open, setOpen] = useState(false);
  const showOptions = hasOptions(f.type);
  return (
    <div className="rounded-lg border border-white/10 bg-ink-2/60">
      <div className="flex items-center gap-2 px-2.5 py-2">
        <GripVertical className="h-4 w-4 shrink-0 text-slate-600" />
        <div className="flex shrink-0 flex-col">
          <button type="button" onClick={onMoveUp} className="text-slate-500 hover:text-white" aria-label="Move up"><ChevronUp className="h-3 w-3" /></button>
          <button type="button" onClick={onMoveDown} className="text-slate-500 hover:text-white" aria-label="Move down"><ChevronDown className="h-3 w-3" /></button>
        </div>
        <input aria-label="Field label" className="min-w-0 flex-1 rounded-md border border-white/10 bg-ink-3 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-500/50"
          value={f.label} onChange={(e) => onPatch({ label: e.target.value })} disabled={f.fixed && f.core ? false : false} />
        {f.core ? (
          <span className="shrink-0 rounded-md border border-white/10 bg-ink-3 px-2 py-1.5 text-xs text-slate-400">{FIELD_TYPES.find((t) => t.value === f.type)?.label ?? f.type}</span>
        ) : (
          <select aria-label="Field type" className="shrink-0 rounded-md border border-white/10 bg-ink-3 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500/50"
            value={f.type} onChange={(e) => onPatch({ type: e.target.value as FieldType })}>
            {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        )}
        <label className="flex shrink-0 items-center gap-1 text-[11px] text-slate-400" title="Show on form">
          <input type="checkbox" disabled={f.fixed} checked={f.enabled} onChange={() => onPatch({ enabled: !f.enabled })} className="h-3.5 w-3.5 accent-cyan-500 disabled:opacity-40" /> Show
        </label>
        <label className="flex shrink-0 items-center gap-1 text-[11px] text-slate-400" title="Required">
          <input type="checkbox" disabled={!f.enabled} checked={f.required} onChange={() => onPatch({ required: !f.required })} className="h-3.5 w-3.5 accent-cyan-500 disabled:opacity-30" /> Req
        </label>
        <button type="button" onClick={() => setOpen((o) => !o)} className="shrink-0 rounded-md p-1 text-slate-500 hover:text-white" aria-label="More options">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {!f.fixed && <button type="button" onClick={onRemove} className="shrink-0 rounded-md p-1 text-rose-300 hover:bg-white/5" aria-label="Remove field"><Trash2 className="h-4 w-4" /></button>}
      </div>

      {open && (
        <div className="space-y-3 border-t border-white/5 px-3 py-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {!showOptions && f.type !== "file" && f.type !== "address" && (
              <Field label="Placeholder"><input aria-label="Placeholder" className={inputCls} value={f.placeholder || ""} onChange={(e) => onPatch({ placeholder: e.target.value })} /></Field>
            )}
            <Field label="Width">
              <select aria-label="Width" className={inputCls} value={f.width || "full"} onChange={(e) => onPatch({ width: e.target.value as "full" | "half" })}>
                <option value="full">Full width</option>
                <option value="half">Half width</option>
              </select>
            </Field>
            <Field label="Section">
              <select aria-label="Section" className={inputCls} value={f.sectionId || ""} onChange={(e) => onPatch({ sectionId: e.target.value })}>
                <option value="">Main (no section)</option>
                {sections.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </Field>
          </div>
          {showOptions && (
            <Field label="Options (one per line)">
              <textarea aria-label="Options" rows={3} className={inputCls} value={(f.options || []).join("\n")}
                onChange={(e) => onPatch({ options: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })}
                placeholder={"Option 1\nOption 2\nOption 3"} />
            </Field>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- embed
function EmbedModal({ form, base, publicKeys, onClose }: { form: IntakeForm | null; base: string; publicKeys: PubKey[]; onClose: () => void }) {
  if (!form) return null;
  const boundKey = publicKeys.find((k) => k.id === form.publicKeyId);
  const fullKey = boundKey?.publicKey;
  const keyParam = fullKey ?? "YOUR_PUBLISHABLE_KEY";
  const shareUrl = `${base}/f/${form.companyId}/${form.slug}?k=${keyParam}`;
  const iframe = `<iframe src="${base}/f/${form.companyId}/${form.slug}?k=${keyParam}"\n  style="width:100%;max-width:560px;height:760px;border:0;border-radius:16px"\n  title="${form.title}"></iframe>`;
  return (
    <Modal open onClose={onClose} title="Share & embed" subtitle={`Public form for ${form.companyId}`} size="lg" footer={<BtnPrimary onClick={onClose}>Done</BtnPrimary>}>
      <div className="space-y-4">
        {fullKey ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">Ready to use — the publishable key is baked into the link and embed below. Just copy and share.</div>
        ) : (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">No publishable key is bound to this form yet. Edit the form and select (or create) one, then come back.</div>
        )}
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Direct link</div>
          <div className="rounded-lg border border-white/10 bg-ink-3/60 p-3"><code className="block break-all text-sm text-cyan-glow">{shareUrl}</code></div>
          <div className="mt-2"><CopyBtn text={shareUrl} label="Copy link" /></div>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Embed on their website (iframe)</div>
          <div className="rounded-lg border border-white/10 bg-ink-3/60 p-3"><pre className="overflow-x-auto whitespace-pre-wrap break-all text-[12px] leading-relaxed text-slate-300">{iframe}</pre></div>
          <div className="mt-2"><CopyBtn text={iframe} label="Copy embed code" /></div>
        </div>
      </div>
    </Modal>
  );
}
