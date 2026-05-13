// Data-driven "Why?" explainers for the three top KPI cards on the
// Overview tab. Unlike the static formulas in src/lib/logicExplainers.ts,
// these read the *current* aggregates and produce a plain-English answer
// to "why is THIS sector showing up here right now?".

import type { NewsItem, SectorAggregate } from "../types";
import { heatTier } from "./utils";

export interface WhySection {
  heading: string;
  body: string;
}

export interface WhyExplanation {
  title: string;        // e.g. "Why is Infra the hottest sector?"
  subject: string;      // bold one-liner statement
  metric: string;       // big metric value e.g. "Heat 68"
  metricLabel: string;  // e.g. "across 20 headlines"
  accent: string;       // hex
  reasons: WhySection[];
  topNews: NewsItem[];
  caveat?: string;
}

const NUM = (n: number) => (Math.abs(n) >= 10 ? Math.round(n) : Number(n.toFixed(1)));

// ---- helpers --------------------------------------------------------------

const fresh24h = (n: NewsItem) =>
  Date.now() - new Date(n.publishedAt).getTime() <= 24 * 60 * 60 * 1000;

function sectorRunnersUp(
  aggregates: SectorAggregate[],
  pickKey: (a: SectorAggregate) => number,
  excludeId: string,
  k = 2
) {
  return aggregates
    .filter((a) => a.sector.id !== excludeId && a.newsCount > 0)
    .sort((aa, b) => pickKey(b) - pickKey(aa))
    .slice(0, k);
}

// ---- HOTTEST --------------------------------------------------------------

export function explainHottest(
  hottest: SectorAggregate | undefined,
  aggregates: SectorAggregate[]
): WhyExplanation | null {
  if (!hottest || hottest.newsCount === 0) return null;

  const tier = heatTier(hottest.heatScore);
  const recent = hottest.topNews.filter(fresh24h).length;
  const runners = sectorRunnersUp(aggregates, (a) => a.heatScore, hottest.sector.id, 2);

  const reasons: WhySection[] = [];

  reasons.push({
    heading: "Volume × material flow",
    body:
      `${hottest.sector.shortName} has ${hottest.newsCount} headlines in the current view ` +
      `at an average impact of ${NUM(hottest.avgImpact)} / 10 — ` +
      `that combination is what pushes its Heat into the "${tier.label}" band.`,
  });

  if (hottest.criticalCount > 0) {
    reasons.push({
      heading: "Urgency concentration",
      body:
        `${hottest.criticalCount} of those ${hottest.criticalCount === 1 ? "is" : "are"} ` +
        `tagged Critical urgency — recalls, halts, regulator actions or other items ` +
        `that demand immediate attention. Critical items get the largest weight in Heat.`,
    });
  }

  if (recent > 0) {
    reasons.push({
      heading: "Freshness",
      body:
        `${recent} of the top headlines are from the last 24 hours, so this isn't ` +
        `stale flow — recent items get the full freshness multiplier.`,
    });
  }

  if (runners.length > 0) {
    const gap = hottest.heatScore - runners[0].heatScore;
    reasons.push({
      heading: "Gap to the next sector",
      body:
        gap >= 8
          ? `Clear lead: ${runners[0].sector.shortName} is next at Heat ${runners[0].heatScore} — a ${gap}-point gap.`
          : gap > 0
            ? `Tight race: ${runners[0].sector.shortName} is right behind at Heat ${runners[0].heatScore} (only ${gap} points back). Watch this if filters change.`
            : `Tied with ${runners[0].sector.shortName} at Heat ${runners[0].heatScore} — sort order decided the pick.`,
    });
  }

  return {
    title: `Why is ${hottest.sector.name} the hottest sector?`,
    subject: `${hottest.sector.shortName} is leading because of where the news is concentrated, not just how loud it is.`,
    metric: `Heat ${hottest.heatScore}`,
    metricLabel: `${tier.label} · ${hottest.newsCount} headlines`,
    accent: hottest.sector.accent,
    reasons,
    topNews: hottest.topNews.slice(0, 3),
    caveat:
      hottest.newsCount < 5
        ? "Sample is small — re-check after the next sync."
        : undefined,
  };
}

// ---- MOST BULLISH ---------------------------------------------------------

