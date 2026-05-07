import { ArrowRight, Flame, X } from "lucide-react";
import type { SectorAggregate, NewsItem } from "../types";
import { SECTOR_ICONS } from "../lib/icons";
import { heatToColor } from "../lib/utils";
import { SentimentBadge, ThemeChip } from "./Badges";
import { NewsHeadlineRow } from "./NewsHeadlineRow";

interface Props {
  agg: SectorAggregate;
  onOpenSector: (sectorId: string) => void;
  onSelectNews: (n: NewsItem) => void;
  onRemove?: (sectorId: string) => void;
}

export function SectorCard({
  agg,
  onOpenSector,
  onSelectNews,
  onRemove,
}: Props) {
  const Icon = SECTOR_ICONS[agg.sector.iconKey];
  const accent = agg.sector.accent;
  const accentRgb = agg.sector.accentRgb;
  const heat = Math.max(0, Math.min(100, agg.heatScore));
  const heatHex = heatToColor(heat).hex;
  const empty = agg.newsCount === 0;

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
        style={{ background: `rgba(${accentRgb}, 0.16)` }}
      />

      {/* Header */}
      <button
        onClick={() => onOpenSector(agg.sector.id)}
        className="focus-ring relative flex items-center gap-3 px-3.5 pb-2.5 pt-3 text-left transition hover:bg-white/[0.018]"
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-white/10"
          style={{
            background: `linear-gradient(135deg, rgba(${accentRgb},0.32), rgba(${accentRgb},0.08))`,
            color: accent,
          }}
        >
          <Icon size={16} strokeWidth={1.85} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-[13.5px] font-semibold tracking-tightish text-white">
              {agg.sector.name}
            </div>
            <span className="font-mono text-[10px] num uppercase tracking-wider text-white/35">
              {agg.sector.shortName}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-white/45">
            <span className="num">
              <span className="font-semibold text-white/70">
                {agg.newsCount}
              </span>{" "}
              {agg.newsCount === 1 ? "item" : "items"}
            </span>
            {agg.newsCount > 0 && (
              <>
                <span className="text-white/20">·</span>
                <span className="truncate">{agg.topTheme}</span>
              </>
            )}
          </div>
        </div>
        <ArrowRight
          size={14}
          className="text-white/30 transition group-hover:translate-x-0.5 group-hover:text-white/75"
        />
      </button>

      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(agg.sector.id);
          }}
          aria-label={`Remove ${agg.sector.shortName} from watchlist`}
          title="Remove from watchlist"
          className="focus-ring absolute right-2 top-2 z-10 inline-flex h-5 w-5 items-center justify-center rounded-md border border-white/[0.06] bg-ink-900/60 text-white/45 opacity-0 backdrop-blur transition hover:border-rose-400/40 hover:bg-rose-400/10 hover:text-rose-300 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <X size={11} />
        </button>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 items-end gap-3 border-t border-white/[0.04] bg-white/[0.012] px-3.5 py-2.5">
        <div className="flex flex-col">
          <div className="flex items-center gap-1 label-eyebrow">
            <Flame size={9} />
            Heat
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <div
              className="font-mono text-[15px] font-semibold leading-none num"
              style={{ color: empty ? "rgba(255,255,255,0.35)" : heatHex }}
            >
              {empty ? "—" : heat}
            </div>
            {!empty && (
              <span className="text-[10px] text-white/30 num">/100</span>
            )}
          </div>
          <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-white/[0.05]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${empty ? 0 : heat}%`,
                background: empty ? "transparent" : heatHex,
              }}
            />
          </div>
        </div>
        <div className="flex flex-col">
          <div className="label-eyebrow">Sentiment</div>
          <div className="mt-1.5">
            {empty ? (
              <span className="text-[12px] text-white/35">—</span>
            ) : (
              <SentimentBadge sentiment={agg.sentiment} size="sm" />
            )}
          </div>
        </div>
        <div className="flex min-w-0 flex-col">
          <div className="label-eyebrow">Top theme</div>
          <div className="mt-1.5">
            {empty ? (
              <span className="text-[12px] text-white/35">—</span>
            ) : (
              <ThemeChip>{agg.topTheme}</ThemeChip>
            )}
          </div>
        </div>
      </div>

      {/* Top 5 headlines */}
      <div className="flex flex-1 flex-col p-1">
        {agg.topNews.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-3 py-8 text-center">
            <div>
              <div className="text-[11px] text-white/45">
                Awaiting feed for {agg.sector.shortName}
              </div>
              <div className="mt-0.5 text-[10.5px] text-white/30">
                Headlines surface here as they arrive
              </div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.035]">
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
          className="focus-ring group/footer flex items-center justify-between border-t border-white/[0.05] px-3.5 py-2 text-[11px] text-white/55 transition hover:bg-white/[0.025] hover:text-white"
        >
          <span>
            View all <span className="font-semibold num">{agg.newsCount}</span>{" "}
            headlines
          </span>
          <ArrowRight
            size={11}
            className="text-white/30 transition group-hover/footer:translate-x-0.5 group-hover/footer:text-white/70"
          />
        </button>
      )}
    </div>
  );
}
