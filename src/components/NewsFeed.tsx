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
}

export function NewsFeed({
  items,
  onSelect,
  selectedId,
  emptyTitle = "No news matches the current filters",
  emptyHint = "Adjust filters or clear them to see the full feed.",
  showTime = true,
  limit,
}: Props) {
  const list = typeof limit === "number" ? items.slice(0, limit) : items;

  if (!list.length) {
    return (
      <div className="glass">
        <EmptyState title={emptyTitle} hint={emptyHint} icon={Newspaper} />
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
