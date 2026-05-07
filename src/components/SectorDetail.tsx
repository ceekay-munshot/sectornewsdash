import { ArrowLeft, Flame } from "lucide-react";
import type { NewsItem, SectorAggregate } from "../types";
import { SECTOR_ICONS } from "../lib/icons";
import { SECTOR_AGENTS } from "../lib/agentConfig";
import { heatToColor } from "../lib/utils";
import { SentimentBadge, ThemeChip } from "./Badges";
import { NewsFeed } from "./NewsFeed";
import { MunsSectorSection } from "./MunsSectorSection";

interface Props {
  aggregate: SectorAggregate;
  sectorNews: NewsItem[]; // already ranked + filtered
  onBack: () => void;
  onSelectNews: (n: NewsItem) => void;
  selectedNewsId?: string | null;
  isLive: boolean;
  lastRunAt: Date | null;
  onMunsLoaded: (sectorId: string, items: NewsItem[], at: Date) => void;
}

const NEWS_LIMIT = 20;

export function SectorDetail({
  aggregate,
  sectorNews,
  onBack,
  onSelectNews,
  selectedNewsId,
  isLive,
  lastRunAt,
  onMunsLoaded,
}: Props) {
  const sector = aggregate.sector;
  const Icon = SECTOR_ICONS[sector.iconKey];
  const accent = sector.accent;
  const accentRgb = sector.accentRgb;
  const heat = Math.max(0, Math.min(100, aggregate.heatScore));
  const heatHex = heatToColor(heat).hex;
  const empty = aggregate.newsCount === 0;

  return (
    <div className="animate-floatIn space-y-4">
      {/* Sector banner */}
      <div className="glass relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background: `radial-gradient(800px 200px at 0% 0%, rgba(${accentRgb},0.16), transparent 60%), radial-gradient(640px 200px at 100% 100%, rgba(${accentRgb},0.07), transparent 60%)`,
          }}
        />
        <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <button onClick={onBack} className="btn-ghost focus-ring self-start">
            <ArrowLeft size={11} />
            Overview
          </button>

          <div className="flex flex-1 items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl ring-1 ring-white/10"
              style={{
                background: `linear-gradient(135deg, rgba(${accentRgb},0.32), rgba(${accentRgb},0.08))`,
                color: accent,
              }}
            >
              <Icon size={22} strokeWidth={1.75} />
            </div>
            <div className="leading-tight">
              <div className="flex items-baseline gap-2">
                <div className="font-display text-[18px] font-semibold tracking-tightish text-white">
                  {sector.name}
                </div>
                <span className="font-mono text-[10.5px] num uppercase tracking-wider text-white/35">
                  {sector.shortName}
                </span>
              </div>
              <div className="mt-0.5 line-clamp-1 text-[11.5px] text-white/55">
                {sector.subsectors.join(" · ")}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 items-end gap-3 sm:max-w-[480px] sm:flex-1">
            <BannerStat
              label="Heat"
              value={empty ? "—" : heat}
              accent={empty ? "rgba(255,255,255,0.4)" : heatHex}
              icon={<Flame size={10} />}
              footer={
                <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${empty ? 0 : heat}%`,
                      background: empty ? "transparent" : heatHex,
                    }}
                  />
                </div>
              }
            />
            <BannerStat
              label="News"
              value={aggregate.newsCount}
              accent={accent}
            />
            <div className="flex flex-col">
              <div className="label-eyebrow">Sentiment</div>
              <div className="mt-1.5">
                {!empty ? (
                  <SentimentBadge sentiment={aggregate.sentiment} size="sm" />
                ) : (
                  <span className="text-[12px] text-white/35">—</span>
                )}
              </div>
            </div>
            <div className="flex min-w-0 flex-col">
              <div className="label-eyebrow">Top theme</div>
              <div className="mt-1.5">
                {!empty ? (
                  <ThemeChip>{aggregate.topTheme}</ThemeChip>
                ) : (
                  <span className="text-[12px] text-white/35">—</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Companies + KPIs strip */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <SectorMeta label="Key companies" items={sector.companies} />
        <SectorMeta label="KPIs to watch" items={sector.kpis} />
      </div>

      {/* News list */}
      {SECTOR_AGENTS[sector.id] ? (
        <MunsSectorSection
          sectorId={sector.id}
          sectorShortName={sector.shortName}
          agentLibraryId={SECTOR_AGENTS[sector.id]}
          items={sectorNews}
          isLive={isLive}
          lastRunAt={lastRunAt}
          onLoaded={(items, at) => onMunsLoaded(sector.id, items, at)}
          onSelectNews={onSelectNews}
          selectedNewsId={selectedNewsId}
        />
      ) : (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between px-1">
            <div className="flex items-baseline gap-2">
              <div className="label-eyebrow">Material news</div>
              <span className="text-[10.5px] text-white/55 num">
                <span className="font-semibold text-white/85">
                  {Math.min(sectorNews.length, NEWS_LIMIT)}
                </span>
                <span className="text-white/30"> / {sectorNews.length}</span>
              </span>
            </div>
            <div className="font-mono text-[10px] num text-white/35">
              ranked by impact · recency · urgency
            </div>
          </div>
          <NewsFeed
            items={sectorNews}
            limit={NEWS_LIMIT}
            onSelect={onSelectNews}
            selectedId={selectedNewsId}
            emptyTitle={`No news yet for ${sector.shortName}`}
            emptyHint="No items match the current filters."
          />
        </div>
      )}
    </div>
  );
}

function BannerStat({
  label,
  value,
  accent,
  icon,
  footer,
}: {
  label: string;
  value: number | string;
  accent: string;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 label-eyebrow">
        {icon}
        {label}
      </div>
      <div
        className="mt-1 font-display text-[20px] font-semibold leading-none tracking-tightish num"
        style={{ color: accent }}
      >
        {value}
      </div>
      {footer}
    </div>
  );
}

function SectorMeta({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="glass p-3">
      <div className="label-eyebrow">{label}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((c) => (
          <span key={c} className="chip">
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}
