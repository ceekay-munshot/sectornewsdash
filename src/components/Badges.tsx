import type { Sentiment, Urgency } from "../types";
import { classNames } from "../lib/utils";

const SENT_STYLES: Record<Sentiment, { bg: string; text: string; dot: string }> = {
  Bullish: {
    bg: "bg-emerald-400/10 border-emerald-400/25",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
  },
  Bearish: {
    bg: "bg-rose-400/10 border-rose-400/25",
    text: "text-rose-300",
    dot: "bg-rose-400",
  },
  Neutral: {
    bg: "bg-slate-400/10 border-slate-400/25",
    text: "text-slate-300",
    dot: "bg-slate-400",
  },
};

const URG_STYLES: Record<Urgency, { bg: string; text: string }> = {
  Critical: { bg: "bg-rose-500/15 border-rose-500/30", text: "text-rose-300" },
  High: { bg: "bg-amber-500/15 border-amber-500/30", text: "text-amber-300" },
  Medium: { bg: "bg-yellow-500/10 border-yellow-500/25", text: "text-yellow-300" },
  Low: { bg: "bg-sky-500/10 border-sky-500/25", text: "text-sky-300" },
};

export function SentimentBadge({
  sentiment,
  size = "md",
}: {
  sentiment: Sentiment;
  size?: "sm" | "md";
}) {
  const s = SENT_STYLES[sentiment];
  return (
    <span
      className={classNames(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        s.bg,
        s.text,
        size === "sm"
          ? "px-1.5 py-[2px] text-[10px]"
          : "px-2 py-[3px] text-[11px]"
      )}
    >
      <span className={classNames("h-1.5 w-1.5 rounded-full", s.dot)} />
      {sentiment}
    </span>
  );
}

export function SentimentDot({ sentiment }: { sentiment: Sentiment }) {
  const s = SENT_STYLES[sentiment];
  return (
    <span
      title={sentiment}
      className={classNames("h-1.5 w-1.5 shrink-0 rounded-full", s.dot)}
    />
  );
}

export function UrgencyBadge({
  urgency,
  size = "md",
}: {
  urgency: Urgency;
  size?: "sm" | "md";
}) {
  const u = URG_STYLES[urgency];
  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-md border font-medium uppercase tracking-wider",
        u.bg,
        u.text,
        size === "sm"
          ? "px-1.5 py-[2px] text-[9.5px]"
          : "px-1.5 py-[3px] text-[10px]"
      )}
    >
      {urgency}
    </span>
  );
}

export function ImpactPill({ score }: { score: number }) {
  const tone =
    score >= 8
      ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
      : score >= 6
        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
        : score >= 4
          ? "bg-sky-500/10 text-sky-300 border-sky-500/25"
          : "bg-slate-500/10 text-slate-300 border-slate-500/25";
  return (
    <span
      className={classNames(
        "inline-flex items-baseline gap-1 rounded-md border px-1.5 py-[3px] font-mono text-[11px] font-semibold",
        tone
      )}
    >
      <span className="opacity-60">IMP</span>
      {score.toFixed(1)}
    </span>
  );
}

export function ThemeChip({ children }: { children: React.ReactNode }) {
  return <span className="chip">{children}</span>;
}
