import type { NewsItem } from "../types";

/**
 * Mock news feed — populated later (per-sector, ~20+ items each, or by your
 * AI Agent JSON). The dashboard handles an empty array gracefully and lights
 * up sector cards / heatmap / detail / insight panel as soon as items appear.
 *
 * Each item must conform to the `NewsItem` type in `src/types.ts`:
 *
 *   {
 *     id, headline, summary, sector, subsector, theme, sentiment,
 *     impactScore, urgency, source, sourceType, sourceConfidence,
 *     publishedAt, affectedCompanies, kpiAffected, timeHorizon,
 *     whyItMatters, bullCase, bearCase, relatedCatalyst, newsUrl
 *   }
 *
 * `sector` is the sector `id` from `src/data/sectors.ts` (e.g. "auto", "it").
 */

const hoursAgo = (h: number) =>
  new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

export const MOCK_NEWS: NewsItem[] = [
  {
    id: "auto-001",
    headline:
      "Maruti Suzuki Q4 PAT jumps 19% YoY; raises FY26 PV volume guidance to high-single-digit growth",
    summary:
      "Maruti's Q4 net profit beat consensus on richer SUV mix and lower discounting. Management guided FY26 PV industry growth at 7–8% and signalled margin expansion of 60–80 bps as commodity tailwinds and operating leverage play out.",
    sector: "auto",
    subsector: "PV",
    theme: "Earnings",
    sentiment: "Bullish",
    impactScore: 8.4,
    urgency: "High",
    source: "BSE Filing",
    sourceType: "Exchange",
    sourceConfidence: 96,
    publishedAt: hoursAgo(3),
    affectedCompanies: [
      "Maruti Suzuki",
      "Tata Motors",
      "M&M",
      "Hyundai India",
    ],
    kpiAffected: ["PAT", "EBITDA Margin", "Volumes", "ASP", "Inventory Days"],
    timeHorizon: "Short-term",
    whyItMatters:
      "Maruti is the volume bellwether for Indian PV — a beat plus an FY26 upgrade re-rates the entire passenger-vehicle complex and pushes consensus EPS higher across the sector.",
    bullCase:
      "Richer SUV mix + benign commodities + festive momentum drive 18–20% earnings CAGR; sustained market-share defence at ~41% supports a re-rating to ~28x FY27 EPS.",
    bearCase:
      "Inventory at dealers still elevated near 30 days; if discounting returns in H2 to defend share against new SUV launches, the guided margin expansion is at risk.",
    relatedCatalyst:
      "FY26 industry data print (SIAM monthly), monsoon progress for rural demand, and Q1 FY26 earnings on 28-Jul.",
    newsUrl: "https://www.bseindia.com",
  },
];
