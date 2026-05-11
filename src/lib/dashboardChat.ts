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

export type DashboardChatStreamEvent =
  | { type: "phase"; phase: "thinking" | "answering" }
  | {
      type: "tool";
      id: number;
      name: string;
      status: "started" | "ok" | "error";
      summary?: string;
    }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

export async function sendDashboardChat(opts: {
  sectorIds: string[];
  sectors: SectorMeta[];
  history: DashboardChatMessage[];
  signal?: AbortSignal;
  onEvent?: (event: DashboardChatStreamEvent) => void;
}): Promise<DashboardChatResponse> {
  const catalog = opts.sectors.map((s) => ({
    id: s.id,
    name: s.name,
    shortName: s.shortName,
  }));
  const res = await fetch("/api/dashboard-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({
      sectorIds: opts.sectorIds,
      sectorCatalog: catalog,
      messages: opts.history.map(({ role, content }) => ({ role, content })),
    }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
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

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let toolCalls: DashboardChatToolCall[] = [];
  let sources: DashboardChatSource[] = [];
  let model = "";
  let rounds = 0;
  let done = false;
  let errorMessage: string | null = null;

  outer: while (!done) {
    const { value, done: streamDone } = await reader.read();
    if (streamDone) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE frames are separated by a blank line. Tolerate \r\n too.
    const frames = buffer.split(/\n\n|\r\n\r\n/);
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const line = frame.replace(/^data: ?/m, "").trim();
      if (!line) continue;
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      const type = typeof event.type === "string" ? event.type : "";
      if (type === "delta") {
        const text = typeof event.text === "string" ? event.text : "";
        content += text;
        opts.onEvent?.({ type: "delta", text });
      } else if (type === "phase") {
        const phase = event.phase === "answering" ? "answering" : "thinking";
        opts.onEvent?.({ type: "phase", phase });
      } else if (type === "tool") {
        const ev: DashboardChatStreamEvent = {
          type: "tool",
          id: typeof event.id === "number" ? event.id : 0,
          name: typeof event.name === "string" ? event.name : "",
          status:
            event.status === "ok" || event.status === "error" ? event.status : "started",
          summary:
            typeof event.summary === "string" ? event.summary : undefined,
        };
        opts.onEvent?.(ev);
      } else if (type === "done") {
        toolCalls = parseToolCalls(event.toolCalls);
        sources = parseSources(event.sources);
        model = typeof event.model === "string" ? event.model : "";
        rounds = typeof event.rounds === "number" ? event.rounds : 0;
        // Some servers omit content from `done` — fall back to whatever we
        // accumulated from delta events.
        if (typeof event.content === "string" && event.content.length > 0) {
          content = event.content;
        }
        done = true;
        opts.onEvent?.({ type: "done" });
        break outer;
      } else if (type === "error") {
        errorMessage =
          typeof event.message === "string"
            ? event.message
            : "Dashboard chat request failed";
        opts.onEvent?.({ type: "error", message: errorMessage });
        break outer;
      }
    }
  }

  if (errorMessage) throw new Error(errorMessage);
  if (!content.trim()) {
    throw new Error("Empty response from dashboard chat API");
  }

  return {
    message: {
      role: "assistant",
      content: content.trim(),
      ts: Date.now(),
      sources,
    },
    toolCalls,
    sources,
    model,
    rounds,
  };
}

function parseToolCalls(raw: unknown): DashboardChatToolCall[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c) => c && typeof (c as { name: unknown }).name === "string")
    .map((c) => ({
      name: String((c as { name: unknown }).name),
      args: (c as { args: unknown }).args,
      ok: Boolean((c as { ok: unknown }).ok),
    }));
}

function parseSources(raw: unknown): DashboardChatSource[] {
  if (!Array.isArray(raw)) return [];
  return raw
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
    }));
}
