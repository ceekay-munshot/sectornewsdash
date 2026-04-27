import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "./components/Header";
import { FilterBar } from "./components/FilterBar";
import { OverviewTab } from "./components/OverviewTab";
import { SectorDetail } from "./components/SectorDetail";
import { NewsInsightPanel } from "./components/NewsInsightPanel";
import { MethodologyPanel } from "./components/MethodologyPanel";
import { MOCK_NEWS } from "./data/mockNews";
import { SECTORS } from "./data/sectors";
import {
  buildSectorAggregates,
  filterNews,
  rankNewsByImpact,
  type FilterState,
} from "./lib/logic";
import type { NewsItem } from "./types";

const EMPTY_FILTERS: FilterState = {
  query: "",
  sectorId: null,
  sentiment: null,
  minImpact: 0,
  urgency: null,
  sourceType: null,
  timeHorizon: null,
  theme: null,
};

export default function App() {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [view, setView] = useState<"overview" | "sector">("overview");
  const [activeSectorId, setActiveSectorId] = useState<string | null>(null);
  const [activeNews, setActiveNews] = useState<NewsItem | null>(null);

  // Filtered + ranked news (global)
  const filteredNews = useMemo(
    () => rankNewsByImpact(filterNews(MOCK_NEWS, filters)),
    [filters]
  );

  // Aggregates for overview — built from filtered news so filters cascade.
  const aggregates = useMemo(
    () => buildSectorAggregates(filteredNews),
    [filteredNews]
  );

  // News for the currently selected sector (filters minus sectorId, then locked
  // to that sector). This way the FilterBar's sector control isn't a no-op
  // inside detail view.
  const sectorNews = useMemo(() => {
    if (!activeSectorId) return [];
    const local = filterNews(MOCK_NEWS, { ...filters, sectorId: activeSectorId });
    return rankNewsByImpact(local);
  }, [activeSectorId, filters]);

  const activeAggregate = useMemo(() => {
    if (!activeSectorId) return null;
    return aggregates.find((a) => a.sector.id === activeSectorId) ?? null;
  }, [activeSectorId, aggregates]);

  const openSector = useCallback((id: string) => {
    setActiveSectorId(id);
    setView("sector");
  }, []);

  const backToOverview = useCallback(() => {
    setView("overview");
    setActiveSectorId(null);
  }, []);

  const onSelectNews = useCallback((n: NewsItem) => setActiveNews(n), []);
  const onCloseInsight = useCallback(() => setActiveNews(null), []);

  // Lock body scroll when insight panel is open.
  useEffect(() => {
    document.body.style.overflow = activeNews ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [activeNews]);

  // Keep activeAggregate in sync if filters drop the sector entirely.
  useEffect(() => {
    if (view === "sector" && activeSectorId) {
      const exists = SECTORS.some((s) => s.id === activeSectorId);
      if (!exists) backToOverview();
    }
  }, [view, activeSectorId, backToOverview]);

  return (
    <div className="grain min-h-screen">
      <Header
        totalNews={MOCK_NEWS.length}
        sectorsTracked={SECTORS.length}
      />
      <FilterBar
        filters={filters}
        onChange={setFilters}
        onClear={() => setFilters(EMPTY_FILTERS)}
        resultCount={
          view === "sector" ? sectorNews.length : filteredNews.length
        }
      />

      <main className="relative z-10 mx-auto max-w-[1400px] px-5 py-5">
        {view === "overview" || !activeAggregate ? (
          <OverviewTab
            aggregates={aggregates}
            filteredNews={filteredNews}
            onOpenSector={openSector}
            onSelectNews={onSelectNews}
          />
        ) : (
          <SectorDetail
            aggregate={activeAggregate}
            sectorNews={sectorNews}
            onBack={backToOverview}
            onSelectNews={onSelectNews}
            selectedNewsId={activeNews?.id ?? null}
          />
        )}

        <MethodologyPanel />
      </main>

      <NewsInsightPanel item={activeNews} onClose={onCloseInsight} />

      <footer className="relative z-10 mx-auto max-w-[1400px] px-5 pb-6 pt-2 text-center text-[10.5px] text-white/35">
        Mock data only · Replace `src/data/mockNews.ts` with your AI Agent JSON
        when ready.
      </footer>
    </div>
  );
}
