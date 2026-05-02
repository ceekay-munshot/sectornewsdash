import type { MunsNewsRow } from "./munsParse";
import type {
  NewsItem,
  Sentiment,
  SourceType,
  Theme,
  TimeHorizon,
  Urgency,
} from "../types";
import { clamp } from "./utils";

// ---- Theme inference -------------------------------------------------------

const themeFromText = (text: string): Theme => {
  const lower = text.toLowerCase();
  if (/(policy|gst|tax|tariff|incentive|fame|pli|subsidy)/.test(lower)) return "Policy";
  if (/(regulation|rule|notification|compliance|sebi|rbi|approval|circular)/.test(lower)) return "Regulation";
  if (/(earnings|results|profit|revenue|turnover|margin|q[1-4]|h[12])/.test(lower)) return "Earnings";
  if (/(order|contract|win|deal|booking|backlog)/.test(lower)) return "Order Wins";
  if (/(export|overseas|foreign)/.test(lower)) return "Exports";
  if (/(import|customs)/.test(lower)) return "Imports";
  if (/(acquisition|m&a|merger|stake|takeover|jv|joint venture)/.test(lower)) return "M&A";
  if (/(supply|sourcing|chain|component|raw material|indigenis|indigeniz)/.test(lower)) return "Supply Chain";
  if (/(capex|plant|facility|capacity|investment|expansion)/.test(lower)) return "Capex";
  if (/(price|pricing|asp|hike|cut)/.test(lower)) return "Pricing";
  if (/(litigation|lawsuit|case|court|penalty|fine)/.test(lower)) return "Litigation";
  if (/(global|macro|inflation|currency|geopolitical)/.test(lower)) return "Global Macro";
  return "Demand";
};

// ---- Sentiment from Impact column -----------------------------------------

const sentimentFromImpact = (impact: string): Sentiment => {
  const lower = impact.toLowerCase();
  if (lower.includes("negative")) return "Bearish";
  if (lower.includes("mixed") && !lower.includes("positive")) return "Neutral";
  if (lower.includes("positive") || lower.includes("mixed positive")) return "Bullish";
  return "Neutral";
};

// ---- Source typing & confidence -------------------------------------------

const sourceTypeFromName = (raw: string): SourceType => {
  const lower = raw.toLowerCase();
  if (/(siam|fada|acma|industry body|association)/.test(lower)) return "Industry Body";
  if (/(pib|drdo|vahan|morth|mhi|ministry|parivahan|government|defence ministry)/.test(lower)) return "Government";
  if (/(sebi|rbi|trai|cci|cag)/.test(lower)) return "Regulator";
  if (/(nse|bse|exchange disclosure|stock exchange)/.test(lower)) return "Exchange";
  if (/(press release|filing|stock disclosure)/.test(lower)) return "Company Filing";
  if (/(brokerage|research|securities|capital|broking)/.test(lower)) return "Brokerage";
  if (/(twitter|x\.com|linkedin|social)/.test(lower)) return "Social";
  if (/(rushlane|autocarpro|trendlyne|trade)/.test(lower)) return "Trade Publication";
  return "Tier-1 Media";
};

const sourceConfidenceFor = (sourceType: SourceType): number => {
  switch (sourceType) {
    case "Government": return 96;
    case "Regulator": return 95;
    case "Exchange": return 93;
    case "Industry Body": return 90;
    case "Company Filing": return 88;
    case "Newswire": return 85;
    case "Tier-1 Media": return 80;
    case "Brokerage": return 78;
    case "Trade Publication": return 70;
    case "Social": return 55;
    default: return 75;
  }
};

// ---- Quantitative cues from headline / datapoint --------------------------

// Large rupee amount (₹X crore / X crore / Rs X cr) — return amount in crore.
const extractCroreAmount = (text: string): number => {
  let max = 0;
  const re = /(?:₹|rs\.?\s*)?\s*([\d,]+(?:\.\d+)?)\s*(crore|cr|lakh\s*crore)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = parseFloat(m[1].replace(/,/g, ""));
    const mult = /lakh/i.test(m[2]) ? 100000 : 1; // lakh-crore = 1e5 crore
    if (!Number.isNaN(n) && n * mult > max) max = n * mult;
  }
  return max;
};

const extractUsdMillion = (text: string): number => {
  let max = 0;
  const re = /usd\s*([\d,]+(?:\.\d+)?)\s*(million|mn|billion|bn)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = parseFloat(m[1].replace(/,/g, ""));
    const mult = /b/i.test(m[2]) ? 1000 : 1;
    if (!Number.isNaN(n) && n * mult > max) max = n * mult;
  }
  return max;
};

// ---- Impact score ---------------------------------------------------------

