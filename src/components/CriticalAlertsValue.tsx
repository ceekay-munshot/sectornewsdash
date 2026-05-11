import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { NewsItem, SectorMeta } from "../types";
import { SECTOR_ICONS } from "../lib/icons";

const POPOVER_WIDTH = 260;

export interface CriticalBreakdownRow {
  sector: SectorMeta;
  count: number;
  avgImpact: number;
  topHeadline: NewsItem | null;
}

interface Props {
  count: number;
  rows: CriticalBreakdownRow[];
}

/**
 * KPI value for the Critical Alerts card. Renders the raw count and,
 * on hover, opens a portal popover listing the per-sector breakdown.
 */
export function CriticalAlertsValue({ count, rows }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const [anchor, setAnchor] = useState<{
    triggerTop: number;
    triggerBottom: number;
    left: number;
  } | null>(null);

  const show = () => {
    if (!ref.current || rows.length === 0) return;
    const r = ref.current.getBoundingClientRect();
    const left = Math.max(
      8,
      Math.min(window.innerWidth - POPOVER_WIDTH - 8, r.left)
    );
    setAnchor({ triggerTop: r.top, triggerBottom: r.bottom, left });
  };
  const hide = () => setAnchor(null);

  return (
    <span
      ref={ref}
      role={rows.length > 0 ? "button" : undefined}
      tabIndex={rows.length > 0 ? 0 : undefined}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      className="relative inline-block cursor-default outline-none"
      aria-label={
        rows.length > 0
          ? `${count} critical headlines — hover for sector breakdown`
          : undefined
      }
    >
      {count}
      {anchor
        ? createPortal(
            <BreakdownPopover
              rows={rows}
              triggerTop={anchor.triggerTop}
              triggerBottom={anchor.triggerBottom}
              left={anchor.left}
            />,
            document.body
          )
        : null}
    </span>
  );
}

function BreakdownPopover({
  rows,
  triggerTop,
  triggerBottom,
  left,
}: {
  rows: CriticalBreakdownRow[];
  triggerTop: number;
  triggerBottom: number;
  left: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(triggerBottom + 6);
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
