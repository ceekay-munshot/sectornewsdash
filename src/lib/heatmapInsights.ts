// Heatmap insights — given the current sector aggregates, classify them
// into three bands an investor cares about:
//   • Deploy   — hot AND directionally bullish AND meaningful sample
//   • Watch    — interesting but not actionable yet (mixed sentiment, or
//                hot-but-bearish, or fresh story building)
//   • Reject   — cold, stale, or strongly bearish; not where to deploy now
//
// Deterministic rules off the same aggregates the dashboard already
// shows — no LLM call, no extra data fetch.

import type { NewsItem, SectorAggregate } from "../types";

export type Bucket = "deploy" | "watch" | "reject";

// ---- copy helpers ---------------------------------------------------------

const shorten = (t: string, max: number): string => {
  if (!t) return "";
  if (t.length <= max) return t;
  return t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
};

const q = (headline: string): string => `“${shorten(headline, 78)}”`;

const themeWord = (t: string): string => (t === "M&A" ? "M&A" : t.toLowerCase());

const pickTop = (items: NewsItem[], pred: (n: NewsItem) => boolean, n = 2) =>
  items.filter(pred).slice(0, n);

// ---- per-bucket sentence composers ---------------------------------------
// Every composer leans on the sector's actual top headlines so two
// sectors in the same bucket read differently — the user's complaint
// before this was that every "Bull run" row had identical copy.

function bullRunCopy(a: SectorAggregate): string {
  const bulls = pickTop(a.topNews, (n) => n.sentiment === "Bullish", 2);
  const theme = themeWord(a.topTheme);
  if (bulls.length >= 2)
    return `${a.sector.shortName} is running on ${theme} — ${q(bulls[0].headline)} and ${q(bulls[1].headline)} are the lead catalysts. Heavy positive flow with no offsetting drag; adding exposure here has the wind at its back instead of fighting it.`;
  if (bulls.length === 1)
    return `${a.sector.shortName} is being carried by ${theme} — the standout is ${q(bulls[0].headline)}. Catalyst and consensus are both lined up on the same side, which is when a long has the most edge.`;
  return `${a.sector.shortName} has a stack of bullish items led by ${theme} with no offsetting bears — the kind of setup where adding exposure has minimal friction.`;
}

function cleanTapeCopy(a: SectorAggregate): string {
  const bulls = pickTop(a.topNews, (n) => n.sentiment === "Bullish", 2);
  const theme = themeWord(a.topTheme);
  if (bulls.length >= 2)
    return `${a.sector.shortName} is putting up bullish items across ${theme} — ${q(bulls[0].headline)} and ${q(bulls[1].headline)} — with zero bearish headlines on the other side. Clean tape; lowest-friction way to add exposure.`;
  if (bulls.length === 1)
    return `${a.sector.shortName} has positive flow in ${theme} led by ${q(bulls[0].headline)}, and no bearish items to fight. Clean tape — straightforward way to size in.`;
  return `${a.sector.shortName}: bullish flow in ${theme}, no offsetting bears. Clean tape — minimum friction to add exposure.`;
}

function heavyRedCopy(a: SectorAggregate): string {
  const bears = pickTop(a.topNews, (n) => n.sentiment === "Bearish", 2);
  if (bears.length >= 2)
    return `${a.sector.shortName} is moving, but the wrong way — ${q(bears[0].headline)} and ${q(bears[1].headline)} are dragging it down. Stay out until the bear cycle clears; right now you'd be buying into the selling.`;
  if (bears.length === 1)
    return `${a.sector.shortName} is leaning hard negative — driven by items like ${q(bears[0].headline)}. Plenty of flow, but the direction is wrong; better to wait for a turn.`;
  return `${a.sector.shortName} has heat but its sentiment skews bearish. Wrong-side flow — sit this one out until it turns.`;
}

function thinTapeCopy(a: SectorAggregate): string {
  const lead = a.topNews[0]?.headline;
  if (lead)
    return `${a.sector.shortName}: only one or two items moving the dial — top of the list is ${q(lead)}. Not enough signal to size a position around; wait for a real catalyst.`;
  return `${a.sector.shortName}: barely any meaningful news flow. Not enough signal to position; wait for a catalyst before forcing a view.`;
}

