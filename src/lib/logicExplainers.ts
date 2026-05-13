// Logic explainers — the long-form copy that powers the in-app Logic
// tab. Each entry is the canonical "how & why" reference for one of the
// dashboard's KPIs, labels, or scores. Lifted directly from the formulas
// in src/lib/logic.ts and src/lib/munsToNews.ts so it stays accurate.

import {
  Flame,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Gauge,
  Zap,
  Siren,
  Clock,
  ShieldCheck,
  CalendarRange,
  ArrowDownUp,
  type LucideIcon,
} from "lucide-react";

export type LogicCategory =
  | "Sector scores"
  | "Sentiment"
  | "Highlights"
  | "Per-headline signals"
  | "Ordering";

export interface InterpretationBand {
  band: string;          // "0 – 25", "Bullish", etc.
  label: string;         // short label e.g. "Cold"
  meaning: string;       // plain-English meaning
  tone?: "good" | "warn" | "bad" | "info";
}

export interface LogicExplainer {
  id: string;
  title: string;
  shortLabel: string;
  category: LogicCategory;
  range: string;
  icon: LucideIcon;
  accent: string;
  oneLiner: string;
  whatIs: string;
  howCalculated: string; // multi-line formula, monospace-rendered
  inputs: { name: string; range: string; note?: string }[];
  interpretation: InterpretationBand[];
  example?: string;
  whereSeen?: string[];
  related?: string[]; // ids of related explainers
}

const HEAT: LogicExplainer = {
  id: "heat",
  title: "Heat Score",
  shortLabel: "Heat",
  category: "Sector scores",
  range: "0 – 100",
  icon: Flame,
  accent: "#FB7185",
  oneLiner: "How active and material a sector is right now.",
  whatIs:
    "A single 0–100 number that tells you, at a glance, how much is happening in a sector and how much it actually matters. A high heat score doesn't mean 'good' or 'bad' — it means 'pay attention'.",
  howCalculated:
    "for each headline n in the sector:\n  recency r   = time-decay weight  (≤1h → 1.0, >7d → 0.1)\n  urgency u   = Low 0.25 · Med 0.5 · High 0.75 · Crit 1.0\n  conf    c   = sourceConfidence / 100\n  sentMag s   = 1 if Bullish or Bearish, else 0\n  itemScore   = impact×8 + r×10 + u×6 + c×4 + s×2\n  weight  w   = 0.6 + 0.4 × (r × u)\n\navg          = Σ(itemScore × w) / Σ(w)\nvolumeBoost  = min(8, log₂(1 + headlines) × 1.4)\nheat         = round( avg × 0.92 + volumeBoost )    clamped to 0–100",
  inputs: [
    { name: "Impact (per headline)", range: "0 – 10", note: "biggest single driver — ×8" },
    { name: "Recency", range: "0.1 – 1.0", note: "≤1h is full credit, >7d is near-zero" },
    { name: "Urgency", range: "Low → Critical" },
    { name: "Source confidence", range: "0 – 100" },
    { name: "Sentiment magnitude", range: "0 or 1", note: "Neutral counts less than directional" },
    { name: "Volume boost", range: "≤ +8", note: "diminishing returns past ~25 items" },
  ],
  interpretation: [
    { band: "0 – 24",  label: "Cold",    meaning: "Quiet. Mostly stale or low-impact items, or no news at all.", tone: "info" },
    { band: "25 – 49", label: "Warming", meaning: "Some activity, but nothing big or urgent yet.", tone: "info" },
    { band: "50 – 74", label: "Active",  meaning: "Real, recent, materially-sized news flow. Worth a look.", tone: "warn" },
    { band: "75 – 100",label: "Hot",     meaning: "Heavy volume of high-impact, recent, urgent news. Sector is in motion.", tone: "bad" },
  ],
  example:
    "12 headlines, avg impact 6, mostly High urgency, all <24h old, mostly Tier-1 / Regulator sources → itemScore ≈ 74, volumeBoost ≈ +5 → Heat ≈ 73 (Active).",
  whereSeen: ["Overview KPI strip", "Sector heatmap", "Sector cards", "Sector detail header"],
  related: ["sentiment-score", "impact", "urgency", "recency"],
};

