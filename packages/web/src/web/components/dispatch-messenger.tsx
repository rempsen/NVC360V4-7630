import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken } from "../lib/auth";
import { TechAvatar } from "./tech-avatar";
import { TECH_STATUS } from "../lib/utils";
import {
  MessageSquare,
  X,
  Send,
  ChevronLeft,
  Minus,
  Search,
} from "lucide-react";
import { useWorkerNoun } from "../lib/use-brand";

const API = "";

async function jget(path: string) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}
async function jpost(path: string, body: any) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

type Thread = {
  techId: string;
  name: string;
  photoUrl: string | null;
  color: string;
  status: string;
  skillClass: string | null;
  lastMessage: string | null;
  lastSenderRole: string | null;
  lastAt: string | null;
  unread: number;
};

const STATUS_ORDER: Record<string, number> = {
  enroute: 0,
  onsite: 1,
  busy: 2,
  available: 3,
  break: 4,
  offline: 5,
};

export function DispatchMessenger() {
  const qc = useQueryClient();
  const { nounPlural } = useWorkerNoun();
  const [open, setOpen] = useState(false);
  const [activeTech, setActiveTech] = useState<Thread | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [q, setQ] = useState("");

  // poll the thread list always (so the badge & red dots update even when closed)
  const threadsQ = useQuery({
    queryKey: ["dispatch-threads"],
    queryFn: () => jget("/api/messages/dispatch/threads"),
    refetchInterval: 5000,
  });

  const threads: Thread[] = threadsQ.data?.threads ?? [];
  const totalUnread: number = threadsQ.data?.totalUnread ?? 0;

  // sort + filter for the list
  let list = threads.slice();
  if (statusFilter === "all") {
    list.sort((a, b) => {
      if (b.unread !== a.unread) return b.unread - a.unread;
      return (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    });
  } else {
    list = list.filter((t) => t.status === statusFilter);
  }
  if (q.trim()) {
    const t = q.toLowerCase();
    list = list.filter((x) => x.name.toLowerCase().includes(t));
  }

  return (
    <>
      {/* floating launcher — bottom-right, always present */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[900] flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-2xl shadow-brand/30 transition hover:bg-brand-deep"
          title="Messages"
          aria-label="Open messages"
        >
          <MessageSquare className="h-6 w-6" />
          {totalUnread > 0 && (
            <span className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full border-2 border-ink bg-red-500 px-1.5 text-xs font-bold text-white">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </button>
      )}

      {/* docked panel — right side */}
      {open && (
        <div className="fixed bottom-0 right-0 top-0 z-[900] flex w-full flex-col border-l border-white/10 bg-ink-2 shadow-2xl sm:w-[380px]">
          {/* header */}
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            {activeTech && (
              <button
                onClick={() => setActiveTech(null)}
                aria-label="Back to conversations"
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <MessageSquare className="h-4 w-4 text-cyan-glow" />
            <h3 className="flex-1 font-bold text-white">
              {activeTech ? activeTech.name : "Messages"}
              {!activeTech && totalUnread > 0 && (
                <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
                  {totalUnread}
                </span>
              )}
            </h3>
            <button
              onClick={() => {
                setOpen(false);
                setActiveTech(null);
              }}
              title="Minimize"
              aria-label="Minimize messages"
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setActiveTech(null);
              }}
              title="Close"
              aria-label="Close messages"
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {activeTech ? (
            <ChatView
              tech={activeTech}
              onSent={() => {
                qc.invalidateQueries({ queryKey: ["dispatch-threads"] });
              }}
            />
          ) : (
            <>
              {/* search */}
              <div className="border-b border-white/5 px-3 py-2.5">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input aria-label={`Search ${nounPlural.toLowerCase()}…`}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={`Search ${nounPlural.toLowerCase()}…`}
                    className="w-full rounded-lg border border-white/10 bg-ink py-1.5 pl-8 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-brand"
                  />
                </div>
              </div>
              {/* status filter chips */}
              <div className="flex flex-wrap gap-1.5 border-b border-white/5 px-3 py-2">
                {["all", "enroute", "available", "onsite", "busy", "offline"].map(
                  (s) => {
                    const active = statusFilter === s;
                    const meta = TECH_STATUS[s];
                    return (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                          active
                            ? "bg-brand text-white"
                            : "bg-ink text-slate-400 hover:bg-white/5"
                        }`}
                      >
                        {meta && (
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: meta.color }}
                          />
                        )}
                        {meta?.label ?? "All"}
                      </button>
                    );
                  },
                )}
              </div>
              {/* tech list */}
              <div className="flex-1 divide-y divide-white/5 overflow-y-auto">
                {list.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-500">
                    No {nounPlural.toLowerCase()}
                  </p>
                ) : (
                  list.map((t) => {
                    const meta = TECH_STATUS[t.status] ?? {
                      label: t.status,
                      color: "#64748b",
                    };
                    return (
                      <button
                        key={t.techId}
                        onClick={() => setActiveTech(t)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
                      >
                        <div className="relative">
                          <TechAvatar
                            name={t.name}
                            photoUrl={t.photoUrl}
                            color={t.color}
                            className="h-10 w-10"
                            textClassName="text-sm"
                          />
                          <span
                            className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ink-2"
                            style={{ background: meta.color }}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p
                              className={`truncate text-sm ${t.unread > 0 ? "font-bold text-white" : "font-semibold text-slate-200"}`}
                            >
                              {t.name}
                            </p>
                            <span
                              className="text-[10px] font-semibold"
                              style={{ color: meta.color }}
                            >
                              {meta.label}
                            </span>
                          </div>
                          <p
                            className={`truncate text-xs ${t.unread > 0 ? "text-slate-200" : "text-slate-500"}`}
                          >
                            {t.lastSenderRole === "dispatch" && "You: "}
                            {t.lastMessage ?? "No messages yet"}
                          </p>
                        </div>
                        {t.unread > 0 && (
                          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                            {t.unread}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

function ChatView({
  tech,
  onSent,
}: {
  tech: Thread;
  onSent: () => void;
}) {
  const [body, setBody] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const threadQ = useQuery({
    queryKey: ["dispatch-thread", tech.techId],
    queryFn: () => jget(`/api/messages/dispatch/${tech.techId}`),
    refetchInterval: 4000,
  });
  const messages: any[] = threadQ.data?.messages ?? [];

  const post = useMutation({
    mutationFn: () =>
      jpost(`/api/messages/dispatch/${tech.techId}`, { body }),
    onSuccess: () => {
      setBody("");
      threadQ.refetch();
      onSent();
    },
  });

  // mark-as-read happens on the GET; refresh the badge list when opening
  useEffect(() => {
    onSent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tech.techId, threadQ.data]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-600">
            No messages yet. Start the conversation 👋
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.senderRole === "dispatch";
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    mine ? "bg-brand text-white" : "bg-ink-3 text-slate-200"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className="mt-0.5 text-[10px] opacity-60">
                    {m.senderName} ·{" "}
                    {new Date(m.createdAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-white/10 p-3">
        <input aria-label={`Message ${tech.name.split(" ")[0]}…`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && body.trim() && post.mutate()}
          placeholder={`Message ${tech.name.split(" ")[0]}…`}
          className="flex-1 rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-brand"
        />
        <button
          onClick={() => post.mutate()}
          disabled={post.isPending || !body.trim()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand text-white hover:bg-brand-deep disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