function headlineRiskCopy(a: SectorAggregate): string {
  const crits = pickTop(a.topNews, (n) => n.urgency === "Critical", 2);
  if (crits.length >= 2)
    return `${a.sector.shortName} is in the middle of a breaking story — ${q(crits[0].headline)} and ${q(crits[1].headline)} are the Critical items right now. Read these first; the picture isn't stable enough to position on yet.`;
  if (crits.length === 1)
    return `${a.sector.shortName} has an active Critical-urgency item — ${q(crits[0].headline)}. Read it before doing anything; the situation is still developing.`;
  return `${a.sector.shortName} is sitting on multiple Critical-urgency items. Read them first, decide direction after.`;
}

function tugOfWarCopy(a: SectorAggregate): string {
  const bull = a.topNews.find((n) => n.sentiment === "Bullish");
  const bear = a.topNews.find((n) => n.sentiment === "Bearish");
  if (bull && bear)
    return `${a.sector.shortName} has bulls and bears swinging at each other — ${q(bull.headline)} on one side, ${q(bear.headline)} on the other. Active but unresolved; wait for one side to win the next leg.`;
  return `${a.sector.shortName} has active flow but no clear lean — bulls and bears are about even. Wait for the next catalyst to pick a side.`;
}

function buildingCopy(a: SectorAggregate): string {
  const bulls = pickTop(a.topNews, (n) => n.sentiment === "Bullish", 1);
  if (bulls.length === 1)
    return `${a.sector.shortName} is tilting positive — ${q(bulls[0].headline)} is the kind of item building the case. Move is early though; watchlist it and size in if more catalysts land in the next few days.`;
  return `${a.sector.shortName} is drifting positive but it's still early. Watchlist material — size in only if more bullish items appear.`;
}

function underPressureCopy(a: SectorAggregate): string {
  const bears = pickTop(a.topNews, (n) => n.sentiment === "Bearish", 1);
  if (bears.length === 1)
    return `${a.sector.shortName} is drifting lower on items like ${q(bears[0].headline)}. Not a blow-up yet, but the next catalyst could decide whether to step in or step away.`;
  return `${a.sector.shortName} is leaning negative but not blown out. Watch the next item carefully — could resolve either way.`;
}

function backgroundCopy(a: SectorAggregate): string {
  const lead = a.topNews[0]?.headline;
  if (lead)
    return `${a.sector.shortName} has mixed, mid-tier flow — top item is ${q(lead)} but nothing is dominating. Useful as context for what's going on around it; not actionable on its own.`;
  return `${a.sector.shortName}: mixed signals, nothing decisive. Background context only.`;
}

function quietCopy(a: SectorAggregate): string {
  return `${a.sector.shortName}: no fresh news in this view. Either filters are hiding it or the sector is genuinely silent — re-check after the next sync.`;
}

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
    return { bucket: "reject", reason: quietCopy(a), badge: "Quiet" };
  }

  const hot = a.heatScore >= 60;
  const warm = a.heatScore >= 45;
  const cold = a.heatScore < 35;

  const strongBull = a.bullishMomentum >= 12 && a.bullishCount >= 4;
  const cleanBull = a.bullishCount > 0 && a.bearishCount === 0;
  const strongBear = a.sentimentScore <= -25 || a.bearishCount > a.bullishCount * 2;
  const criticalLoad = a.criticalCount >= 3;

  if (hot && strongBull && a.sentimentScore > 0)
    return { bucket: "deploy", reason: bullRunCopy(a), badge: "Bull run" };

  if (warm && cleanBull && a.bullishCount >= 3)
    return { bucket: "deploy", reason: cleanTapeCopy(a), badge: "Clean tape" };

  if (hot && strongBear)
    return { bucket: "reject", reason: heavyRedCopy(a), badge: "Heavy red" };

  if (cold)
    return { bucket: "reject", reason: thinTapeCopy(a), badge: "Thin tape" };

  if (criticalLoad)
    return { bucket: "watch", reason: headlineRiskCopy(a), badge: "Headline risk" };

  if (warm && Math.abs(a.sentimentScore) < 12)
    return { bucket: "watch", reason: tugOfWarCopy(a), badge: "Tug of war" };

  if (warm && a.bullishMomentum > 0)
    return { bucket: "watch", reason: buildingCopy(a), badge: "Building" };

  if (warm && a.bullishMomentum < 0)
    return { bucket: "watch", reason: underPressureCopy(a), badge: "Under pressure" };

  return { bucket: "watch", reason: backgroundCopy(a), badge: "Background" };
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
