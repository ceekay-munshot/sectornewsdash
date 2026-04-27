import { ExternalLink } from "lucide-react";
import type { NewsItem } from "../types";
import { SentimentDot } from "./Badges";
import { classNames, relativeTime } from "../lib/utils";

interface Props {
  item: NewsItem;
  onSelect: (item: NewsItem) => void;
  showTime?: boolean;
  active?: boolean;
}

/**
 * Investor-grade headline row — strictly: headline + sentiment dot + source
 * button (+ optional published time). All deeper intelligence opens in the
 * NewsInsightPanel when the row is clicked.
 */
export function NewsHeadlineRow({ item, onSelect, showTime, active }: Props) {
  return (
    <div
      onClick={() => onSelect(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(item);
        }
      }}
      className={classNames(
        "group focus-ring flex cursor-pointer items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 transition",
        "hover:border-white/[0.07] hover:bg-white/[0.025]",
        active && "border-white/[0.12] bg-white/[0.04]"
      )}
    >
      <SentimentDot sentiment={item.sentiment} />
      <div className="min-w-0 flex-1">
        <div className="line-clamp-1 text-[12.5px] font-medium text-white/85 group-hover:text-white">
          {item.headline}
        </div>
      </div>
      {showTime && (
        <span className="hidden whitespace-nowrap font-mono text-[10.5px] text-white/40 sm:inline">
          {relativeTime(item.publishedAt)}
        </span>
      )}
      <a
        href={item.newsUrl}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        title={`Open source: ${item.source}`}
        className="focus-ring inline-flex items-center gap-1 rounded-md border border-white/[0.07] bg-white/[0.02] px-1.5 py-1 text-[10.5px] text-white/55 transition hover:border-white/[0.16] hover:text-white"
      >
        <ExternalLink size={10} />
        <span className="max-w-[80px] truncate">{item.source}</span>
      </a>
    </div>
  );
}
