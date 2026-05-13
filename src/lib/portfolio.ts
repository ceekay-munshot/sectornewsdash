// "My portfolio" — local-only set of holdings the user pastes in or
// picks from sector defaults. Everything lives in localStorage; no
// server-side persistence (yet). The same shape feeds the KPI strip,
// sector breakdown donut, concentration callout and filtered news feed
// inside the Portfolio tab.

import type { NewsItem, SectorMeta } from "../types";
import { SECTORS, SECTOR_BY_ID } from "../data/sectors";
import NSE_COMPANIES from "../data/nse-companies.json";

const KEY = "snr.portfolio.v1";

export interface PortfolioHolding {
  company: string;          // canonical name as typed / chosen
  quantity?: number;        // optional position size in shares
  avgPrice?: number;        // optional cost basis in INR
  sectorId?: string;        // derived: which sector list this came from
}

export interface PortfolioBreakdownRow {
  sectorId: string;
  sector: SectorMeta;
  holdings: PortfolioHolding[];
  positionWeight: number;   // 0..1 share of total position value
  count: number;            // # of holdings in this sector
}

export interface PortfolioSummary {
  holdings: PortfolioHolding[];
  totalValue: number;       // Σ quantity × avgPrice; 0 if unknown
  hasValueData: boolean;    // true when every holding has both qty & avgPrice
  rows: PortfolioBreakdownRow[];  // per-sector breakdown
  unmapped: PortfolioHolding[];   // holdings we couldn't tie to a sector
  weightedHeat: number;     // 0..100 weighted by position size (or count)
  /** Headlines that name a holding outright. */
  directHits: NewsItem[];
  /** Headlines in a sector the user has exposure to, but don't name a
   *  specific holding — "your sector is in play" tape. */
  sectorHits: NewsItem[];
  /** Backward-compat alias: directHits + sectorHits, in that order. */
  matchedNews: NewsItem[];
  /** Total of directHits + sectorHits. */
  headlineCount: number;
}

// ---- persistence ---------------------------------------------------------

export function loadPortfolio(): PortfolioHolding[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: PortfolioHolding[] = [];
    for (const x of parsed) {
      if (!x || typeof x !== "object") continue;
      const company = typeof x.company === "string" ? x.company.trim() : "";
      if (!company) continue;
      const h: PortfolioHolding = { company };
      if (typeof x.quantity === "number" && Number.isFinite(x.quantity))
        h.quantity = x.quantity;
      if (typeof x.avgPrice === "number" && Number.isFinite(x.avgPrice))
        h.avgPrice = x.avgPrice;
      if (typeof x.sectorId === "string") h.sectorId = x.sectorId;
      out.push(h);
    }
    return out;
  } catch {
    return [];
  }
}

export function savePortfolio(holdings: PortfolioHolding[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(holdings));
  } catch {
    // privacy mode / quota
  }
}

// ---- CSV parsing ---------------------------------------------------------

// Accept either:
//   • plain newline-separated company names
//   • or CSV with optional header row, columns: Company, Quantity, AvgPrice
// Tolerant of ₹ / Rs prefixes, comma thousand-separators, and BOM.
export function parsePortfolioCSV(text: string): PortfolioHolding[] {
  const cleaned = text.replace(/^﻿/, "").trim();
  if (!cleaned) return [];
  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  // Detect header: if first row's first cell is "company"/"name"/"ticker" etc.
  const firstCells = splitRow(lines[0]);
  const headerHints = ["company", "name", "ticker", "stock", "symbol"];
  const hasHeader = firstCells.length > 0 &&
    headerHints.some((h) => firstCells[0].toLowerCase().includes(h));
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const out: PortfolioHolding[] = [];
  for (const line of dataLines) {
    const cells = splitRow(line);
    const company = cells[0]?.trim();
    if (!company) continue;
    const h: PortfolioHolding = { company };
    if (cells[1]) {
      const n = parseNumber(cells[1]);
      if (n !== null && n > 0) h.quantity = n;
    }
    if (cells[2]) {
      const n = parseNumber(cells[2]);
      if (n !== null && n > 0) h.avgPrice = n;
    }
    out.push(h);
  }
  return out;
}

function splitRow(line: string): string[] {
  // Naive CSV split — fine because holdings rarely contain quoted commas.
  return line.split(/[,\t]/).map((s) => s.trim());
}

function parseNumber(s: string): number | null {
  const cleaned = s.replace(/[₹$rs.,\s]+/gi, "").replace(/[^\d.\-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// ---- sector mapping ------------------------------------------------------

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9&]+/g, "");
}

interface NseCompanyEntry {
  name: string;
  symbol: string;
  sector_id: string | null;
}

const NSE_BY_KEY: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const c of NSE_COMPANIES as NseCompanyEntry[]) {
    if (!c.sector_id) continue;
    // index by both full name and ticker symbol
    const nk = normalize(c.name);
    if (nk) m.set(nk, c.sector_id);
    const sk = normalize(c.symbol);
    if (sk) m.set(sk, c.sector_id);
    // Also strip common suffixes ("Ltd.", "Limited", "Co.")
    const trimmedName = c.name
      .replace(/\b(ltd\.?|limited|co\.|corp\.?|corporation|inc\.?)\b/gi, "")
      .trim();
    const tk = normalize(trimmedName);
    if (tk && tk !== nk) m.set(tk, c.sector_id);
  }
  return m;
})();

