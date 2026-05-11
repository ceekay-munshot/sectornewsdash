import { useEffect, useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { classNames } from "../lib/utils";

interface Props {
  running: boolean;
  done: number;
  total: number;
  completed: boolean;
  startedAt: Date | null;
  lastSyncAt: Date | null;
  onSync: () => void;
}

const SYNC_ACCENT = "rgb(125, 211, 252)"; // accent-sky

export function SyncAllButton({
  running,
  done,
  total,
  completed,
  startedAt,
  lastSyncAt,
  onSync,
}: Props) {
  // Tick once a second while the run is active so elapsed/ETA stay live.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [running]);

  // Also re-render every 30s when idle so "Last synced 4m ago" advances
  // without the user touching anything.
  useEffect(() => {
    if (running) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, [running]);

  if (running) {
    const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
    const elapsedSec = startedAt
      ? Math.max(0, (Date.now() - startedAt.getTime()) / 1000)
      : 0;
    // Hold off ETA until we have at least one completion — the first
    // sector's time is the only signal we have to project the rest.
    const etaSec =
      done > 0 && total > done
        ? Math.max(0, (elapsedSec / done) * (total - done))
        : null;

    return (
      <div
        className="relative w-[210px] overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.025] px-2.5 py-1.5"
        role="status"
        aria-live="polite"
        aria-label={`Syncing ${done} of ${total} sectors`}
      >
        <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-white/85">
          <RefreshCw size={11} className="animate-spin text-accent-sky" />
          <span>
            Syncing{" "}
            <span className="font-mono tabular-nums">
              {done}/{total}
            </span>
          </span>
          <span className="ml-auto font-mono text-[10.5px] tabular-nums text-white/55">
            {etaSec !== null
              ? `~${formatShortDuration(etaSec)} left`
              : formatShortDuration(elapsedSec)}
          </span>
        </div>
        <div
          className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]"
          // Track tick so the bar repaints even if progress stalls briefly
          data-tick={tick}
        >
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${SYNC_ACCENT}88, ${SYNC_ACCENT})`,
            }}
          />
        </div>
      </div>
    );
  }

  const subLabel = completed
    ? "Just now"
    : lastSyncAt
      ? `Synced ${formatRelative(lastSyncAt)}`
      : "Never synced";

  return (
    <button
      type="button"
      onClick={onSync}
      className={classNames(
        "focus-ring group inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.025] px-2.5 py-1.5 text-left transition hover:border-white/[0.16] hover:bg-white/[0.05]",
        completed && "border-emerald-400/30 bg-emerald-400/5"
      )}
      title={
        lastSyncAt
          ? `Last synced ${lastSyncAt.toLocaleString()}`
          : "Refresh news for every sector"
      }
    >
      {completed ? (
        <Check size={12} className="text-emerald-300" />
      ) : (
        <RefreshCw
          size={12}
          className="text-white/75 transition group-hover:text-white"
        />
      )}
      <div className="flex flex-col leading-tight">
        <span className="text-[11.5px] font-medium text-white/85">
          {completed ? "Synced" : "Sync all"}
        </span>
        <span
          className={classNames(
            "text-[9.5px] uppercase tracking-[0.14em]",
            completed ? "text-emerald-300/80" : "text-white/40"
          )}
        >
          {subLabel}
        </span>
      </div>
    </button>
  );
}

/** "45s" / "6m" / "1h 12m" — compact for the header chip. */
function formatShortDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 1) return "0s";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const totalMin = Math.round(seconds / 60);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Human-relative timestamp tailored for "Synced X" sub-labels. */
function formatRelative(d: Date): string {
  const diff = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (diff < 15) return "just now";
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
