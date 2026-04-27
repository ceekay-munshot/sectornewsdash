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
export const MOCK_NEWS: NewsItem[] = [];
