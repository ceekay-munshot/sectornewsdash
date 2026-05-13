import { ExternalLink } from "lucide-react";
import type { NewsItem } from "../types";
import { SentimentTag } from "./Badges";
import { classNames, formatShortDate } from "../lib/utils";

interface Props {
  item: NewsItem;
  onSelect: (item: NewsItem) => void;
  showTime?: boolean;
  active?: boolean;
}

type Tier = "high" | "mid" | "low";

const MAX_INLINE_COMPANIES = 4;

function tierFor(impact: number): Tier {
  if (impact >= 7) return "high";
  if (impact <= 3) return "low";
  return "mid";
}

export function NewsHeadlineRow({ item, onSelect, showTime, active }: Props) {
  const tier = tierFor(item.impactScore);

  // High tier shows the supporting copy (whyItMatters preview + chips)
  const showSupporting = tier === "high";
  const supporting = (item.whyItMatters || item.summary || "").trim();
  const companies = item.affectedCompanies ?? [];
  const visibleCompanies = companies.slice(0, MAX_INLINE_COMPANIES);
  const hiddenCount = Math.max(0, companies.length - visibleCompanies.length);

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
        "group focus-ring relative flex cursor-pointer items-start gap-2.5 rounded-lg border border-transparent px-2.5 py-2 transition",
        "hover:border-white/[0.07] hover:bg-white/[0.025]",
        active && "border-white/[0.12] bg-white/[0.04]",
        tier === "high" && "py-2.5"
      )}
    >
      <SentimentTag sentiment={item.sentiment} />

      <div className="min-w-0 flex-1">
        <div
          className={classNames(
            "line-clamp-2 text-[12.5px] font-medium leading-snug",
            tier === "low"
              ? "text-white/55 group-hover:text-white/75"
              : "text-white/85 group-hover:text-white",
            tier === "high" && "text-[13px] font-semibold text-white"
          )}
        >
          {item.headline}
        </div>

        {showSupporting && supporting ? (
          <div className="mt-0.5 line-clamp-1 text-[11.5px] leading-snug text-white/55">
            {supporting}
          </div>
        ) : null}

        {showSupporting && visibleCompanies.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {visibleCompanies.map((c) => (
              <span
                key={c}
                className="inline-flex items-center rounded-md border border-white/[0.07] bg-white/[0.025] px-1.5 py-[1px] font-mono text-[10px] tracking-tight text-white/70"
              >
                {c}
              </span>
            ))}
            {hiddenCount > 0 ? (
              <span className="text-[10px] font-mono text-white/35">
                +{hiddenCount}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {showTime && (
        <span
          className={classNames(
            "hidden shrink-0 whitespace-nowrap pt-[2px] font-mono text-[10.5px] sm:inline",
            tier === "low" ? "text-white/30" : "text-white/45"
          )}
        >
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
          className="focus-ring inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/[0.07] bg-white/[0.02] text-white/55 transition hover:border-white/[0.16] hover:text-white"
        >
          <ExternalLink size={11} />
        </a>
      ) : null}
    </div>
  );
}
