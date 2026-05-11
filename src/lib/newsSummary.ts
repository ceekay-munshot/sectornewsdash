import type { NewsItem } from "../types";

export interface NewsSummary {
  bullets: string[];
  at: number;
  sourceUsed: boolean;
  model: string;
}

const STORAGE_PREFIX = "news-summary:";

function storageKey(newsId: string) {
  return `${STORAGE_PREFIX}${newsId}`;
}

export function loadSummary(newsId: string): NewsSummary | null {
  try {
    const raw = localStorage.getItem(storageKey(newsId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray(parsed.bullets) &&
      parsed.bullets.length >= 3 &&
      parsed.bullets.every((b: unknown) => typeof b === "string")
    ) {
      return {
        bullets: parsed.bullets,
        at: typeof parsed.at === "number" ? parsed.at : Date.now(),
        sourceUsed: Boolean(parsed.sourceUsed),
        model: typeof parsed.model === "string" ? parsed.model : "",
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSummary(newsId: string, summary: NewsSummary) {
  try {
    localStorage.setItem(storageKey(newsId), JSON.stringify(summary));
  } catch {
    // storage may be full or disabled — silently ignore
  }
}

export function clearSummary(newsId: string) {
  try {
    localStorage.removeItem(storageKey(newsId));
  } catch {
    // ignore
  }
}

function newsContextFor(item: NewsItem) {
  return {
    id: item.id,
    headline: item.headline,
    summary: item.summary,
    sector: item.sector,
    subsector: item.subsector,
    theme: item.theme,
    sentiment: item.sentiment,
    urgency: item.urgency,
    impactScore: item.impactScore,
    source: item.source,
    sourceType: item.sourceType,
    sourceConfidence: item.sourceConfidence,
    publishedAt: item.publishedAt,
    affectedCompanies: item.affectedCompanies,
    kpiAffected: item.kpiAffected,
    timeHorizon: item.timeHorizon,
    whyItMatters: item.whyItMatters,
    bullCase: item.bullCase,
    bearCase: item.bearCase,
    relatedCatalyst: item.relatedCatalyst,
    newsUrl: item.newsUrl,
  };
}

export async function fetchSummary(
  item: NewsItem,
  opts: { refresh?: boolean; signal?: AbortSignal } = {},
): Promise<NewsSummary> {
  const res = await fetch("/api/summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      news: newsContextFor(item),
      refresh: Boolean(opts.refresh),
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    let detail = "";
    try {
      const data = await res.json();
      if (data && typeof data === "object" && "error" in data) {
        detail = String((data as { error: unknown }).error);
      }
    } catch {
      detail = await res.text().catch(() => "");
    }
    throw new Error(detail || `Summary request failed (${res.status})`);
  }

  const data = (await res.json()) as {
    bullets?: unknown;
    sourceUsed?: boolean;
    model?: string;
  };
  const bullets = Array.isArray(data.bullets)
    ? data.bullets.filter((b): b is string => typeof b === "string")
    : [];
  if (bullets.length < 3) {
    throw new Error("Summary API returned an empty list");
  }
  return {
    bullets,
    at: Date.now(),
    sourceUsed: Boolean(data.sourceUsed),
    model: data.model ?? "",
  };
}
