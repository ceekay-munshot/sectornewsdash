import { useEffect, useState } from "react";
import { ExternalLink, KeyRound, RefreshCw, X } from "lucide-react";
import { parseMunsAutoNews, type MunsNewsRow } from "../lib/munsParse";
import { NewsFeed } from "./NewsFeed";
import type { NewsItem } from "../types";

const MUNS_API_BASE = "https://devde.muns.io";
const AUTO_AGENT_LIBRARY_ID = "081d9904-4b68-41b1-9133-dd9f02bb80f0";
const TOKEN_STORAGE_KEY = "muns.token";
const NEWS_LIMIT = 20;

type RunState = "idle" | "running" | "ok" | "error";

interface Props {
  fallbackNews: NewsItem[];
  onSelectNews: (item: NewsItem) => void;
  selectedNewsId?: string | null;
}

export function MunsAutoSection({ fallbackNews, onSelectNews, selectedNewsId }: Props) {
  const [token, setToken] = useState<string>(
    () => sessionStorage.getItem(TOKEN_STORAGE_KEY) || "",
  );
  const [draftToken, setDraftToken] = useState("");
  const [tokenOpen, setTokenOpen] = useState(false);
  const [rows, setRows] = useState<MunsNewsRow[] | null>(null);
  const [state, setState] = useState<RunState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null);

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
          agent_library_id: AUTO_AGENT_LIBRARY_ID,
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
      const parsed = parseMunsAutoNews(text);
      if (parsed.length === 0) {
        setState("error");
        setError("MUNS responded but no parseable news rows were found.");
        return;
      }
      setRows(parsed);
      setLastRunAt(new Date());
      setState("ok");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const showMuns = rows !== null && rows.length > 0;
  const visibleCount = showMuns ? Math.min(rows!.length, NEWS_LIMIT) : Math.min(fallbackNews.length, NEWS_LIMIT);
  const totalCount = showMuns ? rows!.length : fallbackNews.length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
          Material news ·{" "}
          <span className="text-white/70">
            {visibleCount} of {totalCount}
          </span>
          {showMuns && lastRunAt ? (
            <span className="ml-2 normal-case tracking-normal text-emerald-300/80">
              · live · {lastRunAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
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
            title="Run MUNS auto agent"
          >
            <RefreshCw size={11} className={state === "running" ? "animate-spin" : ""} />
            {state === "running" ? "Running…" : showMuns ? "Refresh" : "Run MUNS"}
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

      {showMuns ? (
        <div className="glass max-h-[520px] overflow-y-auto divide-y divide-white/[0.04] p-1">
          {rows!.slice(0, NEWS_LIMIT).map((row, idx) => (
            <MunsRow key={`${row.date}-${idx}`} row={row} />
          ))}
        </div>
      ) : (
        <NewsFeed
          items={fallbackNews}
          limit={NEWS_LIMIT}
          onSelect={onSelectNews}
          selectedId={selectedNewsId}
          emptyTitle="No news yet for Auto"
          emptyHint="Hit Run MUNS to fetch live items, or seed mock items in src/data/mockNews.ts."
        />
      )}
    </div>
  );
}

function MunsRow({ row }: { row: MunsNewsRow }) {
  return (
    <div className="group flex items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 transition hover:border-white/[0.07] hover:bg-white/[0.025]">
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-[12.5px] font-medium text-white/85 group-hover:text-white">
          {row.headline}
        </div>
      </div>
      {row.date ? (
        <span className="hidden whitespace-nowrap font-mono text-[10.5px] text-white/45 sm:inline">
          {row.date}
        </span>
      ) : null}
      {row.link ? (
        <a
          href={row.link}
          target="_blank"
          rel="noreferrer"
          title={`Open source: ${row.source || row.link}`}
          className="focus-ring inline-flex items-center gap-1 rounded-md border border-white/[0.07] bg-white/[0.02] px-1.5 py-1 text-[10.5px] text-white/55 transition hover:border-white/[0.16] hover:text-white"
        >
          <ExternalLink size={10} />
          <span className="max-w-[90px] truncate">{row.source || "source"}</span>
        </a>
      ) : row.source ? (
        <span className="inline-flex items-center gap-1 rounded-md border border-white/[0.07] bg-white/[0.02] px-1.5 py-1 text-[10.5px] text-white/55">
          <span className="max-w-[90px] truncate">{row.source}</span>
        </span>
      ) : null}
    </div>
  );
}
