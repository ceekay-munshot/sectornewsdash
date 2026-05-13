import { useMemo } from "react";
import type { NewsItem } from "../types";
import { Newspaper } from "lucide-react";
import { NewsHeadlineRow } from "./NewsHeadlineRow";
import { EmptyState } from "./EmptyState";

interface Props {
  items: NewsItem[];
  selectedId?: string | null;
  onSelect: (item: NewsItem) => void;
  emptyTitle?: string;
  emptyHint?: string;
  showTime?: boolean;
  limit?: number;
  /**
   * When true, items are bucketed into Today / Yesterday / This week /
   * Earlier with section dividers. Only makes sense when the parent has
   * sorted chronologically — Impact sort breaks the ordering and the
   * groups become noise. The parent decides which.
   */
  groupByTime?: boolean;
}

type TimeBucket = "today" | "yesterday" | "week" | "earlier";

const BUCKET_LABEL: Record<TimeBucket, string> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "This week",
  earlier: "Earlier",
};

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function bucketOf(iso: string, now: Date): TimeBucket {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "earlier";
  if (sameDay(t, now)) return "today";
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(t, y)) return "yesterday";
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  if (t.getTime() >= sevenDaysAgo.getTime()) return "week";
  return "earlier";
}

export function NewsFeed({
  items,
  onSelect,
  selectedId,
  emptyTitle = "No news matches the current filters",
  emptyHint = "Adjust filters or clear them to see the full feed.",
  showTime = true,
  limit,
  groupByTime = false,
}: Props) {
  const list = useMemo(
    () => (typeof limit === "number" ? items.slice(0, limit) : items),
    [items, limit]
  );

  // Group while preserving the parent's sort order: walk the list and
  // start a new visual block every time the bucket changes vs the
  // previous row. (Same bucket showing up again later — unusual but
  // possible with non-chronological sorts — gets its own block too.)
  const blocks = useMemo(() => {
    if (!groupByTime) return null;
    const now = new Date();
    const out: { bucket: TimeBucket; items: NewsItem[] }[] = [];
    let prev: TimeBucket | null = null;
    for (const n of list) {
      const b = bucketOf(n.publishedAt, now);
      if (b !== prev) {
        out.push({ bucket: b, items: [n] });
        prev = b;
      } else {
        out[out.length - 1].items.push(n);
      }
    }
    return out;
  }, [list, groupByTime]);

  if (!list.length) {
    return (
      <div className="glass">
        <EmptyState title={emptyTitle} hint={emptyHint} icon={Newspaper} />
      </div>
    );
  }

  if (blocks) {
    return (
      <div className="glass p-1">
        {blocks.map((block, blockIdx) => (
          <div key={`${block.bucket}-${blockIdx}`}>
            <div className="flex items-center gap-2 px-2.5 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/40 first:pt-1">
              <span>{BUCKET_LABEL[block.bucket]}</span>
              <span className="font-mono text-white/30 normal-case tracking-normal">
                {block.items.length}
              </span>
              <div className="h-px flex-1 bg-white/[0.05]" />
            </div>
            <div className="divide-y divide-white/[0.04]">
              {block.items.map((n) => (
                <NewsHeadlineRow
                  key={n.id}
                  item={n}
                  onSelect={onSelect}
                  showTime={showTime}
                  active={selectedId === n.id}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="glass divide-y divide-white/[0.04] p-1">
      {list.map((n) => (
        <NewsHeadlineRow
          key={n.id}
          item={n}
          onSelect={onSelect}
          showTime={showTime}
          active={selectedId === n.id}
        />
      ))}
    </div>
  );
}
