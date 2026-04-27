import { Search, SlidersHorizontal, X } from "lucide-react";
import { useId } from "react";
import type {
  Sentiment,
  SourceType,
  Theme,
  TimeHorizon,
  Urgency,
} from "../types";
import type { FilterState } from "../lib/logic";
import { SECTORS } from "../data/sectors";
import { classNames } from "../lib/utils";

interface Props {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  onClear: () => void;
  resultCount: number;
}

const SENTIMENTS: Sentiment[] = ["Bullish", "Neutral", "Bearish"];
const URGENCIES: Urgency[] = ["Critical", "High", "Medium", "Low"];
const SOURCE_TYPES: SourceType[] = [
  "Regulator",
  "Exchange",
  "Newswire",
  "Company Filing",
  "Brokerage",
  "Tier-1 Media",
  "Trade Publication",
  "Government",
  "Industry Body",
  "Social",
];
const HORIZONS: TimeHorizon[] = [
  "Immediate",
  "Short-term",
  "Medium-term",
  "Long-term",
];
const THEMES: Theme[] = [
  "Policy",
  "Regulation",
  "Earnings",
  "Demand",
  "Pricing",
  "Raw Materials",
  "Capex",
  "Exports",
  "Imports",
  "Order Wins",
  "M&A",
  "Supply Chain",
  "Litigation",
  "Global Macro",
];
const IMPACT_OPTIONS = [0, 3, 5, 7, 9];

export function FilterBar({ filters, onChange, onClear, resultCount }: Props) {
  const inputId = useId();
  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    onChange({ ...filters, [key]: value });

  const isDirty =
    !!filters.query ||
    !!filters.sectorId ||
    !!filters.sentiment ||
    !!filters.urgency ||
    !!filters.sourceType ||
    !!filters.timeHorizon ||
    !!filters.theme ||
    (typeof filters.minImpact === "number" && filters.minImpact > 0);

  return (
    <div className="sticky top-[57px] z-20 border-b border-white/[0.05] bg-ink-950/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2 px-5 py-2.5">
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
            placeholder="Search sector, company, theme, keyword…"
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
          label="Sentiment"
          value={filters.sentiment || ""}
          onChange={(v) => set("sentiment", (v || null) as Sentiment | null)}
          options={[
            { value: "", label: "Any sentiment" },
            ...SENTIMENTS.map((s) => ({ value: s, label: s })),
          ]}
        />
        <Select
          label="Impact"
          value={String(filters.minImpact ?? 0)}
          onChange={(v) => set("minImpact", Number(v))}
          options={IMPACT_OPTIONS.map((n) => ({
            value: String(n),
            label: n === 0 ? "Any impact" : `≥ ${n}`,
          }))}
        />
        <Select
          label="Urgency"
          value={filters.urgency || ""}
          onChange={(v) => set("urgency", (v || null) as Urgency | null)}
          options={[
            { value: "", label: "Any urgency" },
            ...URGENCIES.map((u) => ({ value: u, label: u })),
          ]}
        />
        <Select
          label="Source"
          value={filters.sourceType || ""}
          onChange={(v) => set("sourceType", (v || null) as SourceType | null)}
          options={[
            { value: "", label: "Any source" },
            ...SOURCE_TYPES.map((s) => ({ value: s, label: s })),
          ]}
        />
        <Select
          label="Horizon"
          value={filters.timeHorizon || ""}
          onChange={(v) => set("timeHorizon", (v || null) as TimeHorizon | null)}
          options={[
            { value: "", label: "Any horizon" },
            ...HORIZONS.map((h) => ({ value: h, label: h })),
          ]}
        />
        <Select
          label="Theme"
          value={filters.theme || ""}
          onChange={(v) => set("theme", (v || null) as Theme | null)}
          options={[
            { value: "", label: "Any theme" },
            ...THEMES.map((t) => ({ value: t, label: t })),
          ]}
        />

        <div className="ml-auto flex items-center gap-2">
          <span
            className={classNames(
              "chip",
              isDirty && "border-accent-sky/30 text-accent-sky"
            )}
          >
            <SlidersHorizontal size={11} />
            {resultCount} match{resultCount === 1 ? "" : "es"}
          </span>
          {isDirty && (
            <button onClick={onClear} className="btn-ghost focus-ring">
              <X size={12} />
              Clear
            </button>
          )}
        </div>
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
