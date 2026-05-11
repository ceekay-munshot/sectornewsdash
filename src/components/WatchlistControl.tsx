import { useMemo, useState } from "react";
import { Plus, RotateCcw, Search } from "lucide-react";
import type { SectorMeta } from "../types";
import { classNames } from "../lib/utils";

interface Props {
  allSectors: SectorMeta[];
  visibleIds: string[];
  onAdd: (id: string) => void;
  onReset: () => void;
}

export function WatchlistControl({
  allSectors,
  visibleIds,
  onAdd,
  onReset,
}: Props) {
  const [query, setQuery] = useState("");

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allSectors.filter((s) => {
      if (visibleIds.includes(s.id)) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.shortName.toLowerCase().includes(q) ||
        s.subsectors.some((x) => x.toLowerCase().includes(q)) ||
        s.companies.some((x) => x.toLowerCase().includes(q))
      );
    });
  }, [allSectors, visibleIds, query]);

  const [selected, setSelected] = useState<string>("");
  const effectiveSelected =
    selected && available.some((s) => s.id === selected)
      ? selected
      : (available[0]?.id ?? "");

  const canAdd = !!effectiveSelected;
  const canReset = visibleIds.length !== 3 || !visibleIds.every((id, i) =>
    ["auto", "power", "cement"][i] === id
  );

  return (
    <div className="glass flex flex-wrap items-center gap-2 px-3 py-1.5">
      <div className="flex items-center gap-2">
        <div className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-white/50">
          Watchlist
        </div>
        <span className="chip !py-[2px] !text-[10px] tabular-nums">
          <span className="font-mono text-white/90">{visibleIds.length}</span>
          <span className="text-white/40">/ {allSectors.length}</span>
        </span>
        <span className="hidden text-[11px] text-white/40 sm:inline">
          Pinned sectors stay at the top of the overview.
        </span>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <label className="relative flex items-center">
          <Search size={11} className="pointer-events-none absolute left-2 text-white/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter…"
            className="focus-ring w-[150px] rounded-lg border border-white/[0.07] bg-white/[0.025] py-1.5 pl-6 pr-2 text-[12px] text-white/85 placeholder:text-white/35"
          />
        </label>

        <div className="relative">
          <select
            aria-label="Add sector"
            value={effectiveSelected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={!available.length}
            className={classNames(
              "focus-ring appearance-none rounded-lg border bg-white/[0.025] py-1.5 pl-2.5 pr-7 text-[12px] transition",
              available.length
                ? "border-white/[0.07] text-white/85 hover:border-white/[0.14]"
                : "border-white/[0.04] text-white/35"
            )}
          >
            {available.length ? (
              available.map((s) => (
                <option
                  key={s.id}
                  value={s.id}
                  className="bg-ink-900 text-white"
                >
                  {s.name}
                </option>
              ))
            ) : (
              <option value="" className="bg-ink-900 text-white">
                {query ? "No matches" : "All added"}
              </option>
            )}
          </select>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-white/40">
            ▾
          </span>
        </div>

        <button
          onClick={() => {
            if (!canAdd) return;
            onAdd(effectiveSelected);
            setSelected("");
            setQuery("");
          }}
          disabled={!canAdd}
          className={classNames(
            "focus-ring inline-flex h-[30px] items-center gap-1 rounded-lg border px-2.5 text-[12px] font-semibold transition",
            canAdd
              ? "border-accent-sky/30 bg-accent-sky/10 text-accent-sky hover:border-accent-sky/50 hover:bg-accent-sky/15"
              : "border-white/[0.04] bg-white/[0.015] text-white/35"
          )}
          aria-label="Add sector to watchlist"
        >
          <Plus size={12} />
          Add
        </button>

        {canReset && (
          <button
            onClick={onReset}
            className="btn-ghost focus-ring"
            title="Reset watchlist"
          >
            <RotateCcw size={11} />
          </button>
        )}
      </div>
    </div>
  );
}
