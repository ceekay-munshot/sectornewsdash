import { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUpRight,
  Eye,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wand2,
  X,
} from "lucide-react";
import type {
  HeatmapInsights,
  InsightRow,
} from "../lib/heatmapInsights";
import { SECTOR_ICONS } from "../lib/icons";
import { classNames } from "../lib/utils";

interface Props {
  open: boolean;
  insights: HeatmapInsights | null;
  onClose: () => void;
  onSelectSector?: (sectorId: string) => void;
}

const TONE_COPY: Record<
  HeatmapInsights["marketTone"],
  { label: string; color: string }
> = {
  "risk-on": { label: "Risk-on", color: "#34D399" },
  neutral: { label: "Mixed", color: "#FBBF24" },
  "risk-off": { label: "Risk-off", color: "#F87171" },
  quiet: { label: "Quiet", color: "#94A3B8" },
};

export function HeatmapInsightsPanel({
  open,
  insights,
  onClose,
  onSelectSector,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !insights) return null;

  const tone = TONE_COPY[insights.marketTone];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AI explainer for the sector heatmap"
      className="fixed inset-0 z-50 flex items-center justify-center px-3 py-6"
    >
      <div
        onClick={onClose}
        className="absolute inset-0 animate-backdropIn bg-black/70 backdrop-blur-md"
      />

      <div className="relative z-10 flex max-h-full w-full max-w-[1080px] animate-modalIn flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-950/95 shadow-2xl">
        {/* Iridescent halo strip */}
        <div
          aria-hidden
          className="h-[2px] w-full"
          style={{
            background:
              "linear-gradient(90deg, #34D399, #5EEAD4, #7DD3FC, #A78BFA, #F472B6, #FB7185)",
          }}
        />

        {/* Header */}
        <div className="relative flex items-start gap-3 px-5 py-4">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-white/10"
            style={{
              background:
                "linear-gradient(135deg, rgba(167,139,250,0.35), rgba(56,189,248,0.20), rgba(94,234,212,0.20))",
              color: "#fff",
            }}
          >
            <Wand2 size={18} />
          </div>
          <div className="flex-1 pr-9">
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/50">
              AI explainer
              <span
                className="inline-flex items-center gap-1 rounded-full border px-1.5 py-[1px] text-[9.5px] font-semibold uppercase tracking-wider"
                style={{
                  borderColor: `${tone.color}55`,
                  color: tone.color,
                  background: `${tone.color}15`,
                }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: tone.color }}
                />
                {tone.label}
              </span>
            </div>
            <div className="mt-0.5 font-display text-[18px] font-semibold leading-tight text-white">
              Reading the heatmap right now
            </div>
            <div className="mt-1 text-[12.5px] leading-snug text-white/65">
              {insights.oneLiner}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="focus-ring absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-white/65 hover:border-white/20 hover:text-white"
          >
            <X size={13} />
          </button>
        </div>

        {/* Three columns */}
        <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto px-5 pb-5 lg:grid-cols-3">
          <Column
            title="Deploy"
            subtitle="Clean setups to consider sizing into."
            tone="good"
            icon={<TrendingUp size={13} />}
            rows={insights.deploy}
            onSelect={onSelectSector}
            emptyHint="No clean long setups in this view yet."
          />
          <Column
            title="Watch"
            subtitle="Story building or unresolved — read first, position later."
            tone="warn"
            icon={<Eye size={13} />}
            rows={insights.watch}
            onSelect={onSelectSector}
            emptyHint="Nothing on the watchlist."
          />
          <Column
            title="Reject"
            subtitle="Cold, stale, or wrong-side flow — not now."
            tone="bad"
            icon={<TrendingDown size={13} />}
            rows={insights.reject}
            onSelect={onSelectSector}
            emptyHint="Nothing to skip — every sector is at least worth watching."
          />
        </div>

        <div className="border-t border-white/[0.06] px-5 py-2.5 text-[10.5px] text-white/40">
          Generated from {insights.liveSectors} live of {insights.totalSectors} sectors · respects current filters · re-opens fresh each time
        </div>
      </div>
    </div>,
    document.body
  );
}

