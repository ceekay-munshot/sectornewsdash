import { ExternalLink } from "lucide-react";
import type { NewsItem } from "../types";
import { SentimentDot } from "./Badges";
import { classNames, formatShortDate } from "../lib/utils";

interface Props {
  item: NewsItem;
  onSelect: (item: NewsItem) => void;
  showTime?: boolean;
  active?: boolean;
}

/**
 * Headline row — sentiment dot + headline + short date + outlink button.
 * Click anywhere opens the NewsInsightPanel; the outlink button on the right
 * is the only thing that escapes to the source URL.
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
        <span className="hidden whitespace-nowrap font-mono text-[10.5px] text-white/45 sm:inline">
          {formatShortDate(item.publishedAt)}
        </span>
      )}
      {item.newsUrl ? (
        <a
          href={item.newsUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          title={`Open source: ${item.source}`}
          aria-label={`Open source: ${item.source}`}
          className="focus-ring inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.07] bg-white/[0.02] text-white/55 transition hover:border-white/[0.16] hover:text-white"
        >
          <ExternalLink size={11} />
        </a>
      ) : null}
    </div>
  );
}
