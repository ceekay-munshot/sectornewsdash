import { useEffect, useState } from "react";
import { KeyRound, RefreshCw, X } from "lucide-react";
import { parseMunsAutoNews } from "../lib/munsParse";
import { munsRowsToNewsItems } from "../lib/munsToNews";
import { NewsFeed } from "./NewsFeed";
import type { NewsItem } from "../types";

const MUNS_API_BASE = "https://devde.muns.io";
const TOKEN_STORAGE_KEY = "muns.token";
const NEWS_LIMIT = 20;

type RunState = "idle" | "running" | "ok" | "error";

interface Props {
  sectorId: string;
  sectorShortName: string;
  agentLibraryId: string;
  /** Items shown in the list — typically MUNS-derived when loaded, mock otherwise. */
  items: NewsItem[];
  /** Whether the items currently in `items` are MUNS-derived. */
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
  const [token, setToken] = useState<string>(
    () => sessionStorage.getItem(TOKEN_STORAGE_KEY) || "",
  );
  const [draftToken, setDraftToken] = useState("");
  const [tokenOpen, setTokenOpen] = useState(false);
  const [state, setState] = useState<RunState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  }, [token]);

  const saveToken = () => {
    const trimmed = draftToken.trim();
    if (!trimmed) return;
    setToken(trimmed);
    setDraftToken("");
    setTokenOpen(false);
  };

  const clearToken = () => {
    setToken("");
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    setTokenOpen(true);
  };

  const handleRun = async () => {
    if (!token) {
      setTokenOpen(true);
      return;
    }
    setState("running");
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const response = await fetch(`${MUNS_API_BASE}/agents/run`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
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
        setError(`MUNS responded ${response.status}: ${text.slice(0, 160)}`);
        return;
      }
      const rows = parseMunsAutoNews(text);
      if (rows.length === 0) {
        setState("error");
        setError("MUNS responded but no parseable news rows were found.");
        return;
      }
      onLoaded(munsRowsToNewsItems(rows, sectorId), new Date());
      setState("ok");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : String(err));
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
        <div className="flex items-center gap-1.5">
          {token ? (
            <button
              type="button"
              onClick={clearToken}
              className="btn-ghost"
              title="Clear MUNS token"
            >
              <KeyRound size={11} />
              <span className="hidden sm:inline">Token set</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setTokenOpen((v) => !v)}
              className="btn-ghost"
            >
              <KeyRound size={11} />
              Set token
            </button>
          )}
          <button
            type="button"
            onClick={handleRun}
            disabled={state === "running"}
            className="btn-primary"
            title="Run MUNS agent"
          >
            <RefreshCw
              size={11}
              className={state === "running" ? "animate-spin" : ""}
            />
            {state === "running" ? "Running…" : isLive ? "Refresh" : "Run MUNS"}
          </button>
        </div>
      </div>

      {tokenOpen ? (
        <div className="glass flex flex-wrap items-center gap-2 p-2.5">
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={draftToken}
            onChange={(e) => setDraftToken(e.target.value)}
            placeholder="Paste MUNS bearer token"
            className="focus-ring flex-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 font-mono text-[11.5px] text-white/85 placeholder:text-white/25"
          />
          <button type="button" onClick={saveToken} className="btn-primary">
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setTokenOpen(false);
              setDraftToken("");
            }}
            className="btn-ghost"
            aria-label="Cancel"
          >
            <X size={12} />
          </button>
        </div>
      ) : null}

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
        emptyHint="Hit Run MUNS to fetch live items, or seed mock items in src/data/mockNews.ts."
      />
    </div>
  );
}