const SENTIMENT_SCORE: LogicExplainer = {
  id: "sentiment-score",
  title: "Sentiment Score",
  shortLabel: "Sentiment",
  category: "Sector scores",
  range: "−100 → +100",
  icon: Activity,
  accent: "#7DD3FC",
  oneLiner: "Net direction of recent material news for a sector.",
  whatIs:
    "A signed number from −100 (deep red) to +100 (deep green) summarising whether recent, material headlines lean positive or negative. Each headline votes ±1, but the votes are weighted by impact, freshness, and how trustworthy the source is.",
  howCalculated:
    "for each headline n:\n  direction d = Bullish +1 · Neutral 0 · Bearish −1\n  weight    w = (impact/10) × (0.5 + 0.5×recency) × (confidence/100)\n\nscore = round( Σ(d × w) / Σ(w) × 100 )\n\nlabel = Bullish  if score >  +12\n        Bearish  if score <  −12\n        Neutral  otherwise",
  inputs: [
    { name: "Direction", range: "−1, 0, +1", note: "per-headline label" },
    { name: "Impact", range: "0 – 10" },
    { name: "Recency", range: "0.1 – 1.0" },
    { name: "Source confidence", range: "0 – 100" },
  ],
  interpretation: [
    { band: "+40 → +100", label: "Strongly bullish", meaning: "Recent material news is clearly positive.", tone: "good" },
    { band: "+13 → +39",  label: "Bullish",          meaning: "Net positive — enough to flip the label.", tone: "good" },
    { band: "−12 → +12",  label: "Neutral",          meaning: "Mixed or balanced. The +/−12 dead-band stops noise from flipping the label.", tone: "info" },
    { band: "−39 → −13",  label: "Bearish",          meaning: "Net negative.", tone: "bad" },
    { band: "−100 → −40", label: "Strongly bearish", meaning: "Recent material news is clearly negative.", tone: "bad" },
  ],
  example:
    "5 headlines: 3 Bullish (impacts 7, 6, 4), 1 Neutral (impact 3), 1 Bearish (impact 8). The bearish item has high impact and is fresh → weighted score lands around +18 → label = Bullish.",
  whereSeen: ["Sector cards", "Sector detail", "Most-bullish KPI"],
  related: ["bullish", "bearish", "neutral", "impact", "recency"],
};

const BULLISH: LogicExplainer = {
  id: "bullish",
  title: "Bullish — how we tell",
  shortLabel: "Bullish",
  category: "Sentiment",
  range: "Label",
  icon: TrendingUp,
  accent: "#5EEAD4",
  oneLiner: "Per-headline = positive impact column. Per-sector = score > +12.",
  whatIs:
    "Two distinct things share the name 'Bullish'. (1) On an individual headline it's set by the agent's Impact column — anything containing 'positive' (including 'mixed positive') is flagged Bullish. (2) At sector level it's the label applied when the weighted Sentiment Score crosses +12.",
  howCalculated:
    "Per-headline:\n  impactColumn.includes('positive')        → Bullish\n  impactColumn.includes('mixed positive')  → Bullish\n\nPer-sector:\n  sentimentScore > +12 → Bullish",
  inputs: [
    { name: "Agent's Impact column", range: "free text", note: "from the MUNS table the agent returns" },
    { name: "Sentiment score", range: "−100 → +100", note: "sector-level threshold" },
  ],
  interpretation: [
    { band: "Headline",  label: "Bullish",          meaning: "Agent flagged it as net positive for the named companies / segment.", tone: "good" },
    { band: "Sector",    label: "Bullish",          meaning: "Weighted average of recent headlines is decisively positive (>+12).", tone: "good" },
    { band: "Sector",    label: "Strongly bullish", meaning: "Score above +40 — the positive lean is wide and consistent.", tone: "good" },
  ],
  example:
    "Headline: 'Maruti reports record Q3 profit, beats estimates' → Impact='Positive' → Bullish. Three of these in a sector with no offsetting bears → sector sentiment score = +52 → Bullish (strongly).",
  whereSeen: ["Headline badges", "Sector cards", "Sentiment filter"],
  related: ["bearish", "neutral", "sentiment-score"],
};

