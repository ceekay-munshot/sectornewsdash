import type { NewsItem } from "../types";

export interface MunsSectorPayload {
  items: NewsItem[];
  loadedAt: number;
}

export type NewsStore = Record<string, MunsSectorPayload>;

/**
 * Fetch the persisted blob from KV via the Worker. Returns an empty store
 * on any failure (e.g. dev server with no Worker, network error, KV miss).
 */
export async function fetchRemoteNews(): Promise<NewsStore> {
  try {
    const r = await fetch("/api/news", { cache: "no-store" });
    if (!r.ok) return {};
    const data = await r.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    return data as NewsStore;
  } catch {
    return {};
  }
}

/** Best-effort PUT — failures fall back to localStorage as the only cache. */
export async function persistRemoteNews(store: NewsStore): Promise<void> {
  try {
    await fetch("/api/news", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(store),
    });
  } catch {
    // intentionally swallow — local cache still has the data
  }
}
