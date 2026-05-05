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
  return (
    <button
      type="button"
      onClick={onSync}
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
