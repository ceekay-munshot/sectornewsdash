import type { SectorAggregate } from "../types";
import { SECTOR_ICONS } from "../lib/icons";
import { classNames } from "../lib/utils";

interface Props {
  aggregates: SectorAggregate[];
  onSelect: (sectorId: string) => void;
  selectedId?: string | null;
}

/**
 * Compact heatmap row — one tile per sector, intensity scaled by heat score.
 * A glance gives the user the sector temperature across the market.
 */
export function SectorHeatmap({ aggregates, onSelect, selectedId }: Props) {
  return (
    <div className="glass overflow-hidden p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-white/45">
          Sector heatmap
        </div>
        <div className="text-[10.5px] text-white/35">
          intensity = heat score · click to drill
        </div>
      </div>
      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-15">
        {aggregates.map((a) => {
          const Icon = SECTOR_ICONS[a.sector.iconKey];
          const heat = Math.max(0, Math.min(100, a.heatScore));
          // Map 0..100 to 0.10..0.85 for tile alpha
          const alpha = 0.1 + (heat / 100) * 0.75;
          const isSelected = selectedId === a.sector.id;
          return (
            <button
              key={a.sector.id}
              onClick={() => onSelect(a.sector.id)}
              title={`${a.sector.name} · heat ${heat} · ${a.newsCount} news`}
              className={classNames(
                "focus-ring group relative aspect-square overflow-hidden rounded-md border transition",
                isSelected
                  ? "border-white/40"
                  : "border-white/[0.06] hover:border-white/[0.18]"
              )}
              style={{
                background: `linear-gradient(160deg, rgba(${a.sector.accentRgb},${alpha}) 0%, rgba(${a.sector.accentRgb},${alpha * 0.35}) 100%)`,
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <Icon
                  size={12}
                  className="text-white/85 drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]"
                />
              </div>
              <div className="absolute right-[3px] top-[2px] font-mono text-[8px] text-white/70">
                {heat || "—"}
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-[2px]">
                <div
                  className="h-full"
                  style={{
                    width: `${heat}%`,
                    background: `rgba(${a.sector.accentRgb},0.95)`,
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