const BEARISH: LogicExplainer = {
  id: "bearish",
  title: "Bearish — how we tell",
  shortLabel: "Bearish",
  category: "Sentiment",
  range: "Label",
  icon: TrendingDown,
  accent: "#FB7185",
  oneLiner: "Per-headline = negative impact column. Per-sector = score < −12.",
  whatIs:
    "(1) A headline is Bearish if the agent's Impact column contains 'negative'. (2) A sector is Bearish if its weighted Sentiment Score falls below −12.",
  howCalculated:
    "Per-headline:\n  impactColumn.includes('negative') → Bearish\n\nPer-sector:\n  sentimentScore < −12 → Bearish\n\nBearish headlines also get an Impact bump for shock words:\n  +2 if (recall|halt|suspend|ban|crisis|fraud|probe|fire|accident)\n  +1 if (miss|below estimates|de-growth|decline|fall|drop)",
  inputs: [
    { name: "Agent's Impact column", range: "free text" },
    { name: "Sentiment score", range: "−100 → +100" },
  ],
  interpretation: [
    { band: "Headline", label: "Bearish",          meaning: "Net negative for the companies / segment.", tone: "bad" },
    { band: "Sector",   label: "Bearish",          meaning: "Weighted average is decisively negative (<−12).", tone: "bad" },
    { band: "Sector",   label: "Strongly bearish", meaning: "Score below −40 — sustained, broad negative flow.", tone: "bad" },
  ],
  example:
    "Headline: 'Vehicle maker recalls 200k units after airbag defect' → Impact='Negative' → Bearish, and triggers the 'recall' bump → urgency = Critical, impact ≈ 9.",
  whereSeen: ["Headline badges", "Sector cards", "Critical alerts", "Sentiment filter"],
  related: ["bullish", "neutral", "sentiment-score", "urgency"],
};

const NEUTRAL: LogicExplainer = {
  id: "neutral",
  title: "Neutral — how we tell",
  shortLabel: "Neutral",
  category: "Sentiment",
  range: "Label",
  icon: Minus,
  accent: "#94A3B8",
  oneLiner: "Per-headline = mixed without positive. Per-sector = score within ±12.",
  whatIs:
    "A headline is Neutral when the agent's Impact column says 'mixed' (without 'positive'), or when it doesn't match positive/negative cues at all. A sector is Neutral when its score sits inside the ±12 dead-band — close enough to zero that we don't claim a direction.",
  howCalculated:
    "Per-headline:\n  impactColumn.includes('mixed') and NOT 'positive' → Neutral\n  otherwise (no positive/negative cue)              → Neutral\n\nPer-sector:\n  −12 ≤ sentimentScore ≤ +12 → Neutral",
  inputs: [
    { name: "Agent's Impact column", range: "free text" },
    { name: "Sentiment score", range: "−100 → +100" },
  ],
  interpretation: [
    { band: "Headline", label: "Neutral", meaning: "Either genuinely mixed, or no clear direction in the source text.", tone: "info" },
    { band: "Sector",   label: "Neutral", meaning: "Positive and negative items roughly balance — or the activity is too small to lean.", tone: "info" },
  ],
  example:
    "Headline: 'OEMs report mixed Q3 — passenger up, CV down' → Impact='Mixed' → Neutral. A sector with this single item: sentiment score = 0 → Neutral.",
  whereSeen: ["Headline badges", "Sector cards", "Sentiment filter"],
  related: ["bullish", "bearish", "sentiment-score"],
};

