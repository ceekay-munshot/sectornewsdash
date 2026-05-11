import { useMemo } from "react";
import { Activity, Flame, TrendingUp } from "lucide-react";
import type { NewsItem, SectorAggregate, SectorMeta } from "../types";
import { KPIStatCard } from "./KPIStatCard";
import { SectorHeatmap } from "./SectorHeatmap";
import { SectorCard } from "./SectorCard";
import { WatchlistControl } from "./WatchlistControl";
import { EmptyState } from "./EmptyState";
import { HelpHint } from "./HelpHint";
import {
  HOTTEST_SECTOR_HINT,
  MOST_BULLISH_HINT,
  CRITICAL_ALERTS_HINT,
} from "../lib/methodologyHints";

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
    const hottest = aggregates[0];
    const mostBullish = aggregates
      .slice()
      .filter((a) => a.newsCount > 0)
      .sort((a, b) => b.sentimentScore - a.sentimentScore)[0];
    const criticals = filteredNews.filter((n) => n.urgency === "Critical");
    const critical = criticals.length;
    // Average impact across critical items only — keeps the card coherent
    // (an "avg impact" over all news under a "Critical alerts" label was
    // misleading new readers).
    const criticalAvgImpact =
      critical > 0
        ? (criticals.reduce((s, n) => s + n.impactScore, 0) / critical).toFixed(
            1
          )
        : "—";
    return { hottest, mostBullish, critical, criticalAvgImpact, total };
  }, [aggregates, filteredNews]);

  const watchlistCards = useMemo(() => {
    const order = new Map(visibleSectorIds.map((id, i) => [id, i]));
    return aggregates
      .filter((a) => order.has(a.sector.id))
      .sort((a, b) => order.get(a.sector.id)! - order.get(b.sector.id)!);
  }, [aggregates, visibleSectorIds]);

  const criticalShare =
    stats.total > 0 ? Math.round((stats.critical / stats.total) * 100) : 0;
  const bullishMeter = stats.mostBullish
    ? Math.max(0, Math.min(100, (stats.mostBullish.sentimentScore + 100) / 2))
    : 0;

  return (
    <div className="animate-floatIn space-y-3">
      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
        <KPIStatCard
          label="Hottest sector"
          value={stats.hottest?.sector.shortName ?? "—"}
          hint={
            stats.hottest
              ? `Top-ranked sector by heat score under the current filters.`
              : "No news under current filters"
          }
          icon={Flame}
          accent="#FB7185"
          help={<HelpHint {...HOTTEST_SECTOR_HINT} />}
          meter={stats.hottest?.heatScore}
          badges={
            stats.hottest
              ? [
                  { label: "Heat", value: `${stats.hottest.heatScore}` },
                  { label: "News", value: stats.hottest.newsCount },
                ]
              : undefined
          }
        />
        <KPIStatCard
          label="Most bullish sector"
          value={stats.mostBullish?.sector.shortName ?? "—"}
          hint={
            stats.mostBullish
              ? `Strongest positive sentiment skew across in-scope headlines.`
              : "No positive-skew sector"
          }
          icon={TrendingUp}
          accent="#5EEAD4"
          help={<HelpHint {...MOST_BULLISH_HINT} />}
          meter={bullishMeter}
          badges={
            stats.mostBullish
              ? [
                  {
                    label: "Sent",
                    value: `${stats.mostBullish.sentimentScore > 0 ? "+" : ""}${stats.mostBullish.sentimentScore}`,
                  },
                  { label: "News", value: stats.mostBullish.newsCount },
                ]
              : undefined
          }
        />
        <KPIStatCard
          label="Critical alerts"
          value={`${stats.critical}${stats.total ? ` / ${stats.total}` : ""}`}
          hint={
            stats.critical
              ? `Critical-urgency headlines and their average impact.`
              : "No Critical-urgency headlines"
          }
          icon={Activity}
          accent="#F59E0B"
          help={<HelpHint {...CRITICAL_ALERTS_HINT} />}
          meter={criticalShare}
          badges={
            stats.critical
              ? [
                  { label: "Share", value: `${criticalShare}%` },
                  { label: "Impact", value: stats.criticalAvgImpact },
                ]
              : undefined
          }
        />
      </div>

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
            title="Watchlist is empty"
            hint="Add a sector above, or click any tile in the heatmap below."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
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

      {/* Heatmap (all sectors at a glance) */}
      <SectorHeatmap aggregates={aggregates} onSelect={onOpenSector} />
    </div>
  );
}
