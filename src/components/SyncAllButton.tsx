import { useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { SECTOR_AGENTS } from "../lib/agentConfig";
import { runSectorAgent, runWithConcurrency } from "../lib/runAgent";
import type { NewsItem } from "../types";

interface Props {
  onSectorLoaded: (sectorId: string, items: NewsItem[], at: Date) => void;
}

// Sequential concurrency for the bulk run. 5 agents at a time keeps total
// wall-clock time to ~3 minutes for 29 sectors without hammering the API.
const CONCURRENCY = 5;

export function SyncAllButton({ onSectorLoaded }: Props) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [completed, setCompleted] = useState(false);

  const handleSync = async () => {
    const entries = Object.entries(SECTOR_AGENTS);
    setRunning(true);
    setCompleted(false);
    setDone(0);
    setTotal(entries.length);

    await runWithConcurrency(entries, CONCURRENCY, async ([sectorId, agentId]) => {
      try {
        const items = await runSectorAgent(sectorId, agentId);
        onSectorLoaded(sectorId, items, new Date());
      } catch {
        // swallow individual failures so one bad agent doesn't kill the run
      } finally {
        setDone((d) => d + 1);
      }
    });

    setRunning(false);
    setCompleted(true);
    window.setTimeout(() => setCompleted(false), 4000);
  };

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={running}
      className="btn-ghost"
      title="Refresh news for every sector"
    >
      {completed ? (
        <Check size={11} className="text-emerald-300" />
      ) : (
        <RefreshCw size={11} className={running ? "animate-spin" : ""} />
      )}
      <span className="hidden sm:inline">
        {running
          ? `Syncing ${done}/${total}`
          : completed
            ? "Synced"
            : "Sync all"}
      </span>
    </button>
  );
}
