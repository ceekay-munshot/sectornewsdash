import type { NewsItem } from "../types";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  ts: number;
}

const STORAGE_PREFIX = "news-chat:";

function storageKey(newsId: string) {
  return `${STORAGE_PREFIX}${newsId}`;
}

export function loadChat(newsId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(storageKey(newsId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is ChatMessage =>
        !!m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        typeof m.ts === "number",
    );
  } catch {
    return [];
  }
}

export function saveChat(newsId: string, messages: ChatMessage[]) {
  try {
    localStorage.setItem(storageKey(newsId), JSON.stringify(messages));
  } catch {
    // storage may be full or disabled — silently ignore
  }
}

export function clearChat(newsId: string) {
  try {
    localStorage.removeItem(storageKey(newsId));
  } catch {
    // ignore
  }
}

// Pull only the fields the worker needs into the request payload. Mirrors
// the `NewsContext` shape on the server side.
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

export interface ChatResponse {
  message: ChatMessage;
  sourceUsed: boolean;
  model: string;
}

export async function sendChatMessage(
  item: NewsItem,
  history: ChatMessage[],
): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      news: newsContextFor(item),
      messages: history.map(({ role, content }) => ({ role, content })),
    }),
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
    throw new Error(detail || `Chat request failed (${res.status})`);
  }

  const data = (await res.json()) as {
    message?: { role?: string; content?: string };
    sourceUsed?: boolean;
    model?: string;
  };
  const content = data.message?.content?.trim();
  if (!content) {
    throw new Error("Empty response from chat API");
  }
  return {
    message: { role: "assistant", content, ts: Date.now() },
    sourceUsed: Boolean(data.sourceUsed),
    model: data.model ?? "",
  };
}
