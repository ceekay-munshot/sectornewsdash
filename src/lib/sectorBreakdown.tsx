import { createContext, useContext, type ReactNode } from "react";
import type { NewsItem } from "../types";
import { SECTOR_BY_ID } from "../data/sectors";

export interface SectorBreakdown {
  sectorId: string;
  sectorName: string;
  shortName: string;
  heatScore: number;
  bullish: number;
  neutral: number;
  bearish: number;
  total: number;
}

const Ctx = createContext<Record<string, SectorBreakdown>>({});

export function SectorBreakdownProvider({
  value,
  children,
}: {
  value: Record<string, SectorBreakdown>;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSectorBreakdown(
  sectorId: string
): SectorBreakdown | undefined {
  return useContext(Ctx)[sectorId];
}

/** Build per-sector sentiment counts from a news pool, keyed by sector id. */
export function buildSectorBreakdowns(
  news: NewsItem[],
  heatBySector: Record<string, number>
): Record<string, SectorBreakdown> {
  const map: Record<string, SectorBreakdown> = {};
  for (const n of news) {
    const meta = SECTOR_BY_ID[n.sector];
    if (!meta) continue;
    let entry = map[n.sector];
    if (!entry) {
      entry = {
        sectorId: n.sector,
        sectorName: meta.name,
        shortName: meta.shortName,
        heatScore: heatBySector[n.sector] ?? 0,
        bullish: 0,
        neutral: 0,
        bearish: 0,
        total: 0,
      };
      map[n.sector] = entry;
    }
    entry.total++;
    if (n.sentiment === "Bullish") entry.bullish++;
    else if (n.sentiment === "Bearish") entry.bearish++;
    else entry.neutral++;
  }
  return map;
}
