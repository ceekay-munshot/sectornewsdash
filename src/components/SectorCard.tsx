import { ArrowRight, Flame } from "lucide-react";
import type { SectorAggregate, NewsItem } from "../types";
import { SECTOR_ICONS } from "../lib/icons";
import { SentimentBadge, ThemeChip } from "./Badges";
import { NewsHeadlineRow } from "./NewsHeadlineRow";

interface Props {
  agg: SectorAggregate;
  onOpenSector: (sectorId: string) => void;
  onSelectNews: (n: NewsItem) => void;
}

export function SectorCard({ agg, onOpenSector, onSelectNews }: Props) {
  const Icon = SECTOR_ICONS[agg.sector.iconKey];
  const accent = agg.sector.accent;
  const accentRgb = agg.sector.accentRgb;
  const heat = Math.max(0, Math.min(100, agg.heatScore));

  return (
    <div className="glass group relative flex flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent 0%, rgba(${accentRgb},0.85) 50%, transparent 100%)`,
        }}
      />
      <div
        className="pointer-events-none absolute -top-16 right-[-30px] h-32 w-32 rounded-full opacity-50 blur-3xl"
        style={{ background: `rgba(${accentRgb}, 0.18)` }}
      />

      {/* Header */}
      <button
        onClick={() => onOpenSector(agg.sector.id)}
        className="focus-ring relative flex items-center gap-3 px-3.5 py-3 text-left transition hover:bg-white/[0.02]"
      >
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-white/10"
          style={{
            background: `linear-gradient(135deg, rgba(${accentRgb},0.32), rgba(${accentRgb},0.08))`,
            color: accent,
          }}
        >
          <Icon size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-[13.5px] font-semibold text-white">
              {agg.sector.name}
            </div>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-white/45">
            <span className="font-mono">{agg.sector.shortName}</span>
            <span>·</span>
            <span>{agg.newsCount} news</span>
            {agg.newsCount > 0 && (
              <>
                <span>·</span>
                <span>top theme: {agg.topTheme}</span>
              </>
            )}
          </div>
        </div>
        <ArrowRight
          size={14}
          className="text-white/35 transition group-hover:translate-x-0.5 group-hover:text-white/70"
        />
      </button>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 border-t border-white/[0.05] bg-white/[0.012] px-3.5 py-2.5">
        <Stat
          label="Heat"
          value={heat || "—"}
          accent={accent}
          icon={<Flame size={10} />}
        />
        <div className="flex flex-col">
          <div className="text-[9.5px] uppercase tracking-[0.16em] text-white/40">
            Sentiment
          </div>
          <div className="mt-1">
            {agg.newsCount === 0 ? (
              <span className="text-[12px] text-white/40">—</span>
            ) : (
              <SentimentBadge sentiment={agg.sentiment} size="sm" />
            )}
          </div>
        </div>
        <div className="flex flex-col">
          <div className="text-[9.5px] uppercase tracking-[0.16em] text-white/40">
            Top theme
          </div>
          <div className="mt-1">
            {agg.newsCount === 0 ? (
              <span className="text-[12px] text-white/40">—</span>
            ) : (
              <ThemeChip>{agg.topTheme}</ThemeChip>
            )}
          </div>
        </div>
      </div>

      {/* Top 5 headlines */}
      <div className="flex flex-1 flex-col p-1.5">
        {agg.topNews.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-3 py-6 text-center">
            <div>
              <div className="text-[11px] text-white/45">
                Awaiting feed for {agg.sector.shortName}
              </div>
              <div className="mt-0.5 text-[10.5px] text-white/30">
                Headlines will surface here as they arrive.
              </div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {agg.topNews.map((n) => (
              <NewsHeadlineRow
                key={n.id}
                item={n}
                onSelect={onSelectNews}
                showTime={false}
              />
            ))}
          </div>
        )}
      </div>

      {agg.newsCount > 5 && (
        <button
          onClick={() => onOpenSector(agg.sector.id)}
          className="focus-ring border-t border-white/[0.05] px-3.5 py-2 text-left text-[11px] text-white/55 transition hover:bg-white/[0.03] hover:text-white"
        >
          View all {agg.newsCount} headlines →
        </button>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: number | string;
  accent: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 text-[9.5px] uppercase tracking-[0.16em] text-white/40">
        {icon}
        {label}
      </div>
      <div
        className="mt-1 font-mono text-[14px] font-semibold leading-none"
        style={{ color: accent }}
      >
        {value}
      </div>
    </div>
  );
}
