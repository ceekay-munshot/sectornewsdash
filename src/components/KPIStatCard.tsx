import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { classNames } from "../lib/utils";

interface Props {
  label: string;
  value: string | number;
  hint?: ReactNode;
  delta?: { value: string; tone?: "up" | "down" | "neutral" };
  icon?: LucideIcon;
  accent?: string; // hex
  /** Optional click handler — when present, the whole card becomes a button. */
  onClick?: () => void;
  /** Tooltip / aria label for the card-as-button. */
  whyLabel?: string;
}

export function KPIStatCard({
  label,
  value,
  hint,
  delta,
  icon: Icon,
  accent = "#7DD3FC",
  onClick,
  whyLabel,
}: Props) {
  const clickable = Boolean(onClick);
  const Tag: any = clickable ? "button" : "div";

  return (
    <Tag
      type={clickable ? "button" : undefined}
      onClick={onClick}
      aria-label={clickable ? whyLabel ?? `Why? ${label}` : undefined}
      className={classNames(
        "glass group relative w-full p-3 text-left",
        clickable &&
          "focus-ring transition hover:-translate-y-[1px] hover:border-white/[0.16]"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
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
      {hint && (
        <div className="mt-1 text-[11px] leading-snug text-white/45">
          {hint}
        </div>
      )}

      {clickable ? (
        <span
          aria-hidden
          className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.025] px-1.5 py-[2px] text-[9.5px] font-medium uppercase tracking-wider text-white/55 opacity-0 transition group-hover:opacity-100"
          style={{ color: accent, borderColor: `${accent}55` }}
        >
          <Sparkles size={9} /> Why
        </span>
      ) : null}
    </Tag>
  );
}