export function explainMostBullish(
  pick: SectorAggregate | undefined,
  aggregates: SectorAggregate[]
): WhyExplanation | null {
  if (!pick || pick.newsCount === 0) return null;

  const runners = sectorRunnersUp(
    aggregates,
    (a) => a.bullishMomentum,
    pick.sector.id,
    2
  );

  const reasons: WhySection[] = [];

  reasons.push({
    heading: "Bullish-to-bearish balance",
    body:
      `${pick.bullishCount} bullish, ${pick.bearishCount} bearish, ` +
      `${pick.neutralCount} neutral headline${pick.neutralCount === 1 ? "" : "s"}. ` +
      (pick.bearishCount === 0
        ? "No offsetting bearish flow at all."
        : `Even after the ${pick.bearishCount} bearish headline${pick.bearishCount === 1 ? "" : "s"} get netted out, the bullish side still dominates.`),
  });

  reasons.push({
    heading: "Bullish momentum",
    body:
      `We rank "Most Bullish" by net bullish energy — Σ(impact × recency × confidence) ` +
      `for bullish items minus the same for bearish items. ${pick.sector.shortName} scored ${NUM(pick.bullishMomentum)}, ` +
      `which means high-impact, recent, trustworthy items are stacking on the positive side.`,
  });

  const topBull = pick.topNews.find((n) => n.sentiment === "Bullish");
  if (topBull) {
    reasons.push({
      heading: "Lead headline driving it",
      body:
        `"${topBull.headline}" — impact ${topBull.impactScore}/10, source ${topBull.source}. ` +
        `Items like this are what tip the scale.`,
    });
  }

  if (runners.length > 0) {
    const gap = pick.bullishMomentum - runners[0].bullishMomentum;
    reasons.push({
      heading: "Compared to the runner-up",
      body:
        gap > 5
          ? `Decisive lead — ${runners[0].sector.shortName} is next at momentum ${NUM(runners[0].bullishMomentum)}.`
          : gap > 0
            ? `Close call — ${runners[0].sector.shortName} is right behind at ${NUM(runners[0].bullishMomentum)}.`
            : `Tied / behind ${runners[0].sector.shortName}; tiebreak goes to higher sentiment score.`,
    });
  }

  return {
    title: `Why is ${pick.sector.name} the most bullish sector?`,
    subject:
      `${pick.sector.shortName} wins because the bullish energy is both deep (high-impact items) and broad (count) — not just because every headline happens to be positive.`,
    metric: `+${NUM(pick.bullishMomentum)}`,
    metricLabel: `momentum · ${pick.bullishCount} bullish / ${pick.bearishCount} bearish`,
    accent: pick.sector.accent,
    reasons,
    topNews: pick.topNews.filter((n) => n.sentiment === "Bullish").slice(0, 3),
    caveat:
      pick.bullishCount < 3
        ? "Bullish sample is thin — treat as directional, not conclusive."
        : undefined,
  };
}

// ---- CRITICAL ALERTS ------------------------------------------------------

export function explainCritical(
  count: number,
  criticals: NewsItem[],
  aggregates: SectorAggregate[]
): WhyExplanation | null {
  if (count === 0) return null;

  const sectorsHit = new Set(criticals.map((n) => n.sector));
  const buckets = new Map<string, NewsItem[]>();
  for (const n of criticals) {
    if (!buckets.has(n.sector)) buckets.set(n.sector, []);
    buckets.get(n.sector)!.push(n);
  }
  const ranked = Array.from(buckets.entries())
    .map(([sectorId, items]) => {
      const sector = aggregates.find((a) => a.sector.id === sectorId)?.sector;
      return { sectorId, items, sector, count: items.length };
    })
    .filter((b) => b.sector)
    .sort((a, b) => b.count - a.count);

  const top = ranked[0];
  const avgImpact =
    criticals.reduce((s, n) => s + n.impactScore, 0) / criticals.length;

  const reasons: WhySection[] = [];

  reasons.push({
    heading: "Spread",
    body:
      sectorsHit.size === 1
        ? `All ${count} critical headlines hit a single sector (${top.sector!.shortName}) — concentrated event.`
        : `Critical urgency is spread across ${sectorsHit.size} sectors. ` +
          (top
            ? `${top.sector!.shortName} carries the most (${top.count}).`
            : ""),
  });

  reasons.push({
    heading: "Average impact",
    body:
      `Mean impact across these ${count} items is ${NUM(avgImpact)} / 10. ` +
      (avgImpact >= 7
        ? "These aren't routine items — most are genuinely market-moving."
        : avgImpact >= 5
          ? "Mix of material and notable items. Worth a focused read."
          : "Most are mid-impact — urgent but not necessarily large in magnitude."),
  });

  if (ranked.length > 1) {
    const tail = ranked.slice(0, 4).map((b) => `${b.sector!.shortName} (${b.count})`).join(" · ");
    reasons.push({
      heading: "Top sectors",
      body: tail,
    });
  }

  const topItems = criticals
    .slice()
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 3);

  return {
    title: `What is driving ${count} critical alert${count === 1 ? "" : "s"}?`,
    subject:
      sectorsHit.size === 1
        ? "Single-sector event — likely one developing story to track closely."
        : "Multi-sector cluster — read the top items below to see if there's a common theme.",
    metric: String(count),
    metricLabel: `across ${sectorsHit.size} sector${sectorsHit.size === 1 ? "" : "s"}`,
    accent: "#FB7185",
    reasons,
    topNews: topItems,
  };
}
