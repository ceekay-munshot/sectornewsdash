import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "./components/Header";
import { FilterBar } from "./components/FilterBar";
import { OverviewTab } from "./components/OverviewTab";
import { SectorDetail } from "./components/SectorDetail";
import { NewsInsightPanel } from "./components/NewsInsightPanel";
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
import {
  SectorBreakdownProvider,
  buildSectorBreakdowns,
} from "./lib/sectorBreakdown";
import { syncAllSectors } from "./lib/syncAll";
import {
  fetchRemoteNews,
  persistRemoteNews,
  type MunsSectorPayload,
} from "./lib/newsStore";
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

const NEWS_STORAGE_KEY = "agent-news-by-sector-v1";
const REMOTE_PUT_DEBOUNCE_MS = 500;

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
  // localStorage is the fast cache for instant first paint; KV (via the
  // Worker at /api/news) is the canonical store shared across deploys
  // and preview origins.
  const [munsBySector, setMunsBySector] = useState<
    Record<string, MunsSectorPayload>
  >(loadPersistedNews);
  // Until the remote fetch settles we don't echo local state back to KV —
  // otherwise a fresh tab with empty localStorage would clobber the blob.
  const [hasFetchedRemote, setHasFetchedRemote] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(NEWS_STORAGE_KEY, JSON.stringify(munsBySector));
    } catch {
      // storage may be full or disabled — silently ignore
    }
  }, [munsBySector]);

  // On mount, prefer KV over local. If KV has data, replace local; if KV
  // is empty but local has data, mark remote as fetched so the next change
  // gets persisted upward.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const remote = await fetchRemoteNews();
      if (cancelled) return;
      if (Object.keys(remote).length > 0) {
        setMunsBySector(remote);
      }
      setHasFetchedRemote(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Mirror local state back to KV (debounced) once the initial fetch is in.
  useEffect(() => {
    if (!hasFetchedRemote) return;
    const t = window.setTimeout(() => {
      void persistRemoteNews(munsBySector);
    }, REMOTE_PUT_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [munsBySector, hasFetchedRemote]);

  const setMunsForSector = useCallback(
    (sectorId: string, items: NewsItem[], at: Date) => {
      setMunsBySector((prev) => ({
        ...prev,
        [sectorId]: { items, loadedAt: at.getTime() },
      }));
    },
    []
  );

  // Bulk-sync state — shared by the header button and the auto-sync
  // that fires when nothing is persisted yet (e.g. a fresh preview URL).
  const [syncRunning, setSyncRunning] = useState(false);
  const [syncDone, setSyncDone] = useState(0);
  const [syncTotal, setSyncTotal] = useState(0);
  const [syncCompleted, setSyncCompleted] = useState(false);

  const triggerSyncAll = useCallback(async () => {
    setSyncRunning(true);
    setSyncCompleted(false);
    setSyncDone(0);
    await syncAllSectors(setMunsForSector, (d, t) => {
      setSyncDone(d);
      setSyncTotal(t);
    });
    setSyncRunning(false);
    setSyncCompleted(true);
    window.setTimeout(() => setSyncCompleted(false), 4000);
  }, [setMunsForSector]);

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

  // Per-sector sentiment breakdown for hover popovers, keyed by sector id.
  const sectorBreakdowns = useMemo(() => {
    const heat: Record<string, number> = {};
    for (const a of aggregates) heat[a.sector.id] = a.heatScore;
    return buildSectorBreakdowns(filteredNews, heat);
  }, [aggregates, filteredNews]);

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
    <SectorBreakdownProvider value={sectorBreakdowns}>
    <div className="grain min-h-screen">
      <Header
        syncRunning={syncRunning}
        syncDone={syncDone}
        syncTotal={syncTotal}
        syncCompleted={syncCompleted}
        onSync={triggerSyncAll}
      />
      <FilterBar
        filters={filters}
        onChange={setFilters}
        onClear={() => setFilters(EMPTY_FILTERS)}
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
      </main>

      <NewsInsightPanel item={activeNews} onClose={onCloseInsight} />
    </div>
    </SectorBreakdownProvider>
  );
}
