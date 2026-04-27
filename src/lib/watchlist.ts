const KEY = "snr.watchlist.v1";

export const DEFAULT_WATCHLIST = ["auto", "power", "cement"];

export function loadWatchlist(allIds: string[]): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter(
          (x): x is string => typeof x === "string" && allIds.includes(x)
        );
        if (filtered.length) return filtered;
      }
    }
  } catch {
    // ignore corrupt storage
  }
  return DEFAULT_WATCHLIST.filter((id) => allIds.includes(id));
}

export function saveWatchlist(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // ignore quota / privacy mode
  }
}
