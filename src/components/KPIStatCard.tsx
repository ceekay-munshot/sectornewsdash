import type { LucideIcon } from "lucide-react";
import { classNames } from "../lib/utils";

interface Props {
  label: string;
  value: string | number;
  hint?: string;
  delta?: { value: string; tone?: "up" | "down" | "neutral" };
  icon?: LucideIcon;
  accent?: string; // hex
}

export function KPIStatCard({
  label,
  value,
  hint,
  delta,
  icon: Icon,
  accent = "#7DD3FC",
}: Props) {
  return (
    <div className="glass relative overflow-hidden p-3.5">
      <div
        className="pointer-events-none absolute inset-x-0 -top-px h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}88, transparent)`,
        }}
      />
      <div className="flex items-center justify-between">
        <div className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-white/45">
          {label}
        </div>
        {Icon && (
          <div
            className="flex h-6 w-6 items-center justify-center rounded-md"
            style={{ background: `${accent}1A`, color: accent }}
          >
            <Icon size={12} />
          </div>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="font-display text-[22px] font-semibold leading-none text-white">
          {value}
        </div>
        {delta && (
          <span
            className={classNames(
              "font-mono text-[11px]",
              delta.tone === "up" && "text-emerald-300",
              delta.tone === "down" && "text-rose-300",
              (!delta.tone || delta.tone === "neutral") && "text-white/55"
            )}
          >
            {delta.value}
          </span>
        )}
      </div>
      {hint && (
        <div className="mt-1.5 line-clamp-1 text-[11px] text-white/45">
          {hint}
        </div>
      )}
    </div>
  );
}
