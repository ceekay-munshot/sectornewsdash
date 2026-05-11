import { Search, X } from "lucide-react";
import { useId } from "react";
import type { TimeHorizon } from "../types";
import type { FilterState } from "../lib/logic";
import { SECTORS } from "../data/sectors";
import { classNames } from "../lib/utils";

interface Props {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  onClear: () => void;
}

const HORIZONS: TimeHorizon[] = [
  "Immediate",
  "Short-term",
  "Medium-term",
  "Long-term",
];

export function FilterBar({ filters, onChange, onClear }: Props) {
  const inputId = useId();
  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    onChange({ ...filters, [key]: value });

  const isDirty =
    !!filters.query || !!filters.sectorId || !!filters.timeHorizon;

  return (
    <div className="sticky top-[49px] z-20 border-b border-white/[0.05] bg-ink-950/75 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1760px] flex-wrap items-center gap-2 px-4 py-2 2xl:px-6">
        <label
          htmlFor={inputId}
          className="relative flex min-w-[220px] flex-1 items-center"
        >
          <Search
            size={13}
            className="pointer-events-none absolute left-2.5 text-white/40"
          />
          <input
            id={inputId}
            value={filters.query || ""}
            onChange={(e) => set("query", e.target.value)}
            placeholder="Search…"
            className="focus-ring w-full rounded-lg border border-white/[0.07] bg-white/[0.025] py-1.5 pl-7 pr-2.5 text-[12px] text-white/85 placeholder:text-white/35"
          />
        </label>

        <Select
          label="Sector"
          value={filters.sectorId || ""}
          onChange={(v) => set("sectorId", v || null)}
          options={[
            { value: "", label: "All sectors" },
            ...SECTORS.map((s) => ({ value: s.id, label: s.shortName })),
          ]}
        />
        <Select
          label="Time horizon"
          value={filters.timeHorizon || ""}
          onChange={(v) => set("timeHorizon", (v || null) as TimeHorizon | null)}
          options={[
            { value: "", label: "Any horizon" },
            ...HORIZONS.map((h) => ({ value: h, label: h })),
          ]}
        />

        {isDirty && (
          <button onClick={onClear} className="btn-ghost focus-ring ml-auto">
            <X size={12} />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

interface SelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

function Select({ label, value, onChange, options }: SelectProps) {
  const active = value !== "" && value !== "0";
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={classNames(
          "focus-ring appearance-none rounded-lg border bg-white/[0.025] py-1.5 pl-2.5 pr-7 text-[12px] text-white/85 transition",
          active
            ? "border-accent-sky/30 text-accent-sky"
            : "border-white/[0.07] hover:border-white/[0.14]"
        )}
      >
        {options.map((o) => (
          <option
            key={o.value}
            value={o.value}
            className="bg-ink-900 text-white"
          >
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-white/40">
        ▾
      </span>
    </div>
  );
}
