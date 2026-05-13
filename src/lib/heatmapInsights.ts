// Heatmap insights — given the current sector aggregates, classify them
// into three bands an investor cares about:
//   • Deploy   — hot AND directionally bullish AND meaningful sample
//   • Watch    — interesting but not actionable yet (mixed sentiment, or
//                hot-but-bearish, or fresh story building)
//   • Reject   — cold, stale, or strongly bearish; not where to deploy now
//
// Deterministic rules off the same aggregates the dashboard already
// shows — no LLM call, no extra data fetch.

import type { SectorAggregate } from "../types";

export type Bucket = "deploy" | "watch" | "reject";

export interface InsightRow {
  agg: SectorAggregate;
  reason: string;
  badge: string; // a single-word headline for the row, e.g. "Bull run"
}

export interface HeatmapInsights {
  generatedAt: number;
  totalSectors: number;
  liveSectors: number;
  deploy: InsightRow[];
  watch: InsightRow[];
  reject: InsightRow[];
  oneLiner: string;       // headline at the top of the panel
  marketTone: "risk-on" | "neutral" | "risk-off" | "quiet";
}

const round = (n: number) =>
  Math.abs(n) >= 10 ? Math.round(n) : Number(n.toFixed(1));

function classify(a: SectorAggregate): { bucket: Bucket; reason: string; badge: string } {
  // Quiet / no data → reject (silently)
  if (a.newsCount === 0) {
    return {
      bucket: "reject",
      reason: "No headlines under current filters — stale.",
      badge: "Quiet",
    };
  }

  const hot = a.heatScore >= 60;
  const warm = a.heatScore >= 45;
  const cold = a.heatScore < 35;

  const strongBull = a.bullishMomentum >= 12 && a.bullishCount >= 4;
  const cleanBull = a.bullishCount > 0 && a.bearishCount === 0;
  const strongBear = a.sentimentScore <= -25 || a.bearishCount > a.bullishCount * 2;
  const criticalLoad = a.criticalCount >= 3;

  if (hot && strongBull && a.sentimentScore > 0) {
    return {
      bucket: "deploy",
      reason: `Heat ${a.heatScore}, momentum +${round(a.bullishMomentum)}, ${a.bullishCount} bullish vs ${a.bearishCount} bearish — strong directional flow.`,
      badge: "Bull run",
    };
  }

  if (warm && cleanBull && a.bullishCount >= 3) {
    return {
      bucket: "deploy",
      reason: `Heat ${a.heatScore}, ${a.bullishCount} bullish, zero bearish — clean positive setup.`,
      badge: "Clean tape",
    };
  }

  if (hot && strongBear) {
    return {
      bucket: "reject",
      reason: `Heat ${a.heatScore} but sentiment ${a.sentimentScore > 0 ? "+" : ""}${a.sentimentScore} with ${a.bearishCount} bearish — wrong-side flow.`,
      badge: "Heavy red",
    };
  }

  if (cold) {
    return {
      bucket: "reject",
      reason: `Heat ${a.heatScore}, only ${a.newsCount} headline${a.newsCount === 1 ? "" : "s"} — too thin to act on.`,
      badge: "Thin tape",
    };
  }

  if (criticalLoad) {
    return {
      bucket: "watch",
      reason: `${a.criticalCount} Critical alerts — likely a developing story. Read first, position later.`,
      badge: "Headline risk",
    };
  }

  if (warm && Math.abs(a.sentimentScore) < 12) {
    return {
      bucket: "watch",
      reason: `Heat ${a.heatScore}, sentiment essentially flat (${a.sentimentScore > 0 ? "+" : ""}${a.sentimentScore}) — story not resolved either way yet.`,
      badge: "Tug of war",
    };
  }

  if (warm && a.bullishMomentum > 0) {
    return {
      bucket: "watch",
      reason: `Heat ${a.heatScore}, leaning bullish (momentum +${round(a.bullishMomentum)}) — building, not yet decisive.`,
      badge: "Building",
    };
  }

  if (warm && a.bullishMomentum < 0) {
    return {
      bucket: "watch",
      reason: `Heat ${a.heatScore}, momentum ${round(a.bullishMomentum)} — under pressure but not blown out.`,
      badge: "Under pressure",
    };
  }

  return {
    bucket: "watch",
    reason: `Heat ${a.heatScore}, ${a.bullishCount} bull / ${a.bearishCount} bear / ${a.neutralCount} neutral — context only.`,
    badge: "Background",
  };
}

export function buildHeatmapInsights(aggregates: SectorAggregate[]): HeatmapInsights {
  const totalSectors = aggregates.length;
  const liveSectors = aggregates.filter((a) => a.newsCount > 0).length;

  const deploy: InsightRow[] = [];
  const watch: InsightRow[] = [];
  const reject: InsightRow[] = [];

  for (const a of aggregates) {
    const { bucket, reason, badge } = classify(a);
    const row: InsightRow = { agg: a, reason, badge };
    if (bucket === "deploy") deploy.push(row);
    else if (bucket === "watch") watch.push(row);
    else reject.push(row);
  }

  // Sort each bucket so the most striking entry leads.
  deploy.sort((a, b) => b.agg.bullishMomentum - a.agg.bullishMomentum);
  watch.sort((a, b) => b.agg.heatScore - a.agg.heatScore);
  reject.sort((a, b) => {
    // Bearish-and-loud before quiet-and-empty
    const ah = a.agg.heatScore;
    const bh = b.agg.heatScore;
    if (a.agg.newsCount === 0 && b.agg.newsCount > 0) return 1;
    if (b.agg.newsCount === 0 && a.agg.newsCount > 0) return -1;
    return bh - ah;
  });

  // Cap each list to keep the panel scannable.
  const cap = (xs: InsightRow[]) => xs.slice(0, 6);

  // Market tone — overall vibe from the live universe.
  let bullishUniverse = 0;
  let bearishUniverse = 0;
  for (const a of aggregates) {
    bullishUniverse += Math.max(0, a.bullishMomentum);
    bearishUniverse += Math.max(0, -a.bullishMomentum);
  }
  let marketTone: HeatmapInsights["marketTone"];
  if (liveSectors === 0) marketTone = "quiet";
  else if (bullishUniverse > bearishUniverse * 1.6) marketTone = "risk-on";
  else if (bearishUniverse > bullishUniverse * 1.6) marketTone = "risk-off";
  else marketTone = "neutral";

  const oneLiner = (() => {
    if (marketTone === "quiet")
      return "Tape is quiet — wait for fresh syncs before drawing conclusions.";
    if (marketTone === "risk-on")
      return `Risk-on day. ${deploy.length} sector${deploy.length === 1 ? "" : "s"} look deployable, ${watch.length} worth watching, ${reject.length} to skip.`;
    if (marketTone === "risk-off")
      return `Risk-off day. ${reject.length} sector${reject.length === 1 ? "" : "s"} flashing red, only ${deploy.length} clean longs.`;
    return `Mixed tape. ${deploy.length} clean longs, ${watch.length} unresolved, ${reject.length} to skip for now.`;
  })();

  return {
    generatedAt: Date.now(),
    totalSectors,
    liveSectors,
    deploy: cap(deploy),
    watch: cap(watch),
    reject: cap(reject),
    oneLiner,
    marketTone,
  };
}
