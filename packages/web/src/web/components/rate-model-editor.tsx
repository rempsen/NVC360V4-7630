import { EMPTY_RATE_MODEL, describeRateModel, type RateModel } from "../../shared/pricing";
import { DollarSign, Clock, Route } from "lucide-react";

/**
 * Flexible rate-model editor. Every component optional & combinable:
 *  - flat rate (with included minutes + km)
 *  - per minute|hour time rate after included time
 *  - per km rate after included km
 *  - minimum charge floor
 */
export function RateModelEditor({
  value,
  onChange,
}: {
  value: RateModel;
  onChange: (rm: RateModel) => void;
}) {
  const rm = { ...EMPTY_RATE_MODEL, ...value };
  const set = (patch: Partial<RateModel>) => onChange({ ...rm, ...patch });

  const num = (v: string) => Number(v) || 0;

  const Money = ({
    label, val, onSet, placeholder,
  }: { label: string; val: number; onSet: (n: number) => void; placeholder?: string }) => (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">$</span>
        <input aria-label={placeholder}
          type="number" min={0} step="0.01" value={val || 0}
          onChange={(e) => onSet(num(e.target.value))}
          placeholder={placeholder}
          className="w-full rounded-lg border border-white/10 bg-ink px-3 py-2 pl-6 text-sm text-white focus:border-brand/40 focus:outline-none"
        />
      </div>
    </label>
  );
  const Plain = ({
    label, val, onSet, suffix,
  }: { label: string; val: number; onSet: (n: number) => void; suffix?: string }) => (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <div className="relative">
        <input aria-label="Val"
          type="number" min={0} step="1" value={val || 0}
          onChange={(e) => onSet(num(e.target.value))}
          className="w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-white focus:border-brand/40 focus:outline-none"
        />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">{suffix}</span>}
      </div>
    </label>
  );

  return (
    <div className="space-y-4">
      {/* flat */}
      <div className="rounded-xl border border-white/10 bg-ink-3/40 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-300">
          <DollarSign className="h-3.5 w-3.5 text-cyan-glow" /> Flat rate
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Money label="Flat $" val={rm.flatRate} onSet={(n) => set({ flatRate: n })} placeholder="0" />
          <Plain label="Incl. minutes" val={rm.includedMinutes} onSet={(n) => set({ includedMinutes: n })} suffix="min" />
          <Plain label="Incl. km" val={rm.includedKm} onSet={(n) => set({ includedKm: n })} suffix="km" />
        </div>
      </div>

      {/* time */}
      <div className="rounded-xl border border-white/10 bg-ink-3/40 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-300">
          <Clock className="h-3.5 w-3.5 text-cyan-glow" /> Time rate (after included)
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Money label="Rate $" val={rm.timeRate} onSet={(n) => set({ timeRate: n })} placeholder="0" />
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Per</span>
            <select
              value={rm.timeUnit}
              onChange={(e) => set({ timeUnit: e.target.value as RateModel["timeUnit"] })}
              className="w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-white focus:border-brand/40 focus:outline-none"
            >
              <option value="hour">hour</option>
              <option value="minute">minute</option>
            </select>
          </label>
        </div>
      </div>

      {/* km */}
      <div className="rounded-xl border border-white/10 bg-ink-3/40 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-300">
          <Route className="h-3.5 w-3.5 text-cyan-glow" /> Mileage rate (after included)
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Money label="Rate $ / km" val={rm.kmRate} onSet={(n) => set({ kmRate: n })} placeholder="0" />
          <Money label="Minimum charge" val={rm.minCharge} onSet={(n) => set({ minCharge: n })} placeholder="0" />
        </div>
      </div>

      <div className="rounded-lg bg-brand/10 px-3 py-2 text-xs text-cyan-glow">
        {describeRateModel(rm)}
      </div>
    </div>
  );
}
