import { useEffect, useRef, useState } from "react";
import { Eraser, Check } from "lucide-react";

/** Lightweight canvas signature pad. Emits a PNG data URL. */
export function SignaturePad({
  value,
  onChange,
}: {
  value?: string;
  onChange: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(!!value);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.strokeStyle = "#06b6d4";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height);
      img.src = value;
    }
  }, [value]);

  function pos(e: React.PointerEvent) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  }
  function start(e: React.PointerEvent) {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasInk(true);
  }
  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current!.toDataURL("image/png"));
  }
  function clear() {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
    onChange("");
  }

  return (
    <div className="space-y-2">
      <canvas
        aria-label="Signature drawing area"
        ref={canvasRef}
        width={500}
        height={160}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="w-full touch-none rounded-lg border border-white/10 bg-ink-3/60"
        style={{ aspectRatio: "500/160" }}
      />
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-[11px] text-slate-500">
          {hasInk && <Check className="h-3 w-3 text-emerald-live" />}
          {hasInk ? "Signature captured" : "Sign above"}
        </span>
        <button
          onClick={clear}
          type="button"
          className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-white"
        >
          <Eraser className="h-3 w-3" /> Clear
        </button>
      </div>
    </div>
  );
}
