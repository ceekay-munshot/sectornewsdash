import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink } from "lucide-react";
import type { NewsItem } from "../types";
import { SentimentDot } from "./Badges";
import { classNames, formatShortDate, heatToColor } from "../lib/utils";
import { useSectorBreakdown, type SectorBreakdown } from "../lib/sectorBreakdown";

interface Props {
  item: NewsItem;
  onSelect: (item: NewsItem) => void;
  showTime?: boolean;
  active?: boolean;
}

const POPOVER_WIDTH = 224;

export function NewsHeadlineRow({ item, onSelect, showTime, active }: Props) {
  const breakdown = useSectorBreakdown(item.sector);
  const rowRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const showPopover = () => {
    if (!rowRef.current || !breakdown) return;
    const r = rowRef.current.getBoundingClientRect();
    const left = Math.max(
      8,
      Math.min(window.innerWidth - POPOVER_WIDTH - 8, r.right - POPOVER_WIDTH)
    );
    setPos({ top: r.bottom + 6, left });
  };
  const hidePopover = () => setPos(null);

  return (
    <div
      ref={rowRef}
      onMouseEnter={showPopover}
      onMouseLeave={hidePopover}
      onFocus={showPopover}
      onBlur={hidePopover}
      onClick={() => onSelect(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(item);
        }
      }}
      className={classNames(
        "group focus-ring flex cursor-pointer items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 transition",
        "hover:border-white/[0.07] hover:bg-white/[0.025]",
        active && "border-white/[0.12] bg-white/[0.04]"
      )}
    >
      <SentimentDot sentiment={item.sentiment} />
      <div className="min-w-0 flex-1">
        <div className="line-clamp-1 text-[12.5px] font-medium text-white/85 group-hover:text-white">
          {item.headline}
        </div>
      </div>
      {showTime && (
        <span className="hidden whitespace-nowrap font-mono text-[10.5px] text-white/45 sm:inline">
          {formatShortDate(item.publishedAt)}
        </span>
      )}
      {item.newsUrl ? (
        <a
          href={item.newsUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          title={`Open source: ${item.source}`}
          aria-label={`Open source: ${item.source}`}
          className="focus-ring inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.07] bg-white/[0.02] text-white/55 transition hover:border-white/[0.16] hover:text-white"
        >
          <ExternalLink size={11} />
        </a>
      ) : null}
      {pos && breakdown
        ? createPortal(
            <SectorHoverPopover
              breakdown={breakdown}
              top={pos.top}
              left={pos.left}
            />,
            document.body
          )
        : null}
    </div>
  );
}

function SectorHoverPopover({
  breakdown,
  top,
  left,
}: {
  breakdown: SectorBreakdown;
  top: number;
  left: number;
}) {
  const { hex: heatHex } = heatToColor(breakdown.heatScore);
  const { bullish, neutral, bearish, total } = breakdown;
  const segs = [
    { label: "Bull", count: bullish, color: "#34D399" },
    { label: "Neut", count: neutral, color: "#94A3B8" },
    { label: "Bear", count: bearish, color: "#F87171" },
  ];

  return (
    <div
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
      <div className="flex items-baseline justify-between gap-2">
        <div className="truncate text-[11.5px] font-semibold text-white">
          {breakdown.sectorName}
        </div>
        <div
          className="font-mono text-[11px] font-bold tabular-nums"
          style={{ color: heatHex }}
          title={`Heat ${breakdown.heatScore}`}
        >
          {breakdown.heatScore}
        </div>
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full"
            style={{
              width: `${breakdown.heatScore}%`,
              background: heatHex,
            }}
          />
        </div>
        <span className="font-mono text-[9.5px] uppercase tracking-wider text-white/40">
          heat
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {total === 0 ? (
          <div className="col-span-3 text-[10.5px] text-white/45">
            No items in scope
          </div>
        ) : (
          segs.map((s) => (
            <div
              key={s.label}
              className="rounded-md border border-white/[0.05] bg-white/[0.02] px-1.5 py-1"
            >
              <div
                className="text-[9.5px] uppercase tracking-wider"
                style={{ color: s.color }}
              >
                {s.label}
              </div>
              <div className="font-mono text-[12.5px] font-semibold tabular-nums text-white/90">
                {s.count}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="mt-1.5 text-right font-mono text-[9.5px] text-white/40">
        {total} total in sector
      </div>
    </div>
  );
}
