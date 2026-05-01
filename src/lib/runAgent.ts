import type { NewsItem } from "../types";
import { AGENT_ACCESS_TOKEN, AGENT_API_BASE } from "./agentConfig";
import { parseMunsAutoNews } from "./munsParse";
import { munsRowsToNewsItems } from "./munsToNews";

export async function runSectorAgent(
  sectorId: string,
  agentLibraryId: string,
): Promise<NewsItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  const response = await fetch(`${AGENT_API_BASE}/agents/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AGENT_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agent_library_id: agentLibraryId,
      metadata: {
        stock_ticker: "JIOFIN",
        stock_company_name: "Jio Financial Services Ltd.",
        context_company_name: "Jio Financial Services Ltd.",
        stock_country: "INDIA",
        to_date: today,
        timezone: "UTC",
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`agent ${sectorId} responded ${response.status}`);
  }

  const text = await response.text();
  const rows = parseMunsAutoNews(text);
  if (rows.length === 0) {
    throw new Error(`agent ${sectorId} returned no parseable rows`);
  }
  return munsRowsToNewsItems(rows, sectorId);
}

// Run a list of async tasks with a hard concurrency cap. Used by the bulk
// "Sync all" flow so we don't fire 29 simultaneous POSTs at the agent API.
export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const slot = async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (next === undefined) break;
      await worker(next);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, slot),
  );
}
