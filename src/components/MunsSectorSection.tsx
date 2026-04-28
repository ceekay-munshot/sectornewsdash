import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { parseMunsAutoNews } from "../lib/munsParse";
import { munsRowsToNewsItems } from "../lib/munsToNews";
import { AGENT_ACCESS_TOKEN, AGENT_API_BASE } from "../lib/agentConfig";
import { NewsFeed } from "./NewsFeed";
import type { NewsItem } from "../types";

const NEWS_LIMIT = 20;

type RunState = "idle" | "running" | "ok" | "error";

interface Props {
  sectorId: string;
  sectorShortName: string;
  agentLibraryId: string;
  /** Items shown in the list — typically agent-derived when loaded, mock otherwise. */
  items: NewsItem[];
  /** Whether the items currently in `items` are agent-derived. */
  isLive: boolean;
  /** Wall-clock time of the last successful run, if any. */
  lastRunAt: Date | null;
  onLoaded: (items: NewsItem[], at: Date) => void;
  onSelectNews: (item: NewsItem) => void;
  selectedNewsId?: string | null;
}

export function MunsSectorSection({
  sectorId,
  sectorShortName,
  agentLibraryId,
  items,
  isLive,
  lastRunAt,
  onLoaded,
  onSelectNews,
  selectedNewsId,
}: Props) {
  const [state, setState] = useState<RunState>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setState("running");
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const response = await fetch(`${AGENT_API_BASE}/agents/run`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AGENT_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agent_library_id: agentLibraryId,
          metadata: {
            stock_ticker: "JIOFIN",
            stock_company_name: "Jio Financial Services Ltd.",
            context_company_name: "Jio Financial Services Ltd.",
            stock_country: "INDIA",
            to_date: today,
            timezone: "UTC",
          },
        }),
      });
      const text = await response.text();
      if (!response.ok) {
        setState("error");
        setError("Could not refresh news right now. Please try again.");
        return;
      }
      const rows = parseMunsAutoNews(text);
      if (rows.length === 0) {
        setState("error");
        setError("No news items returned for this sector.");
        return;
      }
      onLoaded(munsRowsToNewsItems(rows, sectorId), new Date());
      setState("ok");
    } catch {
      setState("error");
      setError("Could not refresh news right now. Please try again.");
    }
  };

  const visibleCount = Math.min(items.length, NEWS_LIMIT);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
          Material news ·{" "}
          <span className="text-white/70">
            {visibleCount} of {items.length}
          </span>
          {isLive && lastRunAt ? (
            <span className="ml-2 normal-case tracking-normal text-emerald-300/80">
              · live ·{" "}
              {lastRunAt.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleRun}
          disabled={state === "running"}
          className="btn-primary"
          title="Refresh sector news"
        >
          <RefreshCw
            size={11}
            className={state === "running" ? "animate-spin" : ""}
          />
          {state === "running" ? "Refreshing…" : isLive ? "Refresh" : "Load news"}
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-[11.5px] text-red-200">
          {error}
        </div>
      ) : null}

      <NewsFeed
        items={items}
        limit={NEWS_LIMIT}
        onSelect={onSelectNews}
        selectedId={selectedNewsId}
        emptyTitle={`No news yet for ${sectorShortName}`}
        emptyHint="Tap Load news to fetch the latest items for this sector."
      />
    </div>
  );
}