const HOTTEST: LogicExplainer = {
  id: "hottest-sector",
  title: "Hottest Sector",
  shortLabel: "Hottest",
  category: "Highlights",
  range: "Sector pick",
  icon: Flame,
  accent: "#FB7185",
  oneLiner: "The single sector with the highest Heat Score right now.",
  whatIs:
    "The sector picked out at the top-left of the dashboard. It updates live as you change filters, add to the watchlist, or sync new news.",
  howCalculated: "hottest = argmax(heatScore) over all sectors\n        respects every active filter",
  inputs: [
    { name: "Heat score", range: "0 – 100" },
    { name: "Active filters", range: "—", note: "search, sector, time horizon" },
  ],
  interpretation: [
    { band: "Heat ≥ 75", label: "Confident pick",    meaning: "Clear leader — heavy, recent, urgent flow.", tone: "bad" },
    { band: "Heat 50–74",label: "Working pick",      meaning: "Top of the pack, but other sectors are close behind.", tone: "warn" },
    { band: "Heat < 50", label: "Thin pick",         meaning: "Nothing really hot — even the leader is quiet. Try syncing.", tone: "info" },
  ],
  whereSeen: ["Overview KPI strip"],
  related: ["heat", "most-bullish"],
};

const MOST_BULLISH: LogicExplainer = {
  id: "most-bullish",
  title: "Most Bullish Sector",
  shortLabel: "Most bullish",
  category: "Highlights",
  range: "Sector pick",
  icon: TrendingUp,
  accent: "#5EEAD4",
  oneLiner: "Sector whose recent news is most positively skewed.",
  whatIs:
    "The sector with the highest signed Sentiment Score among sectors that actually have headlines under the current filters. Sectors with zero headlines are skipped — empty is not bullish.",
  howCalculated: "mostBullish = argmax(sentimentScore) where newsCount > 0",
  inputs: [
    { name: "Sentiment score", range: "−100 → +100" },
    { name: "News count", range: "≥ 1", note: "empty sectors excluded" },
  ],
  interpretation: [
    { band: "Score ≥ +40", label: "Strongly bullish", meaning: "Wide, consistent positive flow.", tone: "good" },
    { band: "Score +13 → +39", label: "Bullish",     meaning: "Net positive across the visible headlines.", tone: "good" },
    { band: "Score ≤ +12", label: "Best of a flat day", meaning: "Even the leader is neutral. Probably nothing really bullish right now.", tone: "info" },
  ],
  whereSeen: ["Overview KPI strip"],
  related: ["sentiment-score", "bullish"],
};

const CRITICAL: LogicExplainer = {
  id: "critical-alerts",
  title: "Critical Alerts",
  shortLabel: "Critical",
  category: "Highlights",
  range: "Count",
  icon: AlertTriangle,
  accent: "#FB7185",
  oneLiner: "Headlines tagged with Critical urgency under the current filters.",
  whatIs:
    "A live count of headlines whose Urgency = Critical. These are the items that typically need an immediate read: regulator actions, trading halts, recalls, big blow-ups, fires, accidents. The secondary line on the card is the average impact across just those critical items.",
  howCalculated:
    "count     = | { n ∈ filteredNews : n.urgency = 'Critical' } |\navgImpact = mean( impactScore over the same set )",
  inputs: [
    { name: "Urgency", range: "Critical only" },
    { name: "Active filters", range: "—" },
  ],
  interpretation: [
    { band: "0",        label: "Quiet",       meaning: "No critical items in view. Day is calm — or filters are too tight.", tone: "info" },
    { band: "1 – 3",    label: "Watch",       meaning: "A handful of high-urgency items. Read them.", tone: "warn" },
    { band: "4+",       label: "Heads up",    meaning: "Real cluster of critical events. Likely a sector-wide story.", tone: "bad" },
  ],
  whereSeen: ["Overview KPI strip", "Hover for per-sector breakdown"],
  related: ["urgency", "impact"],
};

