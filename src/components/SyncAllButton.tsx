import { Check, RefreshCw } from "lucide-react";

interface Props {
  running: boolean;
  done: number;
  total: number;
  completed: boolean;
  onSync: () => void;
}

export function SyncAllButton({
  running,
  done,
  total,
  completed,
  onSync,
}: Props) {
  const pct = running && total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <button
      type="button"
      onClick={onSync}
      disabled={running}
      className="relative overflow-hidden btn-ghost focus-ring disabled:cursor-not-allowed"
      title="Refresh news for every sector"
    >
      {completed ? (
        <Check size={11} className="text-emerald-300" />
      ) : (
        <RefreshCw size={11} className={running ? "animate-spin" : ""} />
      )}
      <span className="hidden sm:inline">
        {running ? (
          <span className="num">
            Syncing <span className="text-white/55">{done}</span>
            <span className="text-white/35">/{total}</span>
          </span>
        ) : completed ? (
          "Synced"
        ) : (
          "Sync all"
        )}
      </span>
      {running && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[1.5px] bg-gradient-to-r from-accent-sky/70 via-accent-violet/70 to-accent-mint/70 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      )}
    </button>
  );
}
