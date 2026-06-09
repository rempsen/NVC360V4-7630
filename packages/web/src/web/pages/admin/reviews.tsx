import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { FullLoader } from "../../components/loader";
import { PageWrap } from "../../components/brand";
import { PageHead } from "./shell";
import { Modal, Field, inputCls, BtnPrimary, BtnGhost, ConfirmModal } from "../../components/modal";
import { Star, Eye, EyeOff, Pin, MessageSquareReply, Trash2 } from "lucide-react";

type Review = {
  id: string;
  rating: number;
  comment: string;
  hidden: boolean;
  featured: boolean;
  reply: string;
  createdAt: string;
  customerName: string;
  riderName: string | null;
};

const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const FILTERS = ["all", "visible", "hidden", "featured", "5", "4", "3", "2", "1"];

export default function AdminReviews() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [replyOf, setReplyOf] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState("");
  const [delId, setDelId] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["reviews"], queryFn: async () => (await api.reviews.$get()).json() });

  const patch = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<Review> }) =>
      (await api.reviews[":id"].$patch({ param: { id }, json: body as any })).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reviews"] }); setReplyOf(null); },
  });
  const del = useMutation({
    mutationFn: async (id: string) => api.reviews[":id"].$delete({ param: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reviews"] }); setDelId(null); },
  });

  if (q.isLoading) return <FullLoader label="Loading reviews…" />;
  const all: Review[] = (q.data as any)?.reviews ?? [];
  let list = all;
  if (filter === "visible") list = all.filter((r) => !r.hidden);
  else if (filter === "hidden") list = all.filter((r) => r.hidden);
  else if (filter === "featured") list = all.filter((r) => r.featured);
  else if (["1", "2", "3", "4", "5"].includes(filter)) list = all.filter((r) => r.rating === Number(filter));

  const avg = all.length ? (all.reduce((s, r) => s + r.rating, 0) / all.length).toFixed(1) : "—";

  return (
    <PageWrap>
      <PageHead title="Reviews" subtitle={`${all.length} reviews · ${avg} avg rating`} />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${filter === f ? "bg-brand text-white" : "bg-ink-2 text-slate-400 hover:bg-white/5"}`}>
            {["1", "2", "3", "4", "5"].includes(f) ? `${f}★` : f}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="nvc-card grid place-items-center py-16 text-center text-slate-500">No reviews match this filter.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((r) => (
            <div key={r.id} className={`nvc-card p-4 ${r.hidden ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`h-4 w-4 ${n <= r.rating ? "fill-amber-warn text-amber-warn" : "text-slate-700"}`} />
                    ))}
                  </div>
                  <p className="mt-1 text-sm font-semibold text-white">{r.customerName}</p>
                  <p className="text-[11px] text-slate-500">{fmt(r.createdAt)}{r.riderName ? ` · ${r.riderName}` : ""}</p>
                </div>
                <div className="flex gap-1">
                  {r.featured && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-warn">Featured</span>}
                  {r.hidden && <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-400">Hidden</span>}
                </div>
              </div>

              {r.comment && <p className="mt-2 text-sm text-slate-300">{r.comment}</p>}
              {r.reply && (
                <div className="mt-2 rounded-lg border-l-2 border-brand/50 bg-brand/5 px-3 py-2 text-xs text-slate-300">
                  <span className="font-semibold text-cyan-glow">Reply: </span>{r.reply}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/5 pt-3">
                <ActBtn icon={r.hidden ? Eye : EyeOff} label={r.hidden ? "Unhide" : "Hide"} onClick={() => patch.mutate({ id: r.id, body: { hidden: !r.hidden } })} />
                <ActBtn icon={Pin} label={r.featured ? "Unfeature" : "Feature"} active={r.featured} onClick={() => patch.mutate({ id: r.id, body: { featured: !r.featured } })} />
                <ActBtn icon={MessageSquareReply} label="Reply" onClick={() => { setReplyOf(r); setReplyText(r.reply); }} />
                <ActBtn icon={Trash2} label="Delete" danger onClick={() => setDelId(r.id)} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!replyOf} onClose={() => setReplyOf(null)} title="Reply to review" subtitle={replyOf?.customerName}
        footer={<><BtnGhost onClick={() => setReplyOf(null)}>Cancel</BtnGhost>
          <BtnPrimary disabled={patch.isPending} onClick={() => replyOf && patch.mutate({ id: replyOf.id, body: { reply: replyText } })}>Save reply</BtnPrimary></>}>
        <Field label="Public reply">
          <textarea aria-label="Thanks for the feedback…" className={inputCls} rows={4} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Thanks for the feedback…" />
        </Field>
      </Modal>

      <ConfirmModal open={!!delId} onClose={() => setDelId(null)} onConfirm={() => delId && del.mutate(delId)}
        title="Delete review?" message="This review will be permanently removed." confirmLabel="Delete" danger pending={del.isPending} />
    </PageWrap>
  );
}

function ActBtn({ icon: Icon, label, onClick, danger, active }: any) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
        danger ? "text-slate-400 hover:bg-rose-500/15 hover:text-rose-400"
        : active ? "bg-amber-500/15 text-amber-warn"
        : "text-slate-400 hover:bg-white/5 hover:text-white"
      }`}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