const IMPACT: LogicExplainer = {
  id: "impact",
  title: "Impact Score",
  shortLabel: "Impact",
  category: "Per-headline signals",
  range: "0 – 10",
  icon: Zap,
  accent: "#E5C07B",
  oneLiner: "How market-moving a single headline is.",
  whatIs:
    "An integer 1–10 assigned to every headline. 1 is immaterial; 10 is genuinely market-moving. Built from a base (4 for Neutral, 6 for directional) plus structured bumps for money mentions, superlatives, deal language, and shock words.",
  howCalculated:
    "base = 4 if Neutral else 6\n\nmoney:\n  ≥ ₹10,000 cr             → +3\n  ≥ ₹1,000 cr              → +2\n  ≥ ₹100 cr                → +1\n  ≥ USD 500 mn             → +2\n  ≥ USD 50 mn              → +1\n\nconviction language:\n  record / largest / first  → +2\n  delivered / launched      → +1\n  order win / contract      → +1\n  acquisition / M&A         → +2\n  approval / certified      → +1\n\nbearish amplifiers:\n  recall / halt / fire …    → +2\n  miss / decline / drop     → +1\n\nsoft / vague cues:\n  MoU / partnership (no $)  → −1\n  plan / proposal / may     → −1\n\ncompanies impacted:\n  ≥ 8 named                 → +1\n  none named                → −1\n\nfinal = clamp(round(score), 1, 10)",
  inputs: [
    { name: "Headline + 'Key Datapoint' + 'News Type' text", range: "free text" },
    { name: "Companies Impacted (count)", range: "0 – ∞" },
    { name: "Sentiment", range: "Bull/Bear/Neutral" },
  ],
  interpretation: [
    { band: "9 – 10", label: "Market-moving", meaning: "Headlines you'd page someone for. Mega-orders, recalls, regulator action.", tone: "bad" },
    { band: "7 – 8",  label: "Material",      meaning: "Real news that should be in the morning brief.", tone: "warn" },
    { band: "4 – 6",  label: "Notable",       meaning: "Worth reading but probably won't move prices on its own.", tone: "info" },
    { band: "1 – 3",  label: "Background",    meaning: "Color / context, low urgency.", tone: "info" },
  ],
  example:
    "'L&T wins ₹15,000 cr defence order' → base 6 + ₹10k cr (+3) + 'order win' (+1) = 10.",
  whereSeen: ["Every headline row", "Sector card", "Heat Score input", "Sentiment input", "Ranking input"],
  related: ["urgency", "sentiment-score", "heat"],
};

const URGENCY: LogicExplainer = {
  id: "urgency",
  title: "Urgency",
  shortLabel: "Urgency",
  category: "Per-headline signals",
  range: "Low → Critical",
  icon: Siren,
  accent: "#FB7185",
  oneLiner: "How quickly a headline needs to be acted on.",
  whatIs:
    "Four-step label that says how fast this matters. Distinct from Impact: a big M&A is high impact but rarely Critical urgency; a small recall is moderate impact but always Critical urgency.",
  howCalculated:
    "Critical: emergency | crisis | halt | recall | ban | suspend |\n          fire | accident | grounded\n\nHigh:     Bearish AND (miss | fall | decline | de-growth | probe)\n          OR (record | delivery | inducted | Q1–Q4 results |\n              earnings | order win | contract)\n\nLow:      MoU | intent | exploring | partnership signed |\n          capex plan | proposal\n\nMedium:   everything else (default)",
  inputs: [
    { name: "Headline + News Type text", range: "free text" },
    { name: "Sentiment", range: "Bull/Bear/Neutral", note: "only Bearish triggers the 'miss/decline' High path" },
  ],
  interpretation: [
    { band: "Critical", label: "Critical", meaning: "Act now. Recalls, halts, accidents, bans.", tone: "bad" },
    { band: "High",     label: "High",     meaning: "Read today. Earnings, big orders, deliveries, misses.", tone: "warn" },
    { band: "Medium",   label: "Medium",   meaning: "Standard flow — useful context.", tone: "info" },
    { band: "Low",      label: "Low",      meaning: "Soft cues — MoUs, intents, plans. May come to nothing.", tone: "info" },
  ],
  whereSeen: ["Headline badges", "Critical Alerts KPI", "Heat Score input", "Ranking input"],
  related: ["impact", "critical-alerts", "heat"],
};

