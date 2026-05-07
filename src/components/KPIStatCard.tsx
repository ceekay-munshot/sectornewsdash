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
          background: `linear-gradient(90deg, transparent, ${accent}90, transparent)`,
        }}
      />
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="label-eyebrow">{label}</div>
          <div className="mt-2 flex items-baseline gap-2">
            <div className="font-display text-[22px] font-semibold leading-none tracking-tightish text-white num">
              {value}
            </div>
            {delta && (
              <span
                className={classNames(
                  "font-mono text-[11px] num",
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
            <div className="mt-1.5 line-clamp-1 text-[11px] text-white/50">
              {hint}
            </div>
          )}
        </div>
        {Icon && (
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1 ring-white/[0.08]"
            style={{ background: `${accent}1A`, color: accent }}
          >
            <Icon size={13} strokeWidth={1.85} />
          </div>
        )}
      </div>
    </div>
  );
}
