import { useMemo, useState } from "react";
import { Flame, TrendingUp } from "lucide-react";
import type { NewsItem, SectorAggregate, SectorMeta } from "../types";
import { KPIStatCard } from "./KPIStatCard";
import {
  CriticalAlertsCard,
  type CriticalBreakdownRow,
} from "./CriticalAlertsCard";
import { SectorHeatmap } from "./SectorHeatmap";
import { SectorCard } from "./SectorCard";
import { WatchlistControl } from "./WatchlistControl";
import { EmptyState } from "./EmptyState";
import { WhyPanel } from "./WhyPanel";
import {
  explainCritical,
  explainHottest,
  explainMostBullish,
  type WhyExplanation,
} from "../lib/whyExplainers";

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
    const hottest = aggregates[0];
    // "Most bullish" picks the sector with the strongest *net bullish
    // energy* — Σ(impact × recency × confidence) for bullish minus the
    // same for bearish. This way 19 mid-impact bullish items beat 11
    // small bullish items even when the latter has a purer +100 score.
    // Tie-break on raw sentimentScore for stability.
    const mostBullish = aggregates
      .slice()
      .filter((a) => a.newsCount > 0 && a.bullishMomentum > 0)
      .sort((a, b) =>
        b.bullishMomentum !== a.bullishMomentum
          ? b.bullishMomentum - a.bullishMomentum
          : b.sentimentScore - a.sentimentScore
      )[0];
    const criticals = filteredNews.filter((n) => n.urgency === "Critical");
    const critical = criticals.length;

    // Per-sector breakdown for the hover popover. Headlines already
    // come sorted by impact, so the first match per sector is the top
    // critical headline for that sector.
    const sectorById = new Map(allSectors.map((s) => [s.id, s]));
    const buckets = new Map<
      string,
      { sector: SectorMeta; count: number; impactSum: number; top: NewsItem }
    >();
    for (const n of criticals) {
      const sector = sectorById.get(n.sector);
      if (!sector) continue;
      const cur = buckets.get(sector.id);
      if (cur) {
        cur.count += 1;
        cur.impactSum += n.impactScore;
      } else {
        buckets.set(sector.id, {
          sector,
          count: 1,
          impactSum: n.impactScore,
          top: n,
        });
      }
    }
    const criticalBreakdown: CriticalBreakdownRow[] = Array.from(
      buckets.values()
    )
      .map((b) => ({
        sector: b.sector,
        count: b.count,
        avgImpact: b.impactSum / b.count,
        topHeadline: b.top,
      }))
      .sort((a, b) =>
        b.count !== a.count ? b.count - a.count : b.avgImpact - a.avgImpact
      );

    return { hottest, mostBullish, critical, criticalBreakdown };
  }, [aggregates, filteredNews, allSectors]);

  const watchlistCards = useMemo(() => {
    const order = new Map(visibleSectorIds.map((id, i) => [id, i]));
    return aggregates
      .filter((a) => order.has(a.sector.id))
      .sort((a, b) => order.get(a.sector.id)! - order.get(b.sector.id)!);
  }, [aggregates, visibleSectorIds]);

  const [why, setWhy] = useState<WhyExplanation | null>(null);
  const criticals = useMemo(
    () => filteredNews.filter((n) => n.urgency === "Critical"),
    [filteredNews]
  );

  const openHottestWhy = () => {
    const w = explainHottest(stats.hottest, aggregates);
    if (w) setWhy(w);
  };
  const openBullishWhy = () => {
    const w = explainMostBullish(stats.mostBullish, aggregates);
    if (w) setWhy(w);
  };
  const openCriticalWhy = () => {
    const w = explainCritical(stats.critical, criticals, aggregates);
    if (w) setWhy(w);
  };

  return (
    <div className="animate-floatIn space-y-2">
      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <KPIStatCard
          label="Hottest sector"
          value={stats.hottest?.sector.shortName ?? "—"}
          hint={stats.hottest ? undefined : "No news under current filters"}
          icon={Flame}
          accent="#FB7185"
          onClick={stats.hottest ? openHottestWhy : undefined}
          whyLabel="Why is this the hottest sector?"
        />
        <KPIStatCard
          label="Most bullish sector"
          value={stats.mostBullish?.sector.shortName ?? "—"}
          hint={stats.mostBullish ? undefined : "No positive-skew sector"}
          icon={TrendingUp}
          accent="#5EEAD4"
          onClick={stats.mostBullish ? openBullishWhy : undefined}
          whyLabel="Why is this the most bullish sector?"
        />
        <CriticalAlertsCard
          count={stats.critical}
          rows={stats.criticalBreakdown}
          onClick={stats.critical > 0 ? openCriticalWhy : undefined}
        />
      </div>

      <WhyPanel open={Boolean(why)} why={why} onClose={() => setWhy(null)} />

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
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
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
