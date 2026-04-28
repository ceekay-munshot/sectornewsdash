import { ArrowLeft, Flame } from "lucide-react";
import type { NewsItem, SectorAggregate } from "../types";
import { SECTOR_ICONS } from "../lib/icons";
import { SentimentBadge, ThemeChip } from "./Badges";
import { NewsFeed } from "./NewsFeed";
import { MunsAutoSection } from "./MunsAutoSection";

interface Props {
  aggregate: SectorAggregate;
  sectorNews: NewsItem[]; // already ranked + filtered
  onBack: () => void;
  onSelectNews: (n: NewsItem) => void;
  selectedNewsId?: string | null;
}

const NEWS_LIMIT = 20;

export function SectorDetail({
  aggregate,
  sectorNews,
  onBack,
  onSelectNews,
  selectedNewsId,
}: Props) {
  const sector = aggregate.sector;
  const Icon = SECTOR_ICONS[sector.iconKey];
  const accent = sector.accent;
  const accentRgb = sector.accentRgb;

  return (
    <div className="animate-floatIn space-y-4">
      {/* Sector banner */}
      <div className="glass relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background: `radial-gradient(900px 200px at 0% 0%, rgba(${accentRgb},0.18), transparent 60%), radial-gradient(700px 200px at 100% 100%, rgba(${accentRgb},0.08), transparent 60%)`,
          }}
        />
        <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <button onClick={onBack} className="btn-ghost focus-ring">
            <ArrowLeft size={12} />
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
              <Icon size={22} />
            </div>
            <div className="leading-tight">
              <div className="font-display text-[18px] font-semibold text-white">
                {sector.name}
              </div>
              <div className="mt-0.5 text-[11.5px] text-white/55">
                {sector.subsectors.join(" · ")}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 sm:max-w-[460px] sm:flex-1">
            <BannerStat
              label="Heat"
              value={aggregate.heatScore || "—"}
              accent={accent}
              icon={<Flame size={11} />}
            />
            <BannerStat
              label="News"
              value={aggregate.newsCount}
              accent={accent}
            />
            <div className="flex flex-col">
              <div className="text-[9.5px] uppercase tracking-[0.16em] text-white/40">
                Sentiment
              </div>
              <div className="mt-1.5">
                {aggregate.newsCount > 0 ? (
                  <SentimentBadge sentiment={aggregate.sentiment} size="sm" />
                ) : (
                  <span className="text-[12px] text-white/40">—</span>
                )}
              </div>
            </div>
            <div className="flex flex-col">
              <div className="text-[9.5px] uppercase tracking-[0.16em] text-white/40">
                Top theme
              </div>
              <div className="mt-1.5">
                {aggregate.newsCount > 0 ? (
                  <ThemeChip>{aggregate.topTheme}</ThemeChip>
                ) : (
                  <span className="text-[12px] text-white/40">—</span>
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
      {sector.id === "auto" ? (
        <MunsAutoSection
          fallbackNews={sectorNews}
          onSelectNews={onSelectNews}
          selectedNewsId={selectedNewsId}
        />
      ) : (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between px-1">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
              Material news ·{" "}
              <span className="text-white/70">
                {Math.min(sectorNews.length, NEWS_LIMIT)} of {sectorNews.length}
              </span>
            </div>
            <div className="text-[10.5px] text-white/35">
              ranked by impact · recency · urgency
            </div>
          </div>
          <NewsFeed
            items={sectorNews}
            limit={NEWS_LIMIT}
            onSelect={onSelectNews}
            selectedId={selectedNewsId}
            emptyTitle={`No news yet for ${sector.shortName}`}
            emptyHint="Connect your AI Agent feed or seed mock items in src/data/mockNews.ts."
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
        className="mt-1 font-mono text-[18px] font-semibold leading-none"
        style={{ color: accent }}
      >
        {value}
      </div>
    </div>
  );
}

function SectorMeta({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="glass p-3">
      <div className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-white/45">
        {label}
      </div>
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
