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

function classify(a: SectorAggregate): { bucket: Bucket; reason: string; badge: string } {
  // Quiet / no data → reject (silently)
  if (a.newsCount === 0) {
    return {
      bucket: "reject",
      reason:
        "No fresh news in this view right now — either the filters are hiding things or the sector is genuinely silent today. Re-check after the next sync.",
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
      reason:
        "News flow here is heavy and pointed in one direction — positive. That's the setup where catalyst and consensus are both lined up, so a long position has the wind at its back instead of fighting it.",
      badge: "Bull run",
    };
  }

  if (warm && cleanBull && a.bullishCount >= 3) {
    return {
      bucket: "deploy",
      reason:
        "There's meaningful activity here and not a single bearish item to fight. A clean tape like this is the lowest-friction way to add exposure — you don't have to time the noise out.",
      badge: "Clean tape",
    };
  }

  if (hot && strongBear) {
    return {
      bucket: "reject",
      reason:
        "Plenty of news, but the weight of it is bearish — the sector is moving, and moving down. Stay out until the bear cycle clears; right now you'd be buying into the selling.",
      badge: "Heavy red",
    };
  }

  if (cold) {
    return {
      bucket: "reject",
      reason:
        "Barely any meaningful news flow here — nothing material is happening, so there's nothing to position around either. Wait for a catalyst before forcing a view.",
      badge: "Thin tape",
    };
  }

  if (criticalLoad) {
    return {
      bucket: "watch",
      reason:
        "A story is breaking right now — several Critical-urgency items at once usually means a developing situation that hasn't stabilised. Read the headlines first, decide direction after.",
      badge: "Headline risk",
    };
  }

  if (warm && Math.abs(a.sentimentScore) < 12) {
    return {
      bucket: "watch",
      reason:
        "Active flow, but bulls and bears are pretty evenly matched — the sector is in motion, just not in any clear direction yet. Wait for one side to win the next leg before committing.",
      badge: "Tug of war",
    };
  }

  if (warm && a.bullishMomentum > 0) {
    return {
      bucket: "watch",
      reason:
        "Trending positive, but the move is still early — not enough conviction yet to call it a clean setup. Worth keeping on the watchlist; consider sizing in if more bullish catalysts land in the next few days.",
      badge: "Building",
    };
  }

  if (warm && a.bullishMomentum < 0) {
    return {
      bucket: "watch",
      reason:
        "Leaning negative, but not blown out yet — could be the start of a sell-off, could just be noise. Wait for the next catalyst before deciding whether to step in or step away.",
      badge: "Under pressure",
    };
  }

  return {
    bucket: "watch",
    reason:
      "Mixed, mid-tier flow — nothing here is going to drive a position on its own. Useful as background context for what's going on around it, but not actionable on its own today.",
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
