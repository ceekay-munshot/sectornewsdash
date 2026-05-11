// Methodology hints — copy used by the small `?` popovers next to each
// KPI / section header. Each hint should answer three questions in
// order: what does this measure, how is it computed, what goes into it.
// Keep formulas short enough to fit a 260px popover.

export const HEAT_SCORE_HINT = {
  title: "Heat score (0–100)",
  description:
    "How active and material a sector is right now. Higher means more impactful, more urgent, more recent and more trusted news.",
  formula:
    "heat = round( avg(itemScore × w) × 0.92 + volumeBoost )\nitemScore = impact×8 + recency×10 + urgency×6 + confidence×4 + |sentiment|×2\nw = 0.6 + 0.4 × (recency × urgency)\nvolumeBoost = min(8, log₂(1 + headlines) × 1.4)",
  inputs: [
    "impact 0–10 (×8)",
    "recency 0.1–1.0 (×10)",
    "urgency Low→Critical (×6)",
    "source confidence 0–100 (×4)",
    "sentiment magnitude (×2)",
    "volume boost ≤ +8",
  ],
};

export const SECTOR_SENTIMENT_HINT = {
  title: "Sentiment (−100 → +100)",
  description:
    "Direction of recent material news for the sector. Each item is weighted by impact, recency and source confidence. Labelled Bullish above +12, Bearish below −12, otherwise Neutral.",
  formula:
    "score = round( Σ(direction × w) / Σ(w) × 100 )\ndirection: Bullish +1, Neutral 0, Bearish −1\nw = (impact/10) × (0.5 + 0.5×recency) × (confidence/100)",
  inputs: [
    "direction ±1 or 0",
    "impact 0–10",
    "recency 0.1–1.0",
    "source confidence 0–100",
  ],
};

export const NEWS_RANKING_HINT = {
  title: "Ranking — material impact",
  description:
    "Headlines are sorted by an item-level material-impact score. Highest-impact, most urgent, freshest and most trusted news shows first.",
  formula:
    "rank = impact×10 + urgency×6 + recency×5 + (confidence/100)×3 + |sentiment|×1.5",
  inputs: [
    "impact 0–10",
    "urgency Low→Critical",
    "recency ≤1h → >7d",
    "source confidence 0–100",
    "sentiment magnitude",
  ],
};

export const HOTTEST_SECTOR_HINT = {
  title: "Hottest sector",
  description:
    "The single sector with the highest Heat score across news matching the current filters. Updates live as you change filters, the watchlist, or sync new news.",
  formula: "hottest = argmax(heatScore) over all sectors",
  inputs: [
    "Heat score 0–100",
    "Respects all active filters",
    "Live news replaces mock when present",
  ],
};

export const MOST_BULLISH_HINT = {
  title: "Most bullish sector",
  description:
    "The sector whose news is most positively skewed right now. Computed as the highest signed Sentiment score among sectors that actually have news in the current filter set.",
  formula: "mostBullish = argmax(sentimentScore) where newsCount > 0",
  inputs: [
    "Sentiment score −100 → +100",
    "Weighted by impact × recency × confidence",
    "Sectors with no news are skipped",
  ],
};

export const CRITICAL_ALERTS_HINT = {
  title: "Critical alerts",
  description:
    "Count of news items flagged with Critical urgency under the current filters — typically regulator actions, trading halts, large blow-ups or filings with immediate market impact. The secondary line is the average impact across just those critical items.",
  formula:
    "count = | { n ∈ filteredNews : n.urgency = 'Critical' } |\navgImpact = mean( impactScore ) over the same set",
  inputs: [
    "Urgency = Critical only",
    "Respects all active filters",
    "Impact 0–10",
  ],
};

export const AVG_IMPACT_HINT = {
  title: "Average impact",
  description:
    "Mean impactScore across the headlines counted in this card. Each headline carries an analyst-assigned impact from 0 (immaterial) to 10 (market-moving).",
  formula: "avgImpact = sum(impactScore) / count",
  inputs: ["impact 0–10 per headline"],
};
