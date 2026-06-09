import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Plus, X } from "lucide-react";

/**
 * Skill picker backed by the shared skill library.
 * - Pick existing skills from the dropdown of library entries.
 * - Type a new skill + Enter to add it to the library AND select it.
 * Selected skills are returned as a string[] of skill names via value/onChange.
 */
export function SkillPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (skills: string[]) => void;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");

  const lib = useQuery({
    queryKey: ["skills"],
    queryFn: async () => (await api.skills.$get()).json(),
  });
  const add = useMutation({
    mutationFn: async (name: string) => (await api.skills.$post({ json: { name } })).json(),
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      const name = d?.skill?.name;
      if (name && !value.includes(name)) onChange([...value, name]);
    },
  });

  const skills: { id: string; name: string; category: string }[] = (lib.data as any)?.skills ?? [];
  const available = skills.filter((s) => !value.includes(s.name));

  const toggle = (name: string) => {
    if (value.includes(name)) onChange(value.filter((v) => v !== name));
    else onChange([...value, name]);
  };

  const commit = () => {
    const name = draft.trim();
    if (!name) return;
    const exists = skills.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      if (!value.includes(exists.name)) onChange([...value, exists.name]);
    } else {
      add.mutate(name);
    }
    setDraft("");
  };

  return (
    <div className="space-y-2">
      {/* selected chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand/15 px-2.5 py-1 text-xs font-semibold text-cyan-glow"
            >
              {s}
              <button onClick={() => toggle(s)} className="text-cyan-glow/70 hover:text-white">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* type-new-to-add */}
      <div className="flex gap-2">
        <input aria-label="Type a skill and press Enter…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          placeholder="Type a skill and press Enter…"
          className="flex-1 rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-brand/40 focus:outline-none"
        />
        <button
          onClick={commit}
          disabled={!draft.trim()}
          className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-ink text-slate-300 hover:border-brand/40 hover:text-cyan-glow disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* library suggestions */}
      {available.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {available.slice(0, 14).map((s) => (
            <button
              key={s.id}
              onClick={() => toggle(s.name)}
              className="rounded-full border border-white/10 bg-ink px-2.5 py-1 text-[11px] font-medium text-slate-400 hover:border-brand/40 hover:text-cyan-glow"
            >
              + {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