const computeImpactScore = (row: MunsNewsRow, sentiment: Sentiment): number => {
  const blob = `${row.headline} ${row.raw["Key Datapoint / Event"] || ""} ${row.raw["News Type"] || ""}`;
  const lower = blob.toLowerCase();

  let score = sentiment === "Neutral" ? 4 : 6;

  // Money mentioned
  const crore = extractCroreAmount(blob);
  if (crore >= 10000) score += 3;
  else if (crore >= 1000) score += 2;
  else if (crore >= 100) score += 1;
  const usdMn = extractUsdMillion(blob);
  if (usdMn >= 500) score += 2;
  else if (usdMn >= 50) score += 1;

  // Strong execution/superlative cues
  if (/(record|largest|biggest|all[\s-]?time|first[\s-]?ever|milestone)/.test(lower)) score += 2;
  if (/(delivered|delivery|inducted|launch|commission|production milestone)/.test(lower)) score += 1;
  if (/(order win|order|contract|backlog|pact|deal)/.test(lower)) score += 1;
  if (/(acquisition|stake|takeover|merger|m&a)/.test(lower)) score += 2;
  if (/(approval|approved|cleared|certified)/.test(lower)) score += 1;

  // Soft cues that reduce conviction
  if (/(mou|intent|exploring|in talks|partnership signed|signs strategic mou)/.test(lower) &&
      !/(crore|million|usd)/.test(lower)) {
    score -= 1;
  }
  if (/(plan|proposal|seeks|considering|may|might)/.test(lower)) score -= 1;

  // Negative event amplifiers
  if (sentiment === "Bearish") {
    if (/(recall|halt|suspend|ban|crisis|fraud|probe|fire|accident)/.test(lower)) score += 2;
    if (/(miss|below estimates|de-?growth|decline|fall|drop)/.test(lower)) score += 1;
  }

  // Number of companies impacted broadens relevance
  const companyCount = (row.raw["Companies Impacted"] || "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean).length;
  if (companyCount >= 8) score += 1;
  else if (companyCount === 0) score -= 1;

  return clamp(Math.round(score), 1, 10);
};

// ---- Urgency --------------------------------------------------------------

const computeUrgency = (row: MunsNewsRow, sentiment: Sentiment): Urgency => {
  const blob = `${row.headline} ${row.raw["News Type"] || ""}`.toLowerCase();
  if (/(emergency|crisis|halt|recall|ban|suspend|fire|accident|grounded)/.test(blob)) return "Critical";
  if (sentiment === "Bearish" && /(miss|fall|decline|de-?growth|probe)/.test(blob)) return "High";
  if (/(record|delivery|inducted|q[1-4]\s*results|earnings|order win|contract)/.test(blob)) return "High";
  if (/(mou|intent|exploring|partnership signed|capex plan|proposal)/.test(blob)) return "Low";
  return "Medium";
};

// ---- Time horizon ---------------------------------------------------------

const computeTimeHorizon = (row: MunsNewsRow): TimeHorizon => {
  const blob = `${row.headline} ${row.raw["Why It Matters"] || ""} ${row.raw["News Type"] || ""}`.toLowerCase();
  if (/(immediate|today|this week|q[1-4]\s*results|earnings)/.test(blob)) return "Immediate";
  if (/(short[\s-]?term|next quarter|h[12]\s*fy)/.test(blob)) return "Short-term";
  if (/(long[\s-]?term|multi[\s-]?year|5[\s-]?year|7[\s-]?year|10[\s-]?year|jv|joint venture|strategic)/.test(blob)) return "Long-term";
  return "Medium-term";
};

// ---- Date parsing ---------------------------------------------------------

const parseDateToIso = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return new Date().toISOString();
  const candidates = [
    trimmed,
    trimmed.replace(/(\d{1,2})-([A-Za-z]{3,})-(\d{4})/, "$2 $1, $3"),
    trimmed.replace(/(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/, "$2 $1, $3"),
  ];
  for (const c of candidates) {
    const d = new Date(c);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
};

const splitCompanies = (raw: string): string[] =>
  raw
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 12);

// ---- Public API -----------------------------------------------------------

export const munsRowToNewsItem = (
  row: MunsNewsRow,
  sectorId: string,
  index: number,
): NewsItem => {
  const segment = row.raw["Segment"] || "";
  const newsType = row.raw["News Type"] || "";
  const datapoint = row.raw["Key Datapoint / Event"] || "";
  const whyItMatters = row.raw["Why It Matters"] || datapoint;
  const impact = row.raw["Impact"] || "";
  const sentiment = sentimentFromImpact(impact);
  const sourceType = sourceTypeFromName(row.source);

  return {
    id: `muns-${sectorId}-${index}`,
    headline: row.headline,
    summary: datapoint || whyItMatters,
    sector: sectorId,
    subsector: segment,
    theme: themeFromText(`${newsType} ${segment} ${row.headline}`),
    sentiment,
    impactScore: computeImpactScore(row, sentiment),
    urgency: computeUrgency(row, sentiment),
    source: row.source,
    sourceType,
    sourceConfidence: sourceConfidenceFor(sourceType),
    publishedAt: parseDateToIso(row.date),
    affectedCompanies: splitCompanies(row.raw["Companies Impacted"] || ""),
    kpiAffected: [],
    timeHorizon: computeTimeHorizon(row),
    whyItMatters,
    bullCase: sentiment === "Bullish" ? whyItMatters : "",
    bearCase: sentiment === "Bearish" ? whyItMatters : "",
    relatedCatalyst: datapoint,
    newsUrl: row.link,
  };
};

export const munsRowsToNewsItems = (
  rows: MunsNewsRow[],
  sectorId: string,
): NewsItem[] => rows.map((row, idx) => munsRowToNewsItem(row, sectorId, idx));
