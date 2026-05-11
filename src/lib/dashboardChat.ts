import type { SectorMeta } from "../types";

export interface DashboardChatSource {
  id: string;
  headline: string;
  source?: string;
  sourceType?: string;
  publishedAt?: string;
  newsUrl?: string;
  sectorId: string;
  sectorName: string;
  // True when the agent actually pulled the article body (fetch_article
  // returned content), false when it only saw analyst metadata.
  read: boolean;
}

export interface DashboardChatMessage {
  role: "user" | "assistant";
  content: string;
  ts: number;
  // For assistant turns only. Persisted with the conversation so the
  // Sources button stays available across reloads.
  sources?: DashboardChatSource[];
}

export interface DashboardChatToolCall {
  name: string;
  args: unknown;
  ok: boolean;
}

export interface DashboardChatResponse {
  message: DashboardChatMessage;
  toolCalls: DashboardChatToolCall[];
  sources: DashboardChatSource[];
  model: string;
  rounds: number;
}

const STORAGE_KEY = "dashboard-chat:v1";

interface PersistedChat {
  messages: DashboardChatMessage[];
  sectorIds: string[];
}

export function loadDashboardChat(): PersistedChat {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { messages: [], sectorIds: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { messages: [], sectorIds: [] };
    }
    const messages = Array.isArray(parsed.messages)
      ? parsed.messages.filter(
          (m: unknown): m is DashboardChatMessage =>
            !!m &&
            typeof m === "object" &&
            ((m as DashboardChatMessage).role === "user" ||
              (m as DashboardChatMessage).role === "assistant") &&
            typeof (m as DashboardChatMessage).content === "string" &&
            typeof (m as DashboardChatMessage).ts === "number",
        )
      : [];
    const sectorIds = Array.isArray(parsed.sectorIds)
      ? parsed.sectorIds.filter((s: unknown): s is string => typeof s === "string")
      : [];
    return { messages, sectorIds };
  } catch {
    return { messages: [], sectorIds: [] };
  }
}

export function saveDashboardChat(state: PersistedChat) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage may be full or disabled — silently ignore
  }
}

export function clearDashboardChat() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function sendDashboardChat(opts: {
  sectorIds: string[];
  sectors: SectorMeta[];
  history: DashboardChatMessage[];
  signal?: AbortSignal;
}): Promise<DashboardChatResponse> {
  const catalog = opts.sectors.map((s) => ({
    id: s.id,
    name: s.name,
    shortName: s.shortName,
  }));
  const res = await fetch("/api/dashboard-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sectorIds: opts.sectorIds,
      sectorCatalog: catalog,
      messages: opts.history.map(({ role, content }) => ({ role, content })),
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
    throw new Error(detail || `Dashboard chat request failed (${res.status})`);
  }

  const data = (await res.json()) as {
    message?: { role?: string; content?: string };
    toolCalls?: Array<{ name?: unknown; args?: unknown; ok?: unknown }>;
    sources?: Array<Record<string, unknown>>;
    model?: string;
    rounds?: number;
  };
  const content = data.message?.content?.trim();
  if (!content) throw new Error("Empty response from dashboard chat API");

  const toolCalls: DashboardChatToolCall[] = Array.isArray(data.toolCalls)
    ? data.toolCalls
        .filter((c) => c && typeof (c as { name: unknown }).name === "string")
        .map((c) => ({
          name: String((c as { name: unknown }).name),
          args: (c as { args: unknown }).args,
          ok: Boolean((c as { ok: unknown }).ok),
        }))
    : [];

  const sources: DashboardChatSource[] = Array.isArray(data.sources)
    ? data.sources
        .filter(
          (s) =>
            !!s &&
            typeof s === "object" &&
            typeof (s as { id: unknown }).id === "string" &&
            typeof (s as { headline: unknown }).headline === "string",
        )
        .map((s) => ({
          id: String((s as { id: unknown }).id),
          headline: String((s as { headline: unknown }).headline),
          source:
            typeof (s as { source?: unknown }).source === "string"
              ? String((s as { source: unknown }).source)
              : undefined,
          sourceType:
            typeof (s as { sourceType?: unknown }).sourceType === "string"
              ? String((s as { sourceType: unknown }).sourceType)
              : undefined,
          publishedAt:
            typeof (s as { publishedAt?: unknown }).publishedAt === "string"
              ? String((s as { publishedAt: unknown }).publishedAt)
              : undefined,
          newsUrl:
            typeof (s as { newsUrl?: unknown }).newsUrl === "string"
              ? String((s as { newsUrl: unknown }).newsUrl)
              : undefined,
          sectorId:
            typeof (s as { sectorId?: unknown }).sectorId === "string"
              ? String((s as { sectorId: unknown }).sectorId)
              : "",
          sectorName:
            typeof (s as { sectorName?: unknown }).sectorName === "string"
              ? String((s as { sectorName: unknown }).sectorName)
              : "",
          read: Boolean((s as { read?: unknown }).read),
        }))
    : [];

  return {
    message: {
      role: "assistant",
      content,
      ts: Date.now(),
      sources,
    },
    toolCalls,
    sources,
    model: data.model ?? "",
    rounds: typeof data.rounds === "number" ? data.rounds : 0,
  };
}
