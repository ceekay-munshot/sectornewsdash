import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SectorAggregate } from "../types";
import { SECTOR_ICONS } from "../lib/icons";
import { classNames, heatToColor, heatTier } from "../lib/utils";
import { useSectorBreakdown } from "../lib/sectorBreakdown";
import { HelpHint } from "./HelpHint";
import { HEAT_SCORE_HINT } from "../lib/methodologyHints";

interface Props {
  aggregates: SectorAggregate[];
  onSelect: (sectorId: string) => void;
  selectedId?: string | null;
}

const POPOVER_WIDTH = 240;

/**
 * True heatmap — color carries the data. Each tile is a single row
 * (icon + short name + heat number); intensity tracks the sector's
 * heat score on a thermal gradient. Hovering a tile reveals a small
 * popover with sentiment, top theme and bull/neut/bear breakdown.
 */
export function SectorHeatmap({ aggregates, onSelect, selectedId }: Props) {
  return (
    <div className="glass relative overflow-hidden p-3.5">
      <div className="mb-3 flex items-center gap-1.5 px-0.5">
        <div className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-white/50">
          Sector heatmap
        </div>
        <HelpHint {...HEAT_SCORE_HINT} />
      </div>

      <HeatLegend />

      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
        {aggregates.map((a, idx) => (
          <HeatTile
            key={a.sector.id}
            agg={a}
            isSelected={selectedId === a.sector.id}
            onSelect={onSelect}
            index={idx}
          />
        ))}
      </div>
    </div>
  );
}

function HeatTile({
  agg,
  isSelected,
  onSelect,
  index,
}: {
  agg: SectorAggregate;
  isSelected: boolean;
  onSelect: (id: string) => void;
  index: number;
}) {
  const Icon = SECTOR_ICONS[agg.sector.iconKey];
  const heat = Math.max(0, Math.min(100, agg.heatScore));
  const live = agg.newsCount > 0;
  const { hex: heatHex, rgb: heatRgb } = heatToColor(heat);

  const baseAlpha = live ? 0.22 + (heat / 100) * 0.42 : 0.025;
  const edgeAlpha = live ? 0.08 + (heat / 100) * 0.2 : 0.012;
  const tintRgb = live ? heatRgb : "255,255,255";

  const tileRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const showPopover = () => {
    if (!tileRef.current) return;
    const r = tileRef.current.getBoundingClientRect();
    const left = Math.max(
      8,
      Math.min(
        window.innerWidth - POPOVER_WIDTH - 8,
        r.left + r.width / 2 - POPOVER_WIDTH / 2
      )
    );
    setPos({ top: r.bottom + 6, left });
  };
  const hidePopover = () => setPos(null);

  return (
    <button
      ref={tileRef}
      onClick={() => onSelect(agg.sector.id)}
      onMouseEnter={showPopover}
      onMouseLeave={hidePopover}
      onFocus={showPopover}
      onBlur={hidePopover}
      style={{
        animationDelay: `${Math.min(index * 14, 240)}ms`,
        background: `linear-gradient(140deg, rgba(${tintRgb},${baseAlpha}) 0%, rgba(${tintRgb},${edgeAlpha}) 100%)`,
      }}
      className={classNames(
        "group focus-ring relative flex animate-floatIn items-center gap-1.5 overflow-hidden rounded-md border px-2 py-2 text-left transition duration-200",
        "hover:-translate-y-[1px] hover:border-white/[0.18]",
        isSelected ? "border-white/40" : "border-white/[0.05]"
      )}
    >
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm"
        style={{
          background: live ? `rgba(${heatRgb},0.55)` : "rgba(255,255,255,0.04)",
          color: live ? "#0B0B0F" : "rgba(255,255,255,0.5)",
        }}
      >
        <Icon size={9} />
      </span>

      <span
        className={classNames(
          "min-w-0 flex-1 truncate text-[11px] font-semibold tracking-tight",
          live ? "text-white/95" : "text-white/55"
        )}
      >
        {agg.sector.shortName}
      </span>

      <span
        className="shrink-0 font-mono text-[12px] font-bold tabular-nums"
        style={{ color: live ? heatHex : "rgba(255,255,255,0.28)" }}
      >
        {live ? heat : "·"}
      </span>

      {pos
        ? createPortal(
            <SectorTilePopover agg={agg} top={pos.top} left={pos.left} />,
            document.body
          )
        : null}
    </button>
  );
}

const SENT_COLOR: Record<"Bullish" | "Bearish" | "Neutral", string> = {
  Bullish: "#34D399",
  Bearish: "#F87171",
  Neutral: "#94A3B8",
};

function SectorTilePopover({
  agg,
  top,
  left,
}: {
  agg: SectorAggregate;
  top: number;
  left: number;
}) {
  const breakdown = useSectorBreakdown(agg.sector.id);
  const heat = Math.max(0, Math.min(100, agg.heatScore));
  const { hex: heatHex } = heatToColor(heat);
  const sentColor = SENT_COLOR[agg.sentiment];
  const live = agg.newsCount > 0;
  const tier = heatTier(heat);

  const segs = [
    { label: "Bull", count: breakdown?.bullish ?? 0, color: SENT_COLOR.Bullish },
    { label: "Neut", count: breakdown?.neutral ?? 0, color: SENT_COLOR.Neutral },
    { label: "Bear", count: breakdown?.bearish ?? 0, color: SENT_COLOR.Bearish },
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
          {agg.sector.name}
        </div>
        <div
          className="shrink-0 text-[10.5px] font-semibold uppercase tracking-wider"
          style={{ color: live ? heatHex : "rgba(255,255,255,0.45)" }}
        >
          {live ? tier.label : "Quiet"}
        </div>
      </div>

      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full"
          style={{ width: `${heat}%`, background: heatHex }}
        />
      </div>

      <div className="mt-1.5 text-[10.5px] leading-snug text-white/55">
        {live ? tier.blurb : "No news in scope."}
      </div>

      {!live ? null : (
        <>
          <div className="mt-2 flex items-center justify-between gap-2 text-[10.5px]">
            <span
              className="inline-flex items-center gap-1 font-medium"
              style={{ color: sentColor }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: sentColor }}
              />
              {agg.sentiment}
              <span className="font-mono text-white/40">
                {agg.sentimentScore > 0 ? "+" : ""}
                {agg.sentimentScore}
              </span>
            </span>
            <span className="text-white/45">
              <span className="font-mono text-white/75">{agg.newsCount}</span> news
            </span>
          </div>

          <div className="mt-1.5 flex items-center justify-between gap-2 text-[10.5px] text-white/55">
            <span className="text-white/40">Top theme</span>
            <span className="truncate text-white/85">{agg.topTheme}</span>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {segs.map((s) => (
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
                <div className="font-mono text-[12px] font-semibold tabular-nums text-white/90">
                  {s.count}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function HeatLegend() {
  const samples = [0, 25, 40, 55, 70, 85, 100]
    .map((v) => `${heatToColor(v).hex} ${v}%`)
    .join(", ");
  return (
    <div className="mb-2 flex items-center gap-2 px-0.5">
      <span className="font-mono text-[9.5px] text-white/40">0</span>
      <div
        className="h-1.5 flex-1 rounded-full"
        style={{ background: `linear-gradient(90deg, ${samples})` }}
      />
      <span className="font-mono text-[9.5px] text-white/40">100</span>
    </div>
  );
}
