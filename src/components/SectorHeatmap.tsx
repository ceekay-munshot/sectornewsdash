import type { SectorAggregate } from "../types";
import { SECTOR_ICONS } from "../lib/icons";
import { classNames } from "../lib/utils";

interface Props {
  aggregates: SectorAggregate[];
  onSelect: (sectorId: string) => void;
  selectedId?: string | null;
}

/**
 * True heatmap — color carries the data. Each tile is a single row
 * (icon + short name + heat number); intensity of the sector accent
 * tracks heat score. Cold sectors fade to near-neutral so the live
 * sectors visibly pop.
 */
export function SectorHeatmap({ aggregates, onSelect, selectedId }: Props) {
  const liveCount = aggregates.filter((a) => a.newsCount > 0).length;

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
          color intensity = heat · click to drill
        </div>
      </div>

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
  const rgb = agg.sector.accentRgb;
  const accent = agg.sector.accent;
  const live = agg.newsCount > 0;

  // Tile background tints stronger as heat rises. Cold sectors keep
  // a barely-there ghost of the sector accent so identity persists.
  const baseAlpha = live ? 0.05 + (heat / 100) * 0.4 : 0.025;
  const edgeAlpha = live ? 0.01 + (heat / 100) * 0.18 : 0.012;

  return (
    <button
      onClick={() => onSelect(agg.sector.id)}
      title={`${agg.sector.name} · heat ${heat} · ${agg.newsCount} news · ${agg.sentiment}`}
      style={{
        animationDelay: `${Math.min(index * 14, 240)}ms`,
        background: `linear-gradient(140deg, rgba(${rgb},${baseAlpha}) 0%, rgba(${rgb},${edgeAlpha}) 100%)`,
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
          background: live ? `rgba(${rgb},0.28)` : "rgba(255,255,255,0.04)",
          color: live ? accent : "rgba(255,255,255,0.5)",
        }}
      >
        <Icon size={9} />
      </span>

      <span
        className={classNames(
          "min-w-0 flex-1 truncate text-[11px] font-semibold tracking-tight",
          live ? "text-white/90" : "text-white/55"
        )}
      >
        {agg.sector.shortName}
      </span>

      <span
        className="shrink-0 font-mono text-[12px] font-bold tabular-nums"
        style={{ color: live ? accent : "rgba(255,255,255,0.28)" }}
      >
        {live ? heat : "·"}
      </span>
    </button>
  );
}
