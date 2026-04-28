import { ArrowLeft, Flame } from "lucide-react";
import type { NewsItem, SectorAggregate } from "../types";
import { SECTOR_ICONS } from "../lib/icons";
import { SentimentBadge, ThemeChip } from "./Badges";
import { NewsFeed } from "./NewsFeed";
import { MunsSectorSection } from "./MunsSectorSection";

const SECTOR_MUNS_AGENTS: Record<string, string> = {
  banking: "c94633f6-94a4-42ef-96f3-e3c0f4d49a05",
  it: "96df15db-ab01-45df-ae5b-78519accc749",
  pharma: "a9960430-c7b4-4ea7-add7-88997655a599",
  auto: "081d9904-4b68-41b1-9133-dd9f02bb80f0",
  energy: "c3ef8187-b149-44c7-afb1-03ffc87200c3",
  metals: "41377de2-882b-48f0-af3e-ea618cee3141",
  fmcg: "6ede6a22-6967-44a7-b49b-17a0bee42cdc",
  realestate: "bcd1135d-b1ee-40d9-8d00-9153be5595fe",
  telecom: "bafce213-6ff4-458b-8771-e4ce2d0d15e5",
  capgoods: "af4cd893-e9c3-415c-8c3e-1eec517b8dcc",
  power: "7c700143-3d98-45e0-a895-9814b8d59cbd",
  cement: "6a110e9b-9525-4bc8-98a9-deb296e583a8",
  chemicals: "e56d9694-81fb-4915-a4a5-b1ffe2042115",
  healthcare: "05e5cebe-f067-4f54-911a-2352b562dce8",
  media: "ffc935e7-e87f-40b8-89e5-c66c891d81d5",
  retail: "2aa3e28b-81c4-49cd-8a7e-1b198f6ef6a3",
  aviation: "9d111d26-ca9b-410e-9a65-195efbb85e68",
  logistics: "2d50af65-cd51-45a6-a32f-d284ebe131be",
  agri: "fbeea6bf-4066-4014-aaa6-c7fa52977690",
  defence: "3b52dc5d-9427-44c0-b7f1-34193fa365dd",
  renewables: "d7befedf-8bff-43a2-8b7a-e25ef26d0bc2",
  semis: "eba9a222-1178-4793-b09a-3cd19bb6206c",
  ev: "cd4a79c4-7220-422f-b198-e816c69440f5",
  insurance: "0c4cb522-a1ea-43f3-b03e-09bc113d4fe1",
  textiles: "77e2eb1c-d738-417d-a5c5-5b0622bcd3d0",
  hospitality: "84de61bd-b176-4832-bf4e-7784c812ca57",
  infra: "c3ac8b97-2a67-4ed3-96c4-f29cd8ad7dae",
  specchem: "63ff7fc3-b398-420f-b135-6c28678215b4",
  nbfc: "a9445c9d-3841-4fd1-a76a-d243b3c6ef6a",
};

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
      {SECTOR_MUNS_AGENTS[sector.id] ? (
        <MunsSectorSection
          sectorId={sector.id}
          sectorShortName={sector.shortName}
          agentLibraryId={SECTOR_MUNS_AGENTS[sector.id]}
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
