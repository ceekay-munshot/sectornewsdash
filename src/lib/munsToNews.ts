import type { MunsNewsRow } from "./munsParse";
import type { NewsItem, Sentiment, SourceType, Theme } from "../types";

const themeFromText = (text: string): Theme => {
  const lower = text.toLowerCase();
  if (/(policy|gst|tax|tariff|incentive|fame|pli)/.test(lower)) return "Policy";
  if (/(regulation|rule|notification|compliance|sebi|rbi)/.test(lower)) return "Regulation";
  if (/(earnings|results|profit|revenue|turnover|margin|q[1-4])/.test(lower)) return "Earnings";
  if (/(order|contract|win|deal|booking|backlog)/.test(lower)) return "Order Wins";
  if (/(export|overseas|foreign)/.test(lower)) return "Exports";
  if (/(import|customs)/.test(lower)) return "Imports";
  if (/(acquisition|m&a|merger|stake|takeover|jv|joint venture)/.test(lower)) return "M&A";
  if (/(supply|sourcing|chain|component|raw material)/.test(lower)) return "Supply Chain";
  if (/(capex|plant|facility|capacity|investment)/.test(lower)) return "Capex";
  if (/(price|pricing|asp|hike|cut)/.test(lower)) return "Pricing";
  if (/(litigation|lawsuit|case|court|penalty)/.test(lower)) return "Litigation";
  if (/(global|macro|inflation|currency|geopolitical)/.test(lower)) return "Global Macro";
  return "Demand";
};

const sentimentFromImpact = (impact: string): Sentiment => {
  const lower = impact.toLowerCase();
  if (lower.includes("negative")) return "Bearish";
  if (lower.includes("positive")) return "Bullish";
  return "Neutral";
};

const sourceTypeFromName = (raw: string): SourceType => {
  const lower = raw.toLowerCase();
  if (/(siam|fada|acma|industry|association)/.test(lower)) return "Industry Body";
  if (/(pib|drdo|government|vahan|morth|mhi|ministry|parivahan)/.test(lower)) return "Government";
  if (/(sebi|rbi|tra)/.test(lower)) return "Regulator";
  if (/(nse|bse|exchange disclosure)/.test(lower)) return "Exchange";
  if (/press release|filing/.test(lower)) return "Company Filing";
  if (/(brokerage|research|securities|capital)/.test(lower)) return "Brokerage";
  if (/(twitter|x\.com|linkedin|social)/.test(lower)) return "Social";
  return "Tier-1 Media";
};

// Accepts "28-Apr-2026", "2026-04-28", "Apr 28, 2026", "28 Apr 2026", etc.
// Returns ISO string. Falls back to today if unparseable.
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

  const impactScore =
    sentiment === "Bullish" ? 8 : sentiment === "Bearish" ? 7 : 5;
  const sourceConfidence = sourceTypeFromName(row.source) === "Government" ||
    sourceTypeFromName(row.source) === "Industry Body"
    ? 92
    : 78;

  return {
    id: `muns-${sectorId}-${index}`,
    headline: row.headline,
    summary: datapoint || whyItMatters,
    sector: sectorId,
    subsector: segment,
    theme: themeFromText(`${newsType} ${segment} ${row.headline}`),
    sentiment,
    impactScore,
    urgency: "Medium",
    source: row.source,
    sourceType: sourceTypeFromName(row.source),
    sourceConfidence,
    publishedAt: parseDateToIso(row.date),
    affectedCompanies: splitCompanies(row.raw["Companies Impacted"] || ""),
    kpiAffected: [],
    timeHorizon: "Medium-term",
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
