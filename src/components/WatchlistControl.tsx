import { useMemo, useState } from "react";
import { Plus, RotateCcw, Search } from "lucide-react";
import type { SectorMeta } from "../types";
import { SECTOR_ICONS } from "../lib/icons";
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
    <div className="glass flex flex-wrap items-center gap-2 px-3 py-2">
      <div className="flex items-baseline gap-2">
        <div className="label-eyebrow">My sectors</div>
        <span className="font-mono text-[10.5px] num text-white/55">
          <span className="font-semibold text-white/80">
            {visibleIds.length}
          </span>
          <span className="text-white/30"> / {allSectors.length}</span>
        </span>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <label className="relative flex items-center">
          <Search
            size={11}
            className="pointer-events-none absolute left-2 text-white/40"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sectors…"
            className="focus-ring h-[28px] w-[180px] rounded-md border border-white/[0.07] bg-white/[0.025] pl-6 pr-2 text-[12px] text-white/85 placeholder:text-white/35 transition hover:border-white/[0.12] focus:border-accent-sky/40"
          />
        </label>

        <select
          aria-label="Add sector"
          value={effectiveSelected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={!available.length}
          className={classNames(
            "select-clean focus-ring h-[28px] appearance-none rounded-md border bg-white/[0.025] pl-2.5 pr-7 text-[12px] transition",
            available.length
              ? "border-white/[0.07] text-white/80 hover:border-white/[0.16] hover:text-white"
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
                {s.shortName} — {s.name}
              </option>
            ))
          ) : (
            <option value="" className="bg-ink-900 text-white">
              {query ? "No matches" : "All sectors added"}
            </option>
          )}
        </select>

        <button
          onClick={() => {
            if (!canAdd) return;
            onAdd(effectiveSelected);
            setSelected("");
            setQuery("");
          }}
          disabled={!canAdd}
          className={classNames(
            "focus-ring inline-flex h-[28px] items-center gap-1 rounded-md border px-2.5 text-[11.5px] font-semibold transition",
            canAdd
              ? "border-accent-sky/35 bg-accent-sky/10 text-accent-sky hover:border-accent-sky/55 hover:bg-accent-sky/15"
              : "border-white/[0.04] bg-white/[0.015] text-white/35"
          )}
          aria-label="Add sector to watchlist"
          title={
            canAdd
              ? `Add ${available.find((s) => s.id === effectiveSelected)?.shortName}`
              : "Nothing to add"
          }
        >
          <Plus size={12} />
          Add
        </button>

        {canReset && (
          <button
            onClick={onReset}
            className="btn-ghost focus-ring"
            title="Reset to default watchlist"
          >
            <RotateCcw size={11} />
            Reset
          </button>
        )}
      </div>

      {/* Quick-add chips for small screens / scanning */}
      {query && available.length > 0 && (
        <div className="flex w-full flex-wrap gap-1.5 border-t border-white/[0.05] pt-2">
          {available.slice(0, 8).map((s) => {
            const Icon = SECTOR_ICONS[s.iconKey];
            return (
              <button
                key={s.id}
                onClick={() => {
                  onAdd(s.id);
                  setQuery("");
                }}
                className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.025] px-2 py-1 text-[11px] text-white/80 transition hover:border-white/[0.2] hover:bg-white/[0.04] hover:text-white"
              >
                <Icon size={10} style={{ color: s.accent }} strokeWidth={2} />
                {s.shortName}
                <Plus size={10} className="text-white/45" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
