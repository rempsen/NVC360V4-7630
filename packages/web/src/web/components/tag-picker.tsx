import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Plus, X, Check } from "lucide-react";

interface Tag {
  id: string;
  label: string;
  color: string;
  scope: string;
}

export function TagBadges({ tags }: { tags: Tag[] }) {
  if (!tags?.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span
          key={t.id}
          className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ color: t.color, background: `${t.color}22` }}
        >
          {t.label}
        </span>
      ))}
    </div>
  );
}

/** Editable tag picker for an entity (client | tech). */
export function TagPicker({
  scope,
  entityType,
  entityId,
}: {
  scope: "client" | "tech";
  entityType: "client" | "tech";
  entityId: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const all = useQuery({
    queryKey: ["tags", scope],
    queryFn: async () => (await api.tags.$get({ query: { scope } })).json(),
  });
  const assigned = useQuery({
    queryKey: ["entity-tags", entityType, entityId],
    queryFn: async () =>
      (await api.tags.entity[":type"][":id"].$get({ param: { type: entityType, id: entityId } })).json(),
  });

  const assignedIds = new Set(((assigned.data as any)?.tags ?? []).map((t: Tag) => t.id));

  const save = useMutation({
    mutationFn: async (tagIds: string[]) => {
      await api.tags.entity[":type"][":id"].$put({
        param: { type: entityType, id: entityId },
        json: { tagIds },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entity-tags", entityType, entityId] }),
  });

  function toggle(id: string) {
    const next = new Set(assignedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    save.mutate([...next] as string[]);
  }

  const tags: Tag[] = (assigned.data as any)?.tags ?? [];
  const allTags: Tag[] = (all.data as any)?.tags ?? [];

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <span
            key={t.id}
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ color: t.color, background: `${t.color}22` }}
          >
            {t.label}
            <button onClick={() => toggle(t.id)} className="hover:opacity-70">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 rounded-full border border-dashed border-white/20 px-2 py-0.5 text-[11px] font-semibold text-slate-400 hover:border-brand hover:text-brand"
        >
          <Plus className="h-3 w-3" /> Tag
        </button>
      </div>
      {open && (
        <div className="absolute z-50 mt-1 max-h-56 w-52 overflow-auto rounded-lg border border-white/10 bg-ink-2 p-1 shadow-2xl">
          {allTags.length === 0 && (
            <p className="px-2 py-2 text-xs text-slate-500">
              No tags yet. Create them in Tags &amp; Fields.
            </p>
          )}
          {allTags.map((t) => (
            <button
              key={t.id}
              onClick={() => toggle(t.id)}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/5"
            >
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
                <span className="text-slate-200">{t.label}</span>
              </span>
              {assignedIds.has(t.id) && <Check className="h-3.5 w-3.5 text-brand" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
