import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Activity } from "lucide-react";
import type { NewsItem, SectorMeta } from "../types";
import { SECTOR_ICONS } from "../lib/icons";

const POPOVER_WIDTH = 280;
const ACCENT = "#F59E0B";

export interface CriticalBreakdownRow {
  sector: SectorMeta;
  count: number;
  avgImpact: number;
  topHeadline: NewsItem | null;
}

interface Props {
  count: number;
  rows: CriticalBreakdownRow[];
  help?: ReactNode;
}

/**
 * Critical Alerts KPI card. Hovering anywhere on the card opens a
 * portal popover with the per-sector breakdown of critical headlines.
 */
export function CriticalAlertsCard({ count, rows, help }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<{
    triggerTop: number;
    triggerBottom: number;
    triggerLeft: number;
    triggerWidth: number;
  } | null>(null);

  const show = () => {
    if (!ref.current || rows.length === 0) return;
    const r = ref.current.getBoundingClientRect();
    setAnchor({
      triggerTop: r.top,
      triggerBottom: r.bottom,
      triggerLeft: r.left,
      triggerWidth: r.width,
    });
  };
  const hide = () => setAnchor(null);

  const hint =
    rows.length > 0
      ? `Across ${rows.length} sector${rows.length === 1 ? "" : "s"} · hover for breakdown`
      : "No Critical-urgency headlines";

  return (
    <div
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      tabIndex={rows.length > 0 ? 0 : -1}
      role={rows.length > 0 ? "button" : undefined}
      aria-label={
        rows.length > 0
          ? `${count} critical headlines — focus or hover for sector breakdown`
          : undefined
      }
      className="glass focus-ring relative p-3 outline-none"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
            Critical alerts
          </div>
          {help}
        </div>
        <div
          className="flex h-6 w-6 items-center justify-center rounded-md"
          style={{ background: `${ACCENT}1A`, color: ACCENT }}
        >
          <Activity size={12} />
        </div>
      </div>
      <div className="mt-1.5 font-display text-[22px] font-semibold leading-none text-white">
        {count}
      </div>
      <div className="mt-1 text-[11px] leading-snug text-white/45">{hint}</div>

      {anchor
        ? createPortal(
            <BreakdownPopover rows={rows} {...anchor} />,
            document.body
          )
        : null}
    </div>
  );
}

function BreakdownPopover({
  rows,
  triggerTop,
  triggerBottom,
  triggerLeft,
  triggerWidth,
}: {
  rows: CriticalBreakdownRow[];
  triggerTop: number;
  triggerBottom: number;
  triggerLeft: number;
  triggerWidth: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(triggerBottom + 6);

  // Center horizontally against the card, clamped to the viewport.
  const left = Math.max(
    8,
    Math.min(
      window.innerWidth - POPOVER_WIDTH - 8,
      triggerLeft + triggerWidth / 2 - POPOVER_WIDTH / 2
    )
  );

  useLayoutEffect(() => {
    if (!ref.current) return;
    const h = ref.current.offsetHeight;
    const margin = 8;
    const fitsBelow = triggerBottom + 6 + h <= window.innerHeight - margin;
    setTop(
      fitsBelow ? triggerBottom + 6 : Math.max(margin, triggerTop - h - 6)
    );
  }, [triggerTop, triggerBottom]);

  return (
    <div
      ref={ref}
      role="tooltip"
      style={{
        position: "fixed",
        top,
        left,
        width: POPOVER_WIDTH,
        zIndex: 60,
      }}
      className="pointer-events-none animate-floatIn rounded-lg border border-white/[0.08] bg-ink-950/95 p-2.5 shadow-2xl backdrop-blur-xl"
    >
      <div className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-white/45">
        Critical alerts by sector
      </div>
      <div className="mt-2 space-y-1">
        {rows.map((r) => {
          const Icon = SECTOR_ICONS[r.sector.iconKey];
          return (
            <div
              key={r.sector.id}
              className="flex items-center gap-2 rounded-md border border-white/[0.05] bg-white/[0.018] px-1.5 py-1"
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm ring-1 ring-white/10"
                style={{
                  background: `linear-gradient(135deg, rgba(${r.sector.accentRgb}, 0.32), rgba(${r.sector.accentRgb}, 0.08))`,
                  color: r.sector.accent,
                }}
              >
                <Icon size={10} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-semibold text-white/90">
                  {r.sector.shortName}
                </div>
                {r.topHeadline ? (
                  <div className="truncate text-[10px] text-white/45">
                    {r.topHeadline.headline}
                  </div>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end">
                <span
                  className="font-mono text-[12px] font-semibold leading-none"
                  style={{ color: r.sector.accent }}
                >
                  {r.count}
                </span>
                <span className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-white/40">
                  imp {r.avgImpact.toFixed(1)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
