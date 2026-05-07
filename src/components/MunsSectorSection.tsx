import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { runSectorAgent } from "../lib/runAgent";
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
      const items = await runSectorAgent(sectorId, agentLibraryId);
      onLoaded(items, new Date());
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
        <div className="flex items-baseline gap-2">
          <div className="label-eyebrow">Material news</div>
          <span className="text-[10.5px] text-white/55 num">
            <span className="font-semibold text-white/85">{visibleCount}</span>
            <span className="text-white/30"> / {items.length}</span>
          </span>
          {isLive && lastRunAt ? (
            <span className="inline-flex items-center gap-1.5 text-[10.5px] text-emerald-300/85">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 animate-pulseSoft rounded-full bg-emerald-400/60" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <span className="font-mono num text-emerald-300/85">
                {lastRunAt.toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleRun}
          disabled={state === "running"}
          className="btn-primary disabled:cursor-not-allowed disabled:opacity-70"
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
        <div className="rounded-md border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-[11.5px] text-rose-200">
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
