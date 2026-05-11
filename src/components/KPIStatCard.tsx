import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { classNames } from "../lib/utils";

interface Props {
  label: string;
  value: string | number;
  hint?: string;
  delta?: { value: string; tone?: "up" | "down" | "neutral" };
  icon?: LucideIcon;
  accent?: string; // hex
  help?: ReactNode;
  /** 0–100 fill for the inline meter under the value. */
  meter?: number;
  /** Small tags rendered to the right of the value (e.g. "20 news"). */
  badges?: { label: string; value: string | number }[];
}

export function KPIStatCard({
  label,
  value,
  hint,
  delta,
  icon: Icon,
  accent = "#7DD3FC",
  help,
  meter,
  badges,
}: Props) {
  const meterPct =
    typeof meter === "number" ? Math.max(0, Math.min(100, meter)) : null;

  return (
    <div className="glass relative overflow-hidden p-3">
      <div
        className="pointer-events-none absolute inset-x-0 -top-px h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}88, transparent)`,
        }}
      />
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full opacity-40 blur-2xl"
        style={{ background: `${accent}22` }}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
            {label}
          </div>
          {help}
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
      <div className="mt-1.5 flex items-baseline gap-2">
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

      {meterPct !== null && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full transition-[width]"
            style={{
              width: `${meterPct}%`,
              background: `linear-gradient(90deg, ${accent}66, ${accent})`,
            }}
          />
        </div>
      )}

      <div className="mt-1.5 flex items-end justify-between gap-2">
        {hint && (
          <div className="line-clamp-2 flex-1 text-[10.5px] leading-snug text-white/45">
            {hint}
          </div>
        )}
        {badges && badges.length > 0 && (
          <div className="flex shrink-0 items-center gap-1.5">
            {badges.map((b) => (
              <div
                key={b.label}
                className="flex items-baseline gap-1 rounded-md border border-white/[0.06] bg-white/[0.025] px-1.5 py-[3px]"
              >
                <span className="text-[9px] uppercase tracking-wider text-white/40">
                  {b.label}
                </span>
                <span
                  className="font-mono text-[11px] font-semibold leading-none"
                  style={{ color: accent }}
                >
                  {b.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
