import { SECTOR_AGENTS } from "./agentConfig";
import { runSectorAgent, runWithConcurrency } from "./runAgent";
import type { NewsItem } from "../types";

export const SYNC_CONCURRENCY = 5;

/**
 * Refresh news for every configured sector. Individual agent failures are
 * swallowed so one bad agent can't kill the run; callers see progress and
 * the final result via the optional onProgress hook.
 */
export async function syncAllSectors(
  onSectorLoaded: (sectorId: string, items: NewsItem[], at: Date) => void,
  onProgress?: (done: number, total: number) => void,
  concurrency: number = SYNC_CONCURRENCY
): Promise<void> {
  const entries = Object.entries(SECTOR_AGENTS);
  const total = entries.length;
  let done = 0;
  onProgress?.(0, total);
  await runWithConcurrency(entries, concurrency, async ([sectorId, agentId]) => {
    try {
      const items = await runSectorAgent(sectorId, agentId);
      onSectorLoaded(sectorId, items, new Date());
    } catch {
      // swallow — surfaced via progress count, not a thrown error
    } finally {
      done++;
      onProgress?.(done, total);
    }
  });
}
