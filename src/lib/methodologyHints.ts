/**
 * Single source of truth for the "?" tooltips next to each metric.
 * Keep these short — they're hover popovers, not docs.
 */

export const HEAT_SCORE_HINT = {
  title: "Sector heat score",
  description: "0–100 composite of every news item currently in scope.",
  formula: "weighted-avg(item-score) × 0.92 + log volume boost",
  inputs: [
    "Impact ×8",
    "Recency ×10",
    "Urgency ×6",
    "Confidence ×4",
    "Sentiment magnitude ×2",
  ],
};

export const SECTOR_SENTIMENT_HINT = {
  title: "Sector sentiment",
  description:
    "Signed score in [-100, +100]; labelled Bullish / Bearish past ±12.",
  formula: "Σ(sign × impact × (0.5 + 0.5·recency) × confidence)",
  inputs: ["Bullish = +1, Bearish = −1", "Recency decays in steps (1h → 7d)"],
};

export const NEWS_RANKING_HINT = {
  title: "News ranking",
  description: "Highest material impact first.",
  formula: "impact×10 + urgency×6 + recency×5 + confidence×3 + |sentiment|×1.5",
  inputs: [
    "Recency decays in steps (1h → 7d)",
    "Critical urgency = ×1.0 weight",
    "Confidence on a 0–100 scale",
  ],
};
