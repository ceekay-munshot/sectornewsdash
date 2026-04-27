import { useMemo } from "react";
import { Activity, Flame, Newspaper, Radar, TrendingUp } from "lucide-react";
import type { NewsItem, SectorAggregate, SectorMeta } from "../types";
import { KPIStatCard } from "./KPIStatCard";
import { SectorHeatmap } from "./SectorHeatmap";
import { SectorCard } from "./SectorCard";
import { WatchlistControl } from "./WatchlistControl";
import { EmptyState } from "./EmptyState";

interface Props {
  aggregates: SectorAggregate[];
  filteredNews: NewsItem[];
  visibleSectorIds: string[];
  allSectors: SectorMeta[];
  onAddSector: (id: string) => void;
  onRemoveSector: (id: string) => void;
  onResetWatchlist: () => void;
  onOpenSector: (sectorId: string) => void;
  onSelectNews: (n: NewsItem) => void;
}

export function OverviewTab({
  aggregates,
  filteredNews,
  visibleSectorIds,
  allSectors,
  onAddSector,
  onRemoveSector,
  onResetWatchlist,
  onOpenSector,
  onSelectNews,
}: Props) {
  const stats = useMemo(() => {
    const total = filteredNews.length;
    const sectorsCovered = aggregates.filter((a) => a.newsCount > 0).length;
    const hottest = aggregates[0];
    const mostBullish = aggregates
      .slice()
      .filter((a) => a.newsCount > 0)
      .sort((a, b) => b.sentimentScore - a.sentimentScore)[0];
    const critical = filteredNews.filter((n) => n.urgency === "Critical").length;
    const avgImpact =
      total > 0
        ? (filteredNews.reduce((s, n) => s + n.impactScore, 0) / total).toFixed(
            1
          )
        : "—";
    return { total, sectorsCovered, hottest, mostBullish, critical, avgImpact };
  }, [aggregates, filteredNews]);

  const watchlistCards = useMemo(() => {
    const order = new Map(visibleSectorIds.map((id, i) => [id, i]));
    return aggregates
      .filter((a) => order.has(a.sector.id))
      .sort((a, b) => order.get(a.sector.id)! - order.get(b.sector.id)!);
  }, [aggregates, visibleSectorIds]);

  return (
    <div className="animate-floatIn space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <KPIStatCard
          label="Total news"
          value={stats.total}
          hint="In current filter scope"
          icon={Newspaper}
          accent="#7DD3FC"
        />
        <KPIStatCard
          label="Sectors covered"
          value={`${stats.sectorsCovered}/${aggregates.length}`}
          hint="With at least one item"
          icon={Radar}
          accent="#A78BFA"
        />
        <KPIStatCard
          label="Hottest sector"
          value={stats.hottest?.heatScore || "—"}
          hint={stats.hottest?.sector.shortName ?? "Awaiting feed"}
          icon={Flame}
          accent="#FB7185"
        />
        <KPIStatCard
          label="Most bullish"
          value={stats.mostBullish?.sector.shortName ?? "—"}
          hint={
            stats.mostBullish
              ? `Sentiment ${stats.mostBullish.sentimentScore > 0 ? "+" : ""}${stats.mostBullish.sentimentScore}`
              : "Awaiting feed"
          }
          icon={TrendingUp}
          accent="#5EEAD4"
        />
        <KPIStatCard
          label="Critical alerts"
          value={stats.critical}
          hint={`Avg impact ${stats.avgImpact}`}
          icon={Activity}
          accent="#F59E0B"
        />
      </div>

      {/* Heatmap (all 29 sectors at a glance) */}
      <SectorHeatmap aggregates={aggregates} onSelect={onOpenSector} />

      {/* Watchlist controls */}
      <WatchlistControl
        allSectors={allSectors}
        visibleIds={visibleSectorIds}
        onAdd={onAddSector}
        onReset={onResetWatchlist}
      />

      {/* Watchlist sector cards */}
      {watchlistCards.length === 0 ? (
        <div className="glass">
          <EmptyState
            title="Your watchlist is empty"
            hint="Use the search and Add button above, or click any tile in the heatmap to open a sector."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {watchlistCards.map((a) => (
            <SectorCard
              key={a.sector.id}
              agg={a}
              onOpenSector={onOpenSector}
              onSelectNews={onSelectNews}
              onRemove={onRemoveSector}
            />
          ))}
        </div>
      )}
    </div>
  );
}
