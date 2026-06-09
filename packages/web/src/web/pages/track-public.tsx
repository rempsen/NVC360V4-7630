import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { api } from "../lib/api";
import { LiveMap } from "../components/live-map";
import { Logo } from "../components/brand";
import { TechAvatar } from "../components/tech-avatar";
import { STATUS_META } from "../lib/utils";
import {
  Phone,
  MessageCircle,
  Send,
  Star,
  Truck,
  Clock,
  MapPin,
  ShieldCheck,
  MessageSquare,
  CheckCircle2,
  Mail,
  Building2,
} from "lucide-react";

export default function TrackPublic() {
  const [, params] = useRoute("/t/:token");
  const token = params?.token ?? "";
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // SSE-connected? then poll only as a slow safety net; else poll at 2.5s.
  const [sseUp, setSseUp] = useState(false);

  const track = useQuery({
    queryKey: ["track", token],
    queryFn: async () =>
      (await api.track[":token"].$get({ param: { token } })).json(),
    refetchInterval: sseUp ? 20000 : 2500,
    enabled: !!token,
  });

  // Live updates via Server-Sent Events — pushes a fresh snapshot on every
  // driver ping / status change. Falls back to polling automatically if the
  // stream errors or isn't reachable (the refetchInterval above).
  useEffect(() => {
    if (!token) return;
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      es = new EventSource(`/api/track/${token}/stream`);
      es.addEventListener("snapshot", (ev) => {
        try {
          const snap = JSON.parse((ev as MessageEvent).data);
          qc.setQueryData(["track", token], snap);
          setSseUp(true);
        } catch {
          /* ignore malformed frame */
        }
      });
      es.onerror = () => {
        setSseUp(false);
        es?.close();
        // reconnect with backoff; polling covers the gap meanwhile
        if (!stopped) retry = setTimeout(connect, 4000);
      };
    };
    connect();

    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      es?.close();
    };
  }, [token, qc]);

  const messages = useQuery({
    queryKey: ["track-msgs", token],
    queryFn: async () =>
      (await api.track[":token"].messages.$get({ param: { token } })).json(),
    refetchInterval: 4000,
    enabled: !!token,
  });

  const send = useMutation({
    mutationFn: async (body: string) =>
      (await api.track[":token"].messages.$post({
        param: { token },
        json: { body, senderName: "Client" },
      })).json(),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["track-msgs", token] });
    },
  });

  const msgs = (messages.data as any)?.messages ?? [];
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgs.length]);

  if (track.isLoading)
    return (
      <div className="grid min-h-screen place-items-center bg-ink text-slate-400">
        Loading…
      </div>
    );

  const data = track.data as any;
  if (!data || data.message === "Not found")
    return (
      <div className="grid min-h-screen place-items-center bg-ink px-6 text-center">
        <div>
          <Logo light className="mb-4 justify-center" />
          <p className="text-slate-400">
            This tracking link is invalid or has expired.
          </p>
        </div>
      </div>
    );

  const meta = STATUS_META[data.status] ?? { label: data.status, color: "#64748b" };
  // Once a job reaches a terminal state the live map / ETA / route are no
  // longer relevant — we hide them and show a clean completion summary with
  // the company + technician details and a way to reach the company.
  const isDone = data.status === "completed" || data.status === "cancelled";
  const company = data.company as { name?: string; email?: string; phone?: string } | null;
  const workerNoun: string = data.workerNoun || "Technician";

  return (
    <div className="nvc-grid-bg min-h-screen bg-ink text-slate-200">
      <header className="border-b border-white/5 bg-ink-2/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Logo light />
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-live" /> Secure live
            tracking
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4">
          <h1 className="font-display text-xl font-bold text-white">
            {data.title}
          </h1>
          <span
            className="mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ color: meta.color, background: `${meta.color}22` }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: meta.color }}
            />
            {meta.label}
          </span>
        </div>

        <div
          className={
            isDone
              ? "mx-auto max-w-md"
              : "grid gap-4 lg:grid-cols-[1fr_360px]"
          }
        >
          {/* left column: live map while active, completion summary once done */}
          <div className="space-y-4">
            {isDone ? (
              <div className="nvc-card p-6 text-center">
                <span
                  className="mx-auto grid h-14 w-14 place-items-center rounded-2xl"
                  style={{ background: `${meta.color}22`, color: meta.color }}
                >
                  <CheckCircle2 className="h-7 w-7" />
                </span>
                <h2 className="mt-4 font-display text-lg font-bold text-white">
                  {data.status === "completed"
                    ? "This job is complete"
                    : "This job was cancelled"}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Live tracking has ended.
                  {data.status === "completed"
                    ? " Thanks for choosing us — if anything needs attention, reach out below."
                    : " If you have any questions, reach out to the company below."}
                </p>

                <div className="mt-5 space-y-3 text-left">
                  {company?.name && (
                    <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-ink-3/50 p-3">
                      <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-glow" />
                      <div>
                        <p className="text-xs text-slate-500">Company</p>
                        <p className="text-sm font-semibold text-white">
                          {company.name}
                        </p>
                      </div>
                    </div>
                  )}
                  {data.tech?.name && (
                    <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-ink-3/50 p-3">
                      <TechAvatar
                        name={data.tech.name}
                        photoUrl={data.tech.photoUrl}
                        color={data.tech.color}
                        className="h-9 w-9"
                        textClassName="text-sm"
                      />
                      <div>
                        <p className="text-xs text-slate-500">{workerNoun}</p>
                        <p className="text-sm font-semibold text-white">
                          {data.tech.name}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {company?.email && (
                  <a
                    href={`mailto:${company.email}?subject=${encodeURIComponent(
                      `Re: ${data.title}`,
                    )}`}
                    className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-deep"
                  >
                    <Mail className="h-4 w-4" /> Email {company.name || "the company"}
                  </a>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-hidden rounded-2xl border border-white/10">
                  <LiveMap
                    rider={data.techLocation}
                    destination={data.destination}
                    route={data.route}
                    etaMins={data.etaMins}
                    className="h-[340px] w-full"
                  />
                </div>

                {data.etaMins != null && (
                  <div className="nvc-card flex items-center gap-3 p-4">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-live/15 text-emerald-live">
                      <Clock className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-display text-lg font-bold text-white">
                        ~{data.etaMins} min away
                      </p>
                      <p className="text-xs text-slate-400">Estimated arrival</p>
                    </div>
                  </div>
                )}

                <div className="nvc-card flex items-start gap-3 p-4">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cyan-glow" />
                  <div>
                    <p className="text-xs text-slate-500">Destination</p>
                    <p className="text-sm text-slate-200">
                      {data.destination?.address}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* tech card + messaging — only while the job is active */}
          {!isDone && (
          <div className="space-y-4">
            {data.tech && (
              <div className="nvc-card p-4">
                <div className="flex items-center gap-3">
                  <TechAvatar
                    name={data.tech.name}
                    photoUrl={data.tech.photoUrl}
                    color={data.tech.color}
                    className="h-12 w-12"
                    textClassName="text-base"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-white">
                      {data.tech.name}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-slate-400">
                      <Star className="h-3 w-3 fill-amber-warn text-amber-warn" />
                      {data.tech.rating?.toFixed(1) ?? "—"} · {data.tech.skillClass}
                    </p>
                  </div>
                </div>
                {data.tech.vehicle && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                    <Truck className="h-3.5 w-3.5" /> {data.tech.vehicle}
                  </p>
                )}
                {data.tech.phone && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <a
                      href={`tel:${data.tech.phone}`}
                      className="flex items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-deep"
                    >
                      <Phone className="h-4 w-4" /> Call
                    </a>
                    <a
                      href={`sms:${data.tech.phone}`}
                      className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-ink-3 py-2.5 text-sm font-semibold text-slate-200 hover:bg-ink-3/80"
                    >
                      <MessageCircle className="h-4 w-4" /> Text
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* messaging */}
            <div className="nvc-card flex h-[360px] flex-col">
              <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
                <MessageSquare className="h-4 w-4 text-cyan-glow" />
                <p className="font-bold text-white">Messages</p>
              </div>
              <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
                {msgs.length === 0 ? (
                  <p className="py-10 text-center text-xs text-slate-600">
                    Send a message to your {workerNoun.toLowerCase()}
                  </p>
                ) : (
                  msgs.map((m: any) => {
                    const mine = m.senderRole === "client";
                    return (
                      <div
                        key={m.id}
                        className={`flex ${mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                            mine
                              ? "bg-brand text-white"
                              : "bg-ink-3 text-slate-200"
                          }`}
                        >
                          {!mine && (
                            <p className="mb-0.5 text-[10px] font-semibold text-cyan-glow">
                              {m.senderName}
                            </p>
                          )}
                          {m.body}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (draft.trim()) send.mutate(draft.trim());
                }}
                className="flex gap-2 border-t border-white/5 p-3"
              >
                <input aria-label="Type a message…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type a message…"
                  className="flex-1 rounded-lg border border-white/10 bg-ink-3/60 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-brand focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || send.isPending}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand text-white hover:bg-brand-deep disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
