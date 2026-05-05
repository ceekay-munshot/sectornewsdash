import { useMemo } from "react";
import { CalendarRange, RefreshCw } from "lucide-react";
import type { NewsItem } from "../types";
import { formatPrettyDate, formatSyncStamp } from "../lib/utils";

interface Props {
  items: NewsItem[];
  lastRefreshedAt?: Date | null;
}

/**
 * Slim row under a news section header showing two time signals:
 * the publish-date span of the items currently in scope and (when
 * available) when the agent last refreshed the feed.
 */
export function NewsTimeStrip({ items, lastRefreshedAt }: Props) {
  const range = useMemo(() => {
    if (items.length === 0) return null;
    let earliest = Infinity;
    let latest = -Infinity;
    for (const n of items) {
      const t = new Date(n.publishedAt).getTime();
      if (Number.isNaN(t)) continue;
      if (t < earliest) earliest = t;
      if (t > latest) latest = t;
    }
    if (!Number.isFinite(earliest)) return null;
    return { earliest: new Date(earliest), latest: new Date(latest) };
  }, [items]);

  if (!range && !lastRefreshedAt) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[10.5px] text-white/45">
      <div className="flex items-center gap-1.5">
        <CalendarRange size={11} className="text-white/35" />
        {range ? (
          <span>
            <span className="text-white/70">
              {formatPrettyDate(range.earliest)}
            </span>
            <span className="mx-1.5 text-white/30">→</span>
            <span className="text-white/70">
              {formatPrettyDate(range.latest)}
            </span>
            <span className="ml-2 text-white/30">·</span>
            <span className="ml-2">
              {items.length} item{items.length === 1 ? "" : "s"} in window
            </span>
          </span>
        ) : (
          <span className="text-white/35">No items in scope</span>
        )}
      </div>
      {lastRefreshedAt ? (
        <div className="flex items-center gap-1.5">
          <RefreshCw size={10} className="text-emerald-300/70" />
          <span>
            <span className="text-white/35">Synced</span>{" "}
            <span className="text-white/75">
              {formatSyncStamp(lastRefreshedAt)}
            </span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