const RECENCY: LogicExplainer = {
  id: "recency",
  title: "Recency Weight",
  shortLabel: "Recency",
  category: "Per-headline signals",
  range: "0.1 – 1.0",
  icon: Clock,
  accent: "#A78BFA",
  oneLiner: "Step-decay weight by how old a headline is.",
  whatIs:
    "Every headline gets a freshness multiplier between 0.1 and 1.0. It feeds into Heat, Sentiment and Ranking so stale news doesn't drown out fresh news. The decay is a step curve, not exponential — small enough to be predictable.",
  howCalculated:
    "ageH = max(0, (now − publishedAt) / 1 hour)\n\nrecency =\n  1.00   if ageH ≤ 1\n  0.92   if ageH ≤ 6\n  0.78   if ageH ≤ 24\n  0.55   if ageH ≤ 72\n  0.30   if ageH ≤ 168   (7 days)\n  0.10   otherwise",
  inputs: [
    { name: "publishedAt", range: "ISO timestamp" },
    { name: "now", range: "Date.now()" },
  ],
  interpretation: [
    { band: "1.00", label: "Last hour",   meaning: "Fully credited everywhere.", tone: "good" },
    { band: "0.78 – 0.92", label: "Today",      meaning: "Still very relevant.", tone: "good" },
    { band: "0.55", label: "1–3 days",   meaning: "Discounted but visible.", tone: "info" },
    { band: "0.30", label: "Within a week", meaning: "Background context.", tone: "info" },
    { band: "0.10", label: "Older",      meaning: "Near-zero weight. Won't move scores.", tone: "info" },
  ],
  whereSeen: ["Heat Score", "Sentiment Score", "News Ranking"],
  related: ["heat", "sentiment-score", "ranking"],
};

const CONFIDENCE: LogicExplainer = {
  id: "confidence",
  title: "Source Confidence",
  shortLabel: "Confidence",
  category: "Per-headline signals",
  range: "0 – 100",
  icon: ShieldCheck,
  accent: "#5EEAD4",
  oneLiner: "How much we trust the source the headline came from.",
  whatIs:
    "Set deterministically from the Source Type. A regulator's circular gets 95; a social-media post gets 55. Used inside Heat and Sentiment so low-trust sources can't single-handedly swing a sector.",
  howCalculated:
    "by sourceType:\n  Government        96\n  Regulator         95\n  Exchange          93\n  Industry Body     90\n  Company Filing    88\n  Newswire          85\n  Tier-1 Media      80\n  Brokerage         78\n  Trade Publication 70\n  Social            55\n  (unknown)         75",
  inputs: [
    { name: "Source name", range: "free text", note: "matched against keyword sets to pick a type" },
  ],
  interpretation: [
    { band: "90 – 100", label: "Official",    meaning: "Government, regulator, exchange. Treat as fact.", tone: "good" },
    { band: "78 – 89",  label: "Trusted",     meaning: "Company filings, newswires, Tier-1 media.", tone: "good" },
    { band: "60 – 77",  label: "Useful",      meaning: "Brokerages, trade publications. Read with attribution in mind.", tone: "info" },
    { band: "< 60",     label: "Soft",        meaning: "Social posts. Useful for early signals, light on certainty.", tone: "warn" },
  ],
  whereSeen: ["Heat Score input", "Sentiment Score input", "News Ranking input"],
  related: ["heat", "sentiment-score", "ranking"],
};

const TIME_HORIZON: LogicExplainer = {
  id: "time-horizon",
  title: "Time Horizon",
  shortLabel: "Horizon",
  category: "Per-headline signals",
  range: "Immediate → Long-term",
  icon: CalendarRange,
  accent: "#7DD3FC",
  oneLiner: "Over what window the headline is expected to play out.",
  whatIs:
    "Tells you whether a headline matters this week or this decade. Driven by keywords in the headline plus the agent's 'Why It Matters' and 'News Type' columns.",
  howCalculated:
    "Immediate:  immediate | today | this week | Q1–Q4 results | earnings\nShort-term: short-term | next quarter | H1/H2 FY\nLong-term:  long-term | multi-year | 5/7/10-year |\n            JV | joint venture | strategic\nMedium:     default",
  inputs: [
    { name: "Headline + Why It Matters + News Type text", range: "free text" },
  ],
  interpretation: [
    { band: "Immediate",   label: "Days",   meaning: "Trade / position this week.", tone: "warn" },
    { band: "Short-term",  label: "Weeks → 1 quarter", meaning: "Plays out in the next earnings cycle.", tone: "info" },
    { band: "Medium-term", label: "Quarters",        meaning: "1–4 quarters out.", tone: "info" },
    { band: "Long-term",   label: "Years",           meaning: "Strategic, multi-year. Capex, JVs, regulation.", tone: "info" },
  ],
  whereSeen: ["Filter bar", "Headline detail"],
  related: ["impact", "urgency"],
};