// Curated sector → company map from src/data/sectors.ts. Acts as a
// fallback when a holding isn't in the NSE Nifty 500 snapshot.
const CURATED_BY_KEY: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const s of SECTORS) {
    for (const c of s.companies) {
      m.set(normalize(c), s.id);
    }
  }
  return m;
})();

/**
 * Best-effort sector mapping for a holding name. Priority:
 *   1. Exact match in the NSE Nifty 500 snapshot (by name or ticker)
 *   2. Exact match in the curated sectors.ts list
 *   3. Fuzzy substring match across both — handles "Maruti Suzuki" ↔
 *      "Maruti" both ways
 */
export function findSectorForCompany(name: string): string | undefined {
  const key = normalize(name);
  if (!key) return undefined;
  if (NSE_BY_KEY.has(key)) return NSE_BY_KEY.get(key);
  if (CURATED_BY_KEY.has(key)) return CURATED_BY_KEY.get(key);
  // Fuzzy — prefer NSE matches over curated.
  for (const [k, sid] of NSE_BY_KEY) {
    if (k.length < 3) continue;
    if (k.includes(key) || key.includes(k)) return sid;
  }
  for (const [k, sid] of CURATED_BY_KEY) {
    if (k.length < 3) continue;
    if (k.includes(key) || key.includes(k)) return sid;
  }
  return undefined;
}

/** Full NSE Nifty 500 list — exposed for quick-pick / autocomplete UIs. */
export const NSE_COMPANY_LIST: NseCompanyEntry[] =
  NSE_COMPANIES as NseCompanyEntry[];

// ---- news matching -------------------------------------------------------

/** Does this news item touch any holding in the portfolio? */
export function newsTouchesPortfolio(
  n: NewsItem,
  holdings: PortfolioHolding[]
): boolean {
  if (holdings.length === 0) return false;
  const haystack = (
    n.headline +
    " " +
    (n.affectedCompanies || []).join(" ")
  ).toLowerCase();
  for (const h of holdings) {
    const needle = h.company.toLowerCase().trim();
    if (!needle || needle.length < 2) continue;
    if (haystack.includes(needle)) return true;
  }
  return false;
}

// ---- aggregate summary ---------------------------------------------------

export function buildPortfolioSummary(
  rawHoldings: PortfolioHolding[],
  livePool: NewsItem[],
  sectorHeatById: Map<string, { heat: number; newsCount: number }>
): PortfolioSummary {
  // 1. Resolve sectors and per-holding position values.
  const holdings: PortfolioHolding[] = rawHoldings.map((h) => ({
    ...h,
    sectorId: h.sectorId ?? findSectorForCompany(h.company),
  }));

  const hasValueData =
    holdings.length > 0 &&
    holdings.every(
      (h) =>
        typeof h.quantity === "number" &&
        h.quantity > 0 &&
        typeof h.avgPrice === "number" &&
        h.avgPrice > 0
    );

  const totalValue = hasValueData
    ? holdings.reduce((s, h) => s + (h.quantity! * h.avgPrice!), 0)
    : 0;

  // 2. Group by sector (skip unmapped).
  const buckets = new Map<string, PortfolioHolding[]>();
  const unmapped: PortfolioHolding[] = [];
  for (const h of holdings) {
    if (!h.sectorId) {
      unmapped.push(h);
      continue;
    }
    if (!buckets.has(h.sectorId)) buckets.set(h.sectorId, []);
    buckets.get(h.sectorId)!.push(h);
  }

  const rows: PortfolioBreakdownRow[] = [];
  for (const [sectorId, items] of buckets) {
    const sector = SECTOR_BY_ID[sectorId];
    if (!sector) continue;
    let weight = 0;
    if (hasValueData && totalValue > 0) {
      const sectorVal = items.reduce(
        (s, h) => s + h.quantity! * h.avgPrice!,
        0
      );
      weight = sectorVal / totalValue;
    } else {
      weight = items.length / holdings.length;
    }
    rows.push({
      sectorId,
      sector,
      holdings: items,
      positionWeight: weight,
      count: items.length,
    });
  }
  rows.sort((a, b) => b.positionWeight - a.positionWeight);

  // 3. Weighted heat — Σ(weight × sectorHeat) over mapped sectors.
  let weightedHeat = 0;
  let totalUsedWeight = 0;
  for (const r of rows) {
    const h = sectorHeatById.get(r.sectorId);
    if (!h) continue;
    weightedHeat += r.positionWeight * h.heat;
    totalUsedWeight += r.positionWeight;
  }
  weightedHeat = totalUsedWeight > 0 ? Math.round(weightedHeat / totalUsedWeight) : 0;

  // 4. Matched news — bucketed into direct hits vs sector tape so the UI
  //    can answer "what hit my stocks?" separately from "what's moving in
  //    sectors I'm exposed to?".
  const portfolioSectorIds = new Set(rows.map((r) => r.sectorId));
  const directHits: NewsItem[] = [];
  const sectorHits: NewsItem[] = [];
  for (const n of livePool) {
    if (newsTouchesPortfolio(n, holdings)) {
      directHits.push(n);
    } else if (portfolioSectorIds.has(n.sector)) {
      sectorHits.push(n);
    }
  }

  return {
    holdings,
    totalValue,
    hasValueData,
    rows,
    unmapped,
    weightedHeat,
    directHits,
    sectorHits,
    matchedNews: [...directHits, ...sectorHits],
    headlineCount: directHits.length + sectorHits.length,
  };
}
