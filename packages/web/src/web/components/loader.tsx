import { cn } from "../lib/utils";

export function Loader({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-8 w-8 animate-spin rounded-full border-[3px] border-white/10 border-t-cyan-glow",
        className,
      )}
    />
  );
}

export function FullLoader({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
      <Loader />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}
