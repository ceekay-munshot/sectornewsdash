import type {
  NewsItem,
  Sentiment,
  SectorAggregate,
  SectorMeta,
  Theme,
  Urgency,
  SourceType,
  TimeHorizon,
} from "../types";
import { SECTORS, SECTOR_BY_ID } from "../data/sectors";
import { clamp } from "./utils";

const SENT_TO_SCORE: Record<Sentiment, number> = {
  Bullish: 1,
  Neutral: 0,
  Bearish: -1,
};

const URGENCY_WEIGHT: Record<Urgency, number> = {
  Critical: 1.0,
  High: 0.75,
  Medium: 0.5,
  Low: 0.25,
};

// Recency in [0,1]: 1 if <= 1h, decays smoothly to ~0.05 by 7 days.
export function recencyWeight(iso: string, now: number = Date.now()): number {
  const ageH = Math.max(0, (now - new Date(iso).getTime()) / 3_600_000);
  if (ageH <= 1) return 1;
  if (ageH <= 6) return 0.92;
  if (ageH <= 24) return 0.78;
  if (ageH <= 72) return 0.55;
  if (ageH <= 168) return 0.3;
  return 0.1;
}

/**
 * calculateSectorHeatScore
 * Composite of: average impact, recency, urgency, source confidence,
 * sentiment magnitude, and news volume — capped to 0..100.
 */
export function calculateSectorHeatScore(news: NewsItem[]): number {
  if (!news.length) return 0;

  const now = Date.now();
  let acc = 0;
  let totalWeight = 0;

  for (const n of news) {
    const r = recencyWeight(n.publishedAt, now);
    const u = URGENCY_WEIGHT[n.urgency];
    const conf = clamp(n.sourceConfidence, 0, 100) / 100;
    const sentMag = Math.abs(SENT_TO_SCORE[n.sentiment]); // strength
    // weight per item leans on urgency*recency
    const w = 0.6 + 0.4 * (r * u);
    const itemScore =
      n.impactScore * 8 + // 0..80
      r * 10 + // 0..10
      u * 6 + // 0..6
      conf * 4 + // 0..4
      sentMag * 2; // 0..2
    acc += itemScore * w;
    totalWeight += w;
  }

  const avg = acc / totalWeight; // ~0..100
  // Volume boost — diminishing returns past ~25 items.
  const volBoost = Math.min(8, Math.log2(1 + news.length) * 1.4);
  return Math.round(clamp(avg * 0.92 + volBoost, 0, 100));
}

/**
 * calculateSectorSentiment
 * Returns label + signed score (-100..100) weighted by impact + recency + confidence.
 */
export function calculateSectorSentiment(news: NewsItem[]): {
  label: Sentiment;
  score: number;
} {
  if (!news.length) return { label: "Neutral", score: 0 };

  const now = Date.now();
  let weighted = 0;
  let totalW = 0;
  for (const n of news) {
    const r = recencyWeight(n.publishedAt, now);
    const w = (n.impactScore / 10) * (0.5 + 0.5 * r) * (n.sourceConfidence / 100);
    weighted += SENT_TO_SCORE[n.sentiment] * w;
    totalW += w;
  }
  const score = totalW ? Math.round((weighted / totalW) * 100) : 0;
  const label: Sentiment =
    score > 12 ? "Bullish" : score < -12 ? "Bearish" : "Neutral";
  return { label, score };
}

/**
 * rankNewsByImpact
 * Highest impact + recency + urgency first.
 */
export function rankNewsByImpact(news: NewsItem[]): NewsItem[] {
  const now = Date.now();
  return news
    .slice()
    .sort((a, b) => itemRank(b, now) - itemRank(a, now));
}

function itemRank(n: NewsItem, now: number): number {
  const r = recencyWeight(n.publishedAt, now);
  const u = URGENCY_WEIGHT[n.urgency];
  return (
    n.impactScore * 10 +
    u * 6 +
    r * 5 +
    (n.sourceConfidence / 100) * 3 +
    Math.abs(SENT_TO_SCORE[n.sentiment]) * 1.5
  );
}

export interface FilterState {
  query?: string;
  sectorId?: string | null;
  sentiment?: Sentiment | null;
  minImpact?: number;
  urgency?: Urgency | null;
  sourceType?: SourceType | null;
  timeHorizon?: TimeHorizon | null;
  theme?: Theme | null;
}

/** filterNews — composes all filters; case-insensitive search across multiple fields. */
export function filterNews(news: NewsItem[], f: FilterState): NewsItem[] {
  const q = (f.query || "").trim().toLowerCase();
  return news.filter((n) => {
    if (f.sectorId && n.sector !== f.sectorId) return false;
    if (f.sentiment && n.sentiment !== f.sentiment) return false;
    if (typeof f.minImpact === "number" && n.impactScore < f.minImpact) return false;
    if (f.urgency && n.urgency !== f.urgency) return false;
    if (f.sourceType && n.sourceType !== f.sourceType) return false;
    if (f.timeHorizon && n.timeHorizon !== f.timeHorizon) return false;
    if (f.theme && n.theme !== f.theme) return false;
    if (q) {
      const sec = SECTOR_BY_ID[n.sector];
      const hay =
        n.headline +
        " " +
        n.summary +
        " " +
        n.theme +
        " " +
        n.subsector +
        " " +
        (sec?.name ?? "") +
        " " +
        n.affectedCompanies.join(" ");
      if (!hay.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

/** getSectorThemeColor — central color resolver per sector (hex + rgb tuple). */
export function getSectorThemeColor(sectorId: string): {
  hex: string;
  rgb: string;
} {
  const s = SECTOR_BY_ID[sectorId];
  return s ? { hex: s.accent, rgb: s.accentRgb } : { hex: "#7DD3FC", rgb: "125,211,252" };
}

/** Top themes inside a list of news. */
export function topTheme(news: NewsItem[]): Theme {
  const counts: Record<string, number> = {};
  for (const n of news) counts[n.theme] = (counts[n.theme] || 0) + n.impactScore;
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return ((entries[0]?.[0] ?? "Earnings") as Theme);
}

/** Per-sector aggregate used by Overview. */
export function buildSectorAggregates(
  allNews: NewsItem[]
): SectorAggregate[] {
  const bySector = new Map<string, NewsItem[]>();
  for (const n of allNews) {
    if (!bySector.has(n.sector)) bySector.set(n.sector, []);
    bySector.get(n.sector)!.push(n);
  }
  const out: SectorAggregate[] = [];
  for (const sector of SECTORS) {
    const items = bySector.get(sector.id) ?? [];
    const ranked = rankNewsByImpact(items);
    const heatScore = calculateSectorHeatScore(items);
    const { label, score } = calculateSectorSentiment(items);
    out.push({
      sector,
      heatScore,
      sentiment: label,
      sentimentScore: score,
      newsCount: items.length,
      topTheme: topTheme(items),
      topNews: ranked.slice(0, 5),
    });
  }
  out.sort((a, b) => b.heatScore - a.heatScore);
  return out;
}

export function sectorMetaFor(id: string): SectorMeta | undefined {
  return SECTOR_BY_ID[id];
}