const RANKING: LogicExplainer = {
  id: "ranking",
  title: "News Ranking",
  shortLabel: "Ranking",
  category: "Ordering",
  range: "Higher = top",
  icon: ArrowDownUp,
  accent: "#A78BFA",
  oneLiner: "The order headlines appear in feeds.",
  whatIs:
    "Per-item score that sorts every news list on the dashboard. Pulls in the same primitives as Heat, just at the headline level instead of the sector level: impact, urgency, recency, source confidence and a small bump for directional sentiment.",
  howCalculated:
    "rank = impact × 10\n     + urgency × 6\n     + recency × 5\n     + (confidence / 100) × 3\n     + |sentiment| × 1.5\n\n(sorted descending)",
  inputs: [
    { name: "Impact", range: "0 – 10" },
    { name: "Urgency", range: "0.25 – 1.0" },
    { name: "Recency", range: "0.1 – 1.0" },
    { name: "Source confidence", range: "0 – 100" },
    { name: "Sentiment magnitude", range: "0 or 1" },
  ],
  interpretation: [
    { band: "Top of feed", label: "High rank",   meaning: "Big impact, urgent, fresh and from a trusted source.", tone: "bad" },
    { band: "Mid",         label: "Standard",    meaning: "Useful context — not the headline of the day.", tone: "info" },
    { band: "Bottom",      label: "Low rank",    meaning: "Old, soft, low-impact. Still searchable, just deprioritised.", tone: "info" },
  ],
  example:
    "Impact 9, Urgency Critical (1.0), 30 min old (1.0), Regulator source (0.95), Bearish (1) → 90 + 6 + 5 + 2.85 + 1.5 ≈ 105.4 → top of feed.",
  whereSeen: ["Every news feed", "Sector card top news", "Sector detail feed"],
  related: ["impact", "urgency", "recency", "confidence"],
};

const AVG_IMPACT: LogicExplainer = {
  id: "avg-impact",
  title: "Average Impact",
  shortLabel: "Avg impact",
  category: "Highlights",
  range: "0 – 10",
  icon: Gauge,
  accent: "#E5C07B",
  oneLiner: "Mean impact across the visible headlines.",
  whatIs:
    "Simple average of impactScore across the headlines counted in a card. Used as the secondary line in cards like Critical Alerts — count tells you how many; avg impact tells you how heavy each one is.",
  howCalculated: "avgImpact = sum(impactScore) / count",
  inputs: [{ name: "Impact", range: "0 – 10", note: "per headline" }],
  interpretation: [
    { band: "≥ 8.0", label: "Heavy",  meaning: "These aren't routine items — most are material.", tone: "bad" },
    { band: "6.0 – 7.9", label: "Solid",  meaning: "Material news on average.", tone: "warn" },
    { band: "4.0 – 5.9", label: "Mixed",  meaning: "Mix of material and notable items.", tone: "info" },
    { band: "< 4.0", label: "Light",  meaning: "Mostly background / soft cues.", tone: "info" },
  ],
  whereSeen: ["Critical Alerts card"],
  related: ["impact", "critical-alerts"],
};

export const LOGIC_EXPLAINERS: LogicExplainer[] = [
  HEAT,
  SENTIMENT_SCORE,
  BULLISH,
  BEARISH,
  NEUTRAL,
  HOTTEST,
  MOST_BULLISH,
  CRITICAL,
  AVG_IMPACT,
  IMPACT,
  URGENCY,
  RECENCY,
  CONFIDENCE,
  TIME_HORIZON,
  RANKING,
];

export const LOGIC_BY_ID: Record<string, LogicExplainer> = Object.fromEntries(
  LOGIC_EXPLAINERS.map((e) => [e.id, e])
);

export const LOGIC_CATEGORIES: LogicCategory[] = [
  "Sector scores",
  "Sentiment",
  "Highlights",
  "Per-headline signals",
  "Ordering",
];
