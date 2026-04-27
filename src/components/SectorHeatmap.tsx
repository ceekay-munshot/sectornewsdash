import type { SectorAggregate } from "../types";
import { SECTOR_ICONS } from "../lib/icons";
import { SentimentDot } from "./Badges";
import { classNames } from "../lib/utils";

interface Props {
  aggregates: SectorAggregate[];
  onSelect: (sectorId: string) => void;
  selectedId?: string | null;
}

/**
 * Premium sector heatmap — info-dense tiles in a balanced grid.
 * Each tile shows sector identity (icon + name), heat score (large mono),
 * news volume, sentiment dot, and a fill-bar at the bottom keyed to heat.
 * Top-3 hottest sectors get a rank badge.
 */
export function SectorHeatmap({ aggregates, onSelect, selectedId }: Props) {
  const liveCount = aggregates.filter((a) => a.newsCount > 0).length;
  const ranked = aggregates
    .slice()
    .sort((a, b) => b.heatScore - a.heatScore)
    .filter((a) => a.heatScore > 0);
  const rankMap = new Map<string, number>();
  ranked.slice(0, 3).forEach((a, i) => rankMap.set(a.sector.id, i + 1));

  return (
    <div className="glass relative overflow-hidden p-3.5">
      <div className="mb-3 flex items-center justify-between px-0.5">
        <div className="flex items-baseline gap-2">
          <div className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-white/50">
            Sector heatmap
          </div>
          <div className="font-mono text-[10.5px] text-white/35">
            {aggregates.length} sectors ·{" "}
            <span className="text-emerald-300/85">{liveCount} live</span>
          </div>
        </div>
        <div className="hidden text-[10.5px] text-white/35 sm:block">
          intensity = heat score · click to drill
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {aggregates.map((a, idx) => (
          <HeatTile
            key={a.sector.id}
            agg={a}
            rank={rankMap.get(a.sector.id)}
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
  rank,
  isSelected,
  onSelect,
  index,
}: {
  agg: SectorAggregate;
  rank?: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
  index: number;
}) {
  const Icon = SECTOR_ICONS[agg.sector.iconKey];
  const heat = Math.max(0, Math.min(100, agg.heatScore));
  const rgb = agg.sector.accentRgb;
  const accent = agg.sector.accent;
  const live = agg.newsCount > 0;

  // Background tint scales with heat — cold sectors stay neutral but keep
  // a faint accent ghost so identity is always present.
  const tintAlpha = 0.04 + (heat / 100) * 0.32;
  const glowAlpha = (heat / 100) * 0.5;

  return (
    <button
      onClick={() => onSelect(agg.sector.id)}
      title={`${agg.sector.name} · heat ${heat} · ${agg.newsCount} news`}
      style={{
        animationDelay: `${Math.min(index * 18, 280)}ms`,
        background: live
          ? `linear-gradient(160deg, rgba(${rgb},${tintAlpha}) 0%, rgba(${rgb},${tintAlpha * 0.18}) 100%)`
          : `linear-gradient(160deg, rgba(255,255,255,0.018) 0%, rgba(255,255,255,0.01) 100%)`,
      }}
      className={classNames(
        "group focus-ring relative animate-floatIn overflow-hidden rounded-lg border p-2.5 text-left transition duration-200",
        "hover:-translate-y-[1px] hover:border-white/[0.18]",
        isSelected ? "border-white/40" : "border-white/[0.06]"
      )}
    >
      {/* Soft accent glow for hot sectors */}
      {live && (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full blur-xl"
          style={{ background: `rgba(${rgb},${glowAlpha})` }}
        />
      )}

      {/* Top row — icon + short name + sentiment */}
      <div className="relative flex items-center justify-between gap-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <div
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded ring-1 ring-white/5"
            style={{
              background: live
                ? `rgba(${rgb},0.22)`
                : "rgba(255,255,255,0.04)",
              color: live ? accent : "rgba(255,255,255,0.55)",
            }}
          >
            <Icon size={10} />
          </div>
          <span
            className={classNames(
              "truncate text-[11.5px] font-semibold tracking-tight",
              live ? "text-white/90" : "text-white/55"
            )}
          >
            {agg.sector.shortName}
          </span>
        </div>
        {rank && (
          <span
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm font-mono text-[9px] font-bold"
            style={{
              background: `rgba(${rgb},0.22)`,
              color: accent,
              boxShadow: `inset 0 0 0 1px rgba(${rgb},0.45)`,
            }}
            title={`#${rank} hottest`}
          >
            {rank}
          </span>
        )}
        {!rank && live && <SentimentDot sentiment={agg.sentiment} />}
      </div>

      {/* Heat number */}
      <div className="relative mt-1.5 flex items-baseline justify-between">
        <span
          className="font-mono text-[18px] font-semibold leading-none tracking-tight"
          style={{ color: live ? accent : "rgba(255,255,255,0.28)" }}
        >
          {live ? heat : "—"}
        </span>
        <span
          className={classNames(
            "font-mono text-[10px]",
            live ? "text-white/55" : "text-white/30"
          )}
        >
          {live ? `${agg.newsCount}` : "—"}
          <span className="ml-0.5 text-white/30">news</span>
        </span>
      </div>

      {/* Heat fill bar */}
      <div className="relative mt-2 h-[3px] overflow-hidden rounded-full bg-white/[0.04]">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{
            width: `${heat}%`,
            background: live
              ? `linear-gradient(90deg, rgba(${rgb},0.55), rgba(${rgb},1))`
              : "transparent",
            boxShadow: live ? `0 0 8px rgba(${rgb},0.55)` : undefined,
          }}
        />
      </div>
    </button>
  );
}
