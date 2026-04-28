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
import {
  DEFAULT_WATCHLIST,
  loadWatchlist,
  saveWatchlist,
} from "./lib/watchlist";
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

interface MunsSectorPayload {
  items: NewsItem[];
  loadedAt: number;
}

const NEWS_STORAGE_KEY = "agent-news-by-sector-v1";

function loadPersistedNews(): Record<string, MunsSectorPayload> {
  try {
    const raw = localStorage.getItem(NEWS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // ignore unparseable storage
  }
  return {};
}

export default function App() {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [view, setView] = useState<"overview" | "sector">("overview");
  const [activeSectorId, setActiveSectorId] = useState<string | null>(null);
  const [activeNews, setActiveNews] = useState<NewsItem | null>(null);
  const [watchlistIds, setWatchlistIds] = useState<string[]>(() =>
    loadWatchlist(SECTORS.map((s) => s.id))
  );
  // Live agent news per sector. When present, replaces mock news for that
  // sector so aggregates, heatmap, and filters all see the live items.
  // Persisted to localStorage so a one-time bulk seed survives page reloads.
  const [munsBySector, setMunsBySector] = useState<
    Record<string, MunsSectorPayload>
  >(loadPersistedNews);

  useEffect(() => {
    try {
      localStorage.setItem(NEWS_STORAGE_KEY, JSON.stringify(munsBySector));
    } catch {
      // storage may be full or disabled — silently ignore
    }
  }, [munsBySector]);

  const setMunsForSector = useCallback(
    (sectorId: string, items: NewsItem[], at: Date) => {
      setMunsBySector((prev) => ({
        ...prev,
        [sectorId]: { items, loadedAt: at.getTime() },
      }));
    },
    []
  );

  // Pool: replace any sector's mock news with its MUNS items when present.
  const livePool = useMemo<NewsItem[]>(() => {
    const liveSectorIds = new Set(Object.keys(munsBySector));
    if (liveSectorIds.size === 0) return MOCK_NEWS;
    const filteredMock = MOCK_NEWS.filter((n) => !liveSectorIds.has(n.sector));
    const muns = Object.values(munsBySector).flatMap((p) => p.items);
    return [...filteredMock, ...muns];
  }, [munsBySector]);

  useEffect(() => {
    saveWatchlist(watchlistIds);
  }, [watchlistIds]);

  const addSector = useCallback((id: string) => {
    setWatchlistIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);
  const removeSector = useCallback((id: string) => {
    setWatchlistIds((prev) => prev.filter((x) => x !== id));
  }, []);
  const resetWatchlist = useCallback(() => {
    setWatchlistIds(
      DEFAULT_WATCHLIST.filter((id) => SECTORS.some((s) => s.id === id))
    );
  }, []);

  // Filtered + ranked news (global)
  const filteredNews = useMemo(
    () => rankNewsByImpact(filterNews(livePool, filters)),
    [livePool, filters]
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
    const local = filterNews(livePool, { ...filters, sectorId: activeSectorId });
    return rankNewsByImpact(local);
  }, [activeSectorId, livePool, filters]);

  const activeMunsLoadedAt = activeSectorId
    ? munsBySector[activeSectorId]?.loadedAt ?? null
    : null;
  const activeIsLive = activeSectorId
    ? Boolean(munsBySector[activeSectorId])
    : false;

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
        totalNews={livePool.length}
        sectorsTracked={SECTORS.length}
        onSectorLoaded={setMunsForSector}
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
            visibleSectorIds={watchlistIds}
            allSectors={SECTORS}
            onAddSector={addSector}
            onRemoveSector={removeSector}
            onResetWatchlist={resetWatchlist}
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
            isLive={activeIsLive}
            lastRunAt={activeMunsLoadedAt ? new Date(activeMunsLoadedAt) : null}
            onMunsLoaded={setMunsForSector}
          />
        )}

        <MethodologyPanel />
      </main>

      <NewsInsightPanel item={activeNews} onClose={onCloseInsight} />
    </div>
  );
}