const TONE_STYLE: Record<"good" | "warn" | "bad", { ring: string; chip: string; bar: string; glow: string }> = {
  good: {
    ring: "border-emerald-300/30",
    chip: "bg-emerald-300/[0.10] text-emerald-200 border-emerald-300/30",
    bar: "from-emerald-400 via-emerald-300 to-emerald-200",
    glow: "0 30px 70px -25px rgba(52,211,153,0.45)",
  },
  warn: {
    ring: "border-amber-300/30",
    chip: "bg-amber-300/[0.10] text-amber-200 border-amber-300/30",
    bar: "from-amber-400 via-amber-300 to-yellow-200",
    glow: "0 30px 70px -25px rgba(251,191,36,0.40)",
  },
  bad: {
    ring: "border-rose-300/30",
    chip: "bg-rose-300/[0.10] text-rose-200 border-rose-300/30",
    bar: "from-rose-400 via-rose-300 to-pink-200",
    glow: "0 30px 70px -25px rgba(244,63,94,0.45)",
  },
};

function Column({
  title,
  subtitle,
  tone,
  icon,
  rows,
  onSelect,
  emptyHint,
}: {
  title: string;
  subtitle: string;
  tone: "good" | "warn" | "bad";
  icon: React.ReactNode;
  rows: InsightRow[];
  onSelect?: (id: string) => void;
  emptyHint: string;
}) {
  const t = TONE_STYLE[tone];
  return (
    <div
      className={classNames(
        "flex flex-col overflow-hidden rounded-xl border bg-white/[0.018]",
        t.ring
      )}
      style={{ boxShadow: t.glow }}
    >
      <div className={`h-[3px] w-full bg-gradient-to-r ${t.bar}`} />
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <div className="flex items-center gap-1.5">
          <span
            className={classNames(
              "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              t.chip
            )}
          >
            {icon}
            {title}
          </span>
          <span className="font-mono text-[11px] text-white/55">
            {rows.length}
          </span>
        </div>
      </div>
      <div className="px-3 pb-2 pt-1 text-[11px] leading-snug text-white/55">
        {subtitle}
      </div>

      <div className="space-y-1.5 px-3 pb-3">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-white/[0.05] bg-white/[0.012] px-2.5 py-3 text-center text-[11.5px] text-white/45">
            {emptyHint}
          </div>
        ) : (
          rows.map((r) => <RowCard key={r.agg.sector.id} row={r} onSelect={onSelect} />)
        )}
      </div>
    </div>
  );
}

function RowCard({
  row,
  onSelect,
}: {
  row: InsightRow;
  onSelect?: (id: string) => void;
}) {
  const a = row.agg;
  const Icon = SECTOR_ICONS[a.sector.iconKey];
  const clickable = Boolean(onSelect);
  const Tag: any = clickable ? "button" : "div";

  return (
    <Tag
      type={clickable ? "button" : undefined}
      onClick={clickable ? () => onSelect!(a.sector.id) : undefined}
      className={classNames(
        "group block w-full rounded-lg border border-white/[0.05] bg-white/[0.018] px-2.5 py-2 text-left transition",
        clickable &&
          "focus-ring hover:-translate-y-[1px] hover:border-white/[0.18] hover:bg-white/[0.04]"
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1 ring-white/10"
          style={{
            background: `linear-gradient(135deg, rgba(${a.sector.accentRgb},0.35), rgba(${a.sector.accentRgb},0.08))`,
            color: a.sector.accent,
          }}
        >
          <Icon size={11} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <div className="truncate text-[12.5px] font-semibold text-white">
              {a.sector.shortName}
            </div>
            <div
              className="shrink-0 font-mono text-[11px] uppercase tracking-wider"
              style={{ color: a.sector.accent }}
            >
              {row.badge}
            </div>
          </div>
          <div className="mt-0.5 line-clamp-3 text-[11.5px] leading-snug text-white/70">
            {row.reason}
          </div>
        </div>
        {clickable ? (
          <ArrowUpRight
            size={12}
            className="mt-0.5 shrink-0 text-white/30 transition group-hover:text-white/85"
          />
        ) : null}
      </div>
    </Tag>
  );
}

/** Trigger button for the panel — used by SectorHeatmap. */
export function HeatmapInsightsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring group relative inline-flex items-center gap-1.5 overflow-hidden rounded-lg border border-white/[0.10] bg-gradient-to-r from-fuchsia-500/15 via-violet-500/15 to-cyan-400/15 px-2.5 py-1 text-[11px] font-semibold text-white shadow-[0_0_20px_-5px_rgba(167,139,250,0.55)] transition hover:from-fuchsia-500/25 hover:via-violet-500/25 hover:to-cyan-400/25 hover:shadow-[0_0_30px_-5px_rgba(244,114,182,0.65)]"
      aria-label="Open AI explainer for the heatmap"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-full"
      />
      <Sparkles size={11} className="text-fuchsia-200" />
      AI Explainer
    </button>
  );
}
