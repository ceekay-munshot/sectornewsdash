interface Env {
  ASSETS: Fetcher;
  NEWS_KV: KVNamespace;
  // Set via `npx wrangler secret put OPENAI_API_KEY`. Never bake into client.
  OPENAI_API_KEY?: string;
  // Optional override; falls back to a sensible default model.
  OPENAI_MODEL?: string;
  // Set via `npx wrangler secret put MUNS_ACCESS_TOKEN`. Never bake into client.
  MUNS_ACCESS_TOKEN?: string;
  // Optional upstream override; falls back to the devde endpoint.
  MUNS_API_BASE?: string;
}

const MUNS_DEFAULT_BASE = "https://devde.muns.io";

const KV_KEY = "agent-news-by-sector-v1";

// Cache extracted article text per newsId for 30 days. The same article body
// is reused across every turn of the chat so we don't re-fetch and re-strip
// the page on every keystroke.
const SOURCE_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;
const SOURCE_CACHE_PREFIX = "chat-source:";
const SUMMARY_CACHE_PREFIX = "news-summary:";
const SOURCE_FETCH_TIMEOUT_MS = 8000;
const SOURCE_MAX_CHARS = 12_000;
const MAX_HISTORY_MESSAGES = 30;

const DEFAULT_MODEL = "gpt-4o-mini";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface NewsContext {
  id: string;
  headline: string;
  summary: string;
  sector: string;
  subsector?: string;
  theme?: string;
  sentiment?: string;
  urgency?: string;
  impactScore?: number;
  source?: string;
  sourceType?: string;
  sourceConfidence?: number;
  publishedAt?: string;
  affectedCompanies?: string[];
  kpiAffected?: string[];
  timeHorizon?: string;
  whyItMatters?: string;
  bullCase?: string;
  bearCase?: string;
  relatedCatalyst?: string;
  newsUrl?: string;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function jsonOk(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/api/news") {
      if (req.method === "GET") {
        const raw = await env.NEWS_KV.get(KV_KEY);
        return new Response(raw ?? "{}", {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        });
      }
      if (req.method === "PUT") {
        const body = await req.text();
        let parsed: unknown;
        try {
          parsed = JSON.parse(body);
        } catch {
          return jsonError("Invalid JSON", 400);
        }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return jsonError("Expected an object body", 400);
        }
        await env.NEWS_KV.put(KV_KEY, body);
        return new Response(null, { status: 204 });
      }
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, PUT" },
      });
    }

    if (url.pathname === "/api/chat") {
      if (req.method !== "POST") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: { Allow: "POST" },
        });
      }
      return handleChat(req, env);
    }

    if (url.pathname === "/api/summary") {
      if (req.method !== "POST") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: { Allow: "POST" },
        });
      }
      return handleSummary(req, env);
    }

    if (url.pathname === "/api/dashboard-chat") {
      if (req.method !== "POST") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: { Allow: "POST" },
        });
      }
      return handleDashboardChat(req, env);
    }

    if (url.pathname === "/api/muns-run") {
      if (req.method !== "POST") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: { Allow: "POST" },
        });
      }
      return handleMunsRun(req, env);
    }

    return env.ASSETS.fetch(req);
  },
};

async function handleChat(req: Request, env: Env): Promise<Response> {
  if (!env.OPENAI_API_KEY) {
    return jsonError(
      "OpenAI key not configured. Set the OPENAI_API_KEY secret on the Worker.",
      500,
    );
  }

  let payload: {
    news?: NewsContext;
    messages?: ChatMessage[];
  };
  try {
    payload = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const news = payload.news;
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  if (!news || typeof news !== "object" || !news.id || !news.headline) {
    return jsonError("Missing news context", 400);
  }
  if (messages.length === 0) {
    return jsonError("Empty conversation", 400);
  }

  const cleanedHistory = messages
    .filter(
      (m): m is ChatMessage =>
        !!m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .slice(-MAX_HISTORY_MESSAGES);
  if (cleanedHistory.length === 0) {
    return jsonError("Empty conversation", 400);
  }

  const sourceText = await getSourceText(env, news);
  const systemPrompt = buildSystemPrompt(news, sourceText);

  const model = env.OPENAI_MODEL || DEFAULT_MODEL;
  const openaiBody = {
    model,
    temperature: 0.4,
    messages: [
      { role: "system", content: systemPrompt },
      ...cleanedHistory.map((m) => ({ role: m.role, content: m.content })),
    ],
  };

  let openaiRes: Response;
  try {
    openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(openaiBody),
    });
  } catch (e) {
    return jsonError(`OpenAI request failed: ${(e as Error).message}`, 502);
  }

  if (!openaiRes.ok) {
    const detail = await openaiRes.text();
    return jsonError(
      `OpenAI ${openaiRes.status}: ${detail.slice(0, 500)}`,
      openaiRes.status >= 500 ? 502 : 400,
    );
  }

  const data = (await openaiRes.json()) as {
    choices?: Array<{ message?: { role?: string; content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!content) {
    return jsonError("OpenAI returned no message", 502);
  }

  return jsonOk({
    message: { role: "assistant", content },
    sourceUsed: Boolean(sourceText),
    model,
  });
}

async function handleMunsRun(req: Request, env: Env): Promise<Response> {
  if (!env.MUNS_ACCESS_TOKEN) {
    return jsonError(
      "MUNS token not configured. Set the MUNS_ACCESS_TOKEN secret on the Worker.",
      500,
    );
  }

  let body: string;
  try {
    body = await req.text();
    JSON.parse(body);
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const base = env.MUNS_API_BASE || MUNS_DEFAULT_BASE;
  let upstream: Response;
  try {
    upstream = await fetch(`${base}/agents/run`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.MUNS_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body,
    });
  } catch (e) {
    return jsonError(`MUNS request failed: ${(e as Error).message}`, 502);
  }

  const headers = new Headers({
    "Content-Type": upstream.headers.get("Content-Type") ?? "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  const passthrough = ["x-active-analyst-id", "x-analyst-output-id"];
  for (const name of passthrough) {
    const v = upstream.headers.get(name);
    if (v) headers.set(name, v);
  }
  headers.set("Access-Control-Expose-Headers", passthrough.join(", "));

  return new Response(upstream.body, { status: upstream.status, headers });
}

async function handleSummary(req: Request, env: Env): Promise<Response> {
  if (!env.OPENAI_API_KEY) {
    return jsonError(
      "OpenAI key not configured. Set the OPENAI_API_KEY secret on the Worker.",
      500,
    );
  }

  let payload: { news?: NewsContext; refresh?: boolean };
  try {
    payload = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const news = payload.news;
  if (!news || typeof news !== "object" || !news.id || !news.headline) {
    return jsonError("Missing news context", 400);
  }

  const cacheKey = `${SUMMARY_CACHE_PREFIX}${news.id}`;
  if (!payload.refresh) {
    const cached = await env.NEWS_KV.get(cacheKey);
    if (cached) {
      try {
        const obj = JSON.parse(cached);
        if (
          obj &&
          Array.isArray(obj.bullets) &&
          obj.bullets.length > 0 &&
          obj.bullets.every((b: unknown) => typeof b === "string")
        ) {
          return jsonOk({ ...obj, cached: true });
        }
      } catch {
        // fall through to regenerate
      }
    }
  }

  const sourceText = await getSourceText(env, news);
  const systemPrompt = buildSummarySystemPrompt(news, sourceText);
  const model = env.OPENAI_MODEL || DEFAULT_MODEL;

  const openaiBody = {
    model,
    temperature: 0.2,
    response_format: { type: "json_object" as const },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content:
          'Produce the briefing now. Reply with strict JSON: {"bullets": ["…", "…", "…", "…"]}.',
      },
    ],
  };

  let openaiRes: Response;
  try {
    openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(openaiBody),
    });
  } catch (e) {
    return jsonError(`OpenAI request failed: ${(e as Error).message}`, 502);
  }

  if (!openaiRes.ok) {
    const detail = await openaiRes.text();
    return jsonError(
      `OpenAI ${openaiRes.status}: ${detail.slice(0, 500)}`,
      openaiRes.status >= 500 ? 502 : 400,
    );
  }

  const data = (await openaiRes.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!content) {
    return jsonError("OpenAI returned no content", 502);
  }

  let bullets: string[] = [];
  try {
    const parsed = JSON.parse(content);
    const raw = (parsed as { bullets?: unknown }).bullets;
    if (Array.isArray(raw)) {
      bullets = raw
        .filter((b): b is string => typeof b === "string")
        .map((b) => b.trim())
        .filter((b) => b.length > 0)
        .slice(0, 5);
    }
  } catch {
    // model didn't honor JSON; fall through to error below
  }

  if (bullets.length < 3) {
    return jsonError("Model returned an unusable summary", 502);
  }

  const result = {
    bullets,
    model,
    sourceUsed: Boolean(sourceText),
  };

  await env.NEWS_KV.put(cacheKey, JSON.stringify(result), {
    expirationTtl: SOURCE_CACHE_TTL_SECONDS,
  });

  return jsonOk({ ...result, cached: false });
}

function buildSummarySystemPrompt(
  news: NewsContext,
  sourceText: string | null,
): string {
  const lines: string[] = [];
  lines.push(
    "You are a senior equity research analyst writing for a buy-side desk.",
    "Read the news item and the article body, then produce a tight 4–5 bullet professional briefing.",
    "",
    "Each bullet must:",
    "- Be a single, complete sentence in professional, neutral tone.",
    "- Lead with the most material fact first (what happened, who, where, when).",
    "- Surface concrete numbers (₹/$ value, MW, tonnes, %, dates, deadlines) when present in the article.",
    "- Name the specific parties / regulators / companies / projects involved.",
    "- Cover, across the set: (1) the core fact, (2) the key numbers, (3) the parties / mechanism, (4) immediate market implication, (5) what to watch next.",
    "",
    "Rules:",
    "- Output STRICT JSON: {\"bullets\": [string, string, string, string, (string)]}. No prose outside the JSON.",
    "- Exactly 4 or 5 bullets — no more, no fewer.",
    "- Do not repeat the headline verbatim and do not start a bullet with 'The article'.",
    "- No hedging, no disclaimers, no investment advice, no markdown bullets/asterisks inside strings.",
    "- If the article body is unavailable, use the metadata to write the best possible briefing and prefix the last bullet with 'Note:' if information is thin.",
    "",
    "=== NEWS ITEM ===",
    `Headline: ${news.headline}`,
  );
  if (news.summary) lines.push(`One-line summary: ${news.summary}`);
  if (news.sector) lines.push(`Sector: ${news.sector}`);
  if (news.subsector) lines.push(`Subsector: ${news.subsector}`);
  if (news.theme) lines.push(`Theme: ${news.theme}`);
  if (news.sentiment) lines.push(`Sentiment: ${news.sentiment}`);
  if (news.urgency) lines.push(`Urgency: ${news.urgency}`);
  if (typeof news.impactScore === "number")
    lines.push(`Impact score (0-10): ${news.impactScore}`);
  if (news.timeHorizon) lines.push(`Time horizon: ${news.timeHorizon}`);
  if (news.publishedAt) lines.push(`Published: ${news.publishedAt}`);
  if (news.source) lines.push(`Source: ${news.source}`);
  if (news.sourceType) lines.push(`Source type: ${news.sourceType}`);
  if (typeof news.sourceConfidence === "number")
    lines.push(`Source confidence: ${news.sourceConfidence}%`);
  if (news.newsUrl) lines.push(`URL: ${news.newsUrl}`);
  if (news.affectedCompanies?.length)
    lines.push(`Affected companies: ${news.affectedCompanies.join(", ")}`);
  if (news.kpiAffected?.length)
    lines.push(`KPIs affected: ${news.kpiAffected.join(", ")}`);

  lines.push("", "=== ARTICLE CONTENT ===");
  if (sourceText) {
    lines.push(sourceText);
  } else {
    lines.push(
      "(Article body could not be fetched — paywall, JS-rendered page, or network error. Use the metadata above; mark the last bullet 'Note:' if coverage is thin.)",
    );
  }

  return lines.join("\n");
}

async function getSourceText(
  env: Env,
  news: NewsContext,
): Promise<string | null> {
  const url = news.newsUrl;
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const cacheKey = `${SOURCE_CACHE_PREFIX}${news.id}`;

  const cached = await env.NEWS_KV.get(cacheKey);
  if (cached !== null) {
    return cached.length > 0 ? cached : null;
  }

  let text: string | null = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      SOURCE_FETCH_TIMEOUT_MS,
    );
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SectorNewsDashBot/1.0; +https://sectornewsdash)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (res.ok) {
      const html = await res.text();
      text = extractReadableText(html).slice(0, SOURCE_MAX_CHARS);
    }
  } catch {
    text = null;
  }

  // Cache positive AND negative results so we don't hammer paywalls/4xx
  // sources on every chat turn. Empty string = "tried, came back useless".
  await env.NEWS_KV.put(cacheKey, text ?? "", {
    expirationTtl: SOURCE_CACHE_TTL_SECONDS,
  });
  return text && text.length > 0 ? text : null;
}

// Extremely lightweight HTML → text conversion. Strips script/style blocks,
// removes tags, decodes a small set of entities, and collapses whitespace.
// Good enough to give the model the article body for news pages.
function extractReadableText(html: string): string {
  let s = html;
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  s = s.replace(/<\/?(br|p|div|li|tr|h[1-6])[^>]*>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

// ---------------------------------------------------------------------------
// Dashboard chat — router-style tool calling.
//
// Lets the user talk to the whole dashboard (one or many sectors at once).
// Instead of stuffing every headline, body, and analyst field into the
// system prompt, we expose a small catalog of tools. The model only sees:
//
//   • the user's selected sectors (id + display name + count)
//   • the conversation so far
//   • the tool catalog
//
// And then asks for what it needs. This keeps the prompt tiny (good for
// latency + cost), lets the model fan out to multiple sectors, and lets
// it pull the full article body only when a question actually requires it.
// ---------------------------------------------------------------------------

const DASHBOARD_MAX_TOOL_ROUNDS = 5;
const DASHBOARD_MAX_HEADLINES_PER_SECTOR = 30;
const DASHBOARD_DEFAULT_HEADLINES_PER_SECTOR = 10;
const DASHBOARD_MAX_DETAIL_IDS = 6;
const DASHBOARD_MAX_COMPARE_IDS = 6;
const DASHBOARD_MAX_SEARCH_RESULTS = 25;
const DASHBOARD_ARTICLE_TRIM = 8000;

interface DashboardChatRequest {
  sectorIds?: string[];
  sectorCatalog?: Array<{ id: string; name: string; shortName?: string }>;
  messages?: ChatMessage[];
}

interface StoredNewsItem {
  id: string;
  headline: string;
  summary: string;
  sector: string;
  subsector?: string;
  theme?: string;
  sentiment?: string;
  urgency?: string;
  impactScore?: number;
  source?: string;
  sourceType?: string;
  sourceConfidence?: number;
  publishedAt?: string;
  affectedCompanies?: string[];
  kpiAffected?: string[];
  timeHorizon?: string;
  whyItMatters?: string;
  bullCase?: string;
  bearCase?: string;
  relatedCatalyst?: string;
  newsUrl?: string;
}

interface NewsCorpus {
  bySector: Map<string, StoredNewsItem[]>;
  byId: Map<string, StoredNewsItem>;
  loadedAtBySector: Map<string, number>;
}

async function handleDashboardChat(req: Request, env: Env): Promise<Response> {
  if (!env.OPENAI_API_KEY) {
    return jsonError(
      "OpenAI key not configured. Set the OPENAI_API_KEY secret on the Worker.",
      500,
    );
  }

  let payload: DashboardChatRequest;
  try {
    payload = (await req.json()) as DashboardChatRequest;
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const selectedSectorIds = Array.isArray(payload.sectorIds)
    ? payload.sectorIds.filter((s): s is string => typeof s === "string" && s.length > 0)
    : [];
  const sectorCatalog = Array.isArray(payload.sectorCatalog)
    ? payload.sectorCatalog.filter(
        (s) =>
          s &&
          typeof s === "object" &&
          typeof s.id === "string" &&
          typeof s.name === "string",
      )
    : [];

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const cleanedHistory = messages
    .filter(
      (m): m is ChatMessage =>
        !!m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .slice(-MAX_HISTORY_MESSAGES);
  if (cleanedHistory.length === 0) {
    return jsonError("Empty conversation", 400);
  }

  const corpus = await loadNewsCorpus(env);
  if (corpus.byId.size === 0) {
    return jsonError(
      "No synced news yet. Run a sync from the dashboard before chatting.",
      400,
    );
  }

  const catalogMap = new Map<string, { id: string; name: string; shortName?: string }>();
  for (const s of sectorCatalog) catalogMap.set(s.id, s);
  // Backfill display names from the corpus when client didn't ship a catalog
  // for a sector (e.g. older clients) — use the id as the fallback name.
  for (const id of corpus.bySector.keys()) {
    if (!catalogMap.has(id)) catalogMap.set(id, { id, name: id });
  }

  // SSE response — every event is `data: <json>\n\n`. The worker keeps
  // running until we close the writer.
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const sendEvent = async (obj: unknown) => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
    } catch {
      // client disconnected — nothing we can do
    }
  };

  // Don't await — the SSE response streams while this runs in the background.
  runDashboardConversation({
    env,
    selectedSectorIds,
    catalogMap,
    corpus,
    cleanedHistory,
    sendEvent,
  }).finally(() => {
    writer.close().catch(() => {});
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}

interface RunArgs {
  env: Env;
  selectedSectorIds: string[];
  catalogMap: Map<string, { id: string; name: string; shortName?: string }>;
  corpus: NewsCorpus;
  cleanedHistory: ChatMessage[];
  sendEvent: (obj: unknown) => Promise<void>;
}

async function runDashboardConversation(args: RunArgs): Promise<void> {
  const { env, selectedSectorIds, catalogMap, corpus, cleanedHistory, sendEvent } = args;
  const systemPrompt = buildDashboardSystemPrompt(
    selectedSectorIds,
    catalogMap,
    corpus,
  );

  const model = env.OPENAI_MODEL || DEFAULT_MODEL;
  const tools = buildDashboardTools();

  type OAIMsg =
    | { role: "system" | "user" | "assistant"; content: string }
    | {
        role: "assistant";
        content: string | null;
        tool_calls: Array<{
          id: string;
          type: "function";
          function: { name: string; arguments: string };
        }>;
      }
    | { role: "tool"; tool_call_id: string; content: string };

  const oaiMessages: OAIMsg[] = [
    { role: "system", content: systemPrompt },
    ...cleanedHistory.map(
      (m) => ({ role: m.role, content: m.content }) as OAIMsg,
    ),
  ];

  const toolCallLog: Array<{ name: string; args: unknown; ok: boolean }> = [];
  const touchedSources = new Map<string, { read: boolean }>();
  let toolEventCounter = 0;

  for (let round = 0; round < DASHBOARD_MAX_TOOL_ROUNDS; round++) {
    const isFinalRound = round === DASHBOARD_MAX_TOOL_ROUNDS - 1;
    const body: Record<string, unknown> = {
      model,
      temperature: 0.3,
      messages: oaiMessages,
    };
    if (!isFinalRound) {
      body.tools = tools;
      body.tool_choice = "auto";
    }

    await sendEvent({ type: "phase", phase: "thinking" });

    let openaiRes: Response;
    try {
      openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      await sendEvent({
        type: "error",
        message: `OpenAI request failed: ${(e as Error).message}`,
      });
      return;
    }

    if (!openaiRes.ok) {
      const detail = await openaiRes.text();
      await sendEvent({
        type: "error",
        message: `OpenAI ${openaiRes.status}: ${detail.slice(0, 500)}`,
      });
      return;
    }

    const data = (await openaiRes.json()) as {
      choices?: Array<{
        message?: {
          role?: string;
          content?: string | null;
          tool_calls?: Array<{
            id: string;
            type: string;
            function: { name: string; arguments: string };
          }>;
        };
        finish_reason?: string;
      }>;
    };
    const msg = data.choices?.[0]?.message;
    if (!msg) {
      await sendEvent({ type: "error", message: "OpenAI returned no message" });
      return;
    }

    const toolCalls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];

    if (toolCalls.length === 0) {
      const content = (msg.content ?? "").trim();
      if (!content) {
        await sendEvent({ type: "error", message: "OpenAI returned empty content" });
        return;
      }
      await sendEvent({ type: "phase", phase: "answering" });
      // Word-chunked fake-streaming so the answer flows in even though we
      // didn't ask OpenAI for token streaming. Splitting on whitespace
      // boundaries keeps markdown intact.
      const chunks = content.match(/\S+\s*/g) ?? [content];
      for (const c of chunks) {
        await sendEvent({ type: "delta", text: c });
      }
      const sources = collectSources(touchedSources, corpus, catalogMap);
      await sendEvent({
        type: "done",
        content,
        sources,
        toolCalls: toolCallLog,
        model,
        rounds: round + 1,
      });
      return;
    }

    oaiMessages.push({
      role: "assistant",
      content: msg.content ?? null,
      tool_calls: toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: { name: tc.function.name, arguments: tc.function.arguments },
      })),
    });

    for (const tc of toolCalls) {
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = tc.function.arguments
          ? (JSON.parse(tc.function.arguments) as Record<string, unknown>)
          : {};
      } catch {
        parsedArgs = {};
      }
      const id = ++toolEventCounter;
      const startedSummary = summarizeToolStart(
        tc.function.name,
        parsedArgs,
        catalogMap,
        corpus,
      );
      await sendEvent({
        type: "tool",
        id,
        name: tc.function.name,
        status: "started",
        summary: startedSummary,
      });
      const result = await runDashboardTool(
        env,
        tc.function.name,
        parsedArgs,
        { selectedSectorIds, catalog: catalogMap, corpus },
      );
      toolCallLog.push({
        name: tc.function.name,
        args: parsedArgs,
        ok: !result.error,
      });
      recordTouchedSources(touchedSources, tc.function.name, parsedArgs, result);
      const finishedSummary = summarizeToolFinish(
        tc.function.name,
        parsedArgs,
        result,
        corpus,
      );
      await sendEvent({
        type: "tool",
        id,
        name: tc.function.name,
        status: result.error ? "error" : "ok",
        summary: finishedSummary,
      });
      oaiMessages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(result.payload),
      });
    }
  }

  await sendEvent({
    type: "error",
    message: "Model exceeded its tool-call budget without producing an answer.",
  });
}

// Short human-readable string describing a tool call as it starts.
// Shown live in the client's tool trace while the call is in flight.
function summarizeToolStart(
  name: string,
  args: Record<string, unknown>,
  catalog: Map<string, { id: string; name: string; shortName?: string }>,
  corpus: NewsCorpus,
): string {
  switch (name) {
    case "list_sectors":
      return "Listing all sectors";
    case "list_headlines": {
      const ids = Array.isArray(args.sectorIds) ? args.sectorIds.filter(
        (s): s is string => typeof s === "string",
      ) : [];
      if (ids.length === 0) return "Listing headlines";
      if (ids.length === 1)
        return `Listing headlines in ${catalog.get(ids[0])?.name ?? ids[0]}`;
      return `Listing headlines across ${ids.length} sectors`;
    }
    case "search_news": {
      const q = typeof args.query === "string" ? args.query : "";
      return q ? `Searching for “${q}”` : "Searching news";
    }
    case "get_news_details": {
      const ids = Array.isArray(args.ids) ? args.ids.filter(
        (s): s is string => typeof s === "string",
      ) : [];
      if (ids.length === 1) {
        const n = corpus.byId.get(ids[0]);
        return n
          ? `Reading details for “${truncate(n.headline, 60)}”`
          : "Reading details";
      }
      return `Reading details for ${ids.length} stories`;
    }
    case "fetch_article": {
      const id = typeof args.id === "string" ? args.id : "";
      const n = id ? corpus.byId.get(id) : null;
      return n
        ? `Opening source — “${truncate(n.headline, 60)}”`
        : "Opening source";
    }
    case "compare_news": {
      const ids = Array.isArray(args.ids) ? args.ids.filter(
        (s): s is string => typeof s === "string",
      ) : [];
      return `Comparing ${ids.length} stories`;
    }
    default:
      return name;
  }
}

function summarizeToolFinish(
  name: string,
  args: Record<string, unknown>,
  result: ToolResult,
  corpus: NewsCorpus,
): string {
  if (result.error) return "Failed";
  const p = (result.payload ?? {}) as Record<string, unknown>;
  switch (name) {
    case "list_sectors": {
      const sectors = Array.isArray(p.sectors) ? p.sectors : [];
      return `Found ${sectors.length} sectors`;
    }
    case "list_headlines": {
      const sectors = Array.isArray(p.sectors) ? p.sectors : [];
      let total = 0;
      for (const s of sectors) {
        const r = s as { returned?: unknown };
        if (typeof r.returned === "number") total += r.returned;
      }
      return `Listed ${total} headlines`;
    }
    case "search_news": {
      const returned = typeof p.returned === "number" ? p.returned : 0;
      return `Found ${returned} matches`;
    }
    case "get_news_details": {
      const returned = typeof p.returned === "number" ? p.returned : 0;
      return `Got ${returned} stories`;
    }
    case "fetch_article": {
      const id = typeof args.id === "string" ? args.id : "";
      const n = id ? corpus.byId.get(id) : null;
      const ok = typeof p.body === "string" && p.body.length > 0;
      if (ok) return `Read source · ${n?.source ?? ""}`.trim().replace(/·\s*$/, "");
      return "Source unavailable";
    }
    case "compare_news": {
      const returned = typeof p.returned === "number" ? p.returned : 0;
      return `Compared ${returned} stories`;
    }
    default:
      return "Done";
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

function buildDashboardSystemPrompt(
  selectedSectorIds: string[],
  catalog: Map<string, { id: string; name: string; shortName?: string }>,
  corpus: NewsCorpus,
): string {
  const lines: string[] = [];
  lines.push(
    "You are a senior sector-research analyst embedded in a live news dashboard.",
    "The user is talking to the dashboard as a whole — possibly across multiple sectors at once.",
    "",
    "You have a small catalog of tools that you should use AS THE PRIMARY way to ground answers in real data:",
    " • list_sectors — every sector available in the dashboard, with counts.",
    " • list_headlines — lightweight per-sector headlines (id, headline, sentiment, impact, urgency, time).",
    " • search_news — substring search across the selected sectors (or all sectors).",
    " • get_news_details — full analyst fields (whyItMatters / bull / bear / catalyst / KPIs / companies) by news id.",
    " • fetch_article — the readable text of a news item's source URL.",
    " • compare_news — compact side-by-side table for multiple news ids.",
    "",
    "Operating rules:",
    " 1. Default to the user's selected sectors. Call list_sectors only if the user asks about sectors outside the selection.",
    " 2. Start by listing headlines for the selected sectors when the question is broad; drill into get_news_details for items the user is actually asking about.",
    " 3. Batch ids when possible — get_news_details and compare_news both accept arrays.",
    " 4. Cite news items inline using their headline (in quotes) and source — never expose raw ids to the user.",
    " 5. Be concise and structured: short paragraphs and bullet points. No personalized investment advice. No hedging.",
    " 6. When comparing news across sectors, use compare_news rather than narrating each item separately.",
    "",
    "When to call fetch_article (the readable source body):",
    " • The user asks for 'more', 'more about', 'deeper', 'details', 'what does the article say', 'tell me more', or any follow-up that wants depth on a specific item — ALWAYS call fetch_article on that item's id before answering.",
    " • The user asks for specific numbers, quotes, dates, names, or facts that the analyst metadata doesn't already contain.",
    " • get_news_details came back without enough to answer the question — fall through to fetch_article on the same id(s) in the same turn, don't give up.",
    " • Cached for 30 days server-side — repeat fetches in the same conversation are basically free, do not hesitate.",
    "",
    "Conversation memory: when the user says 'this story', 'that headline', 'the NCLAT one', etc. without restating the id, infer the referent from your earlier tool results in the same conversation and act on it directly. Do not ask the user to repeat themselves.",
    "",
    "VOICE — this surface is shown to paying clients. Be brief and polished. Never reveal the plumbing.",
    " • Never refer to YOURSELF in the response. Do not write 'I', 'I'm', 'me', 'my', 'I'll', 'I've' — there is no first person. The dashboard speaks; the agent does not exist.",
    " • LEAD with the substance — a concrete fact about the story, the comparison, or the takeaway. NEVER open with a sentence about what you do or don't have, or what you tried to do.",
    " • Banned phrasings — do not use, and do not paraphrase your way around them:",
    "     'I couldn't…', 'I could not…', 'I was unable…', 'I am unable…', 'I don't have…', 'I do not have…', 'I cannot find…', 'I can't find…',",
    "     'no additional details are available', 'no further details', 'no further specifics', 'further specifics are not accessible', 'further details are not accessible',",
    "     'at this moment', 'at the moment', 'at this time', 'currently',",
    "     'based on the headline', 'based on the available data', 'from the available information', \"here's a summary based on…\",",
    "     'the article body could not be fetched', 'paywall', 'access issues', 'access restrictions',",
    "     'unfortunately', 'apologies', \"I'm sorry\", 'sorry'.",
    "   Any of these (or a near-paraphrase) in a response is a failure. Just answer.",
    " • Never mention tools, fetching, caching, scraping, network, or any reason content might be missing.",
    " • Never link to the source with 'read the full article here' / 'click here'. The dashboard already exposes source links in its own UI.",
    " • If only metadata + analyst fields are available, present them DIRECTLY as the answer with no preface and no meta-commentary. The very first words should be the news subject (e.g. 'The Meghalaya coal-transport probe found …'), not a status report on your information.",
    " • If you genuinely cannot answer from the data on hand, ask ONE short neutral clarifying question (e.g. 'Which sector should this be scoped to?'). Do not enumerate what's missing.",
    "",
  );

  if (selectedSectorIds.length === 0) {
    lines.push("=== USER SCOPE ===");
    lines.push(
      "The user has not selected any sectors. Treat the whole dashboard as in scope and call list_sectors first if you need orientation.",
    );
  } else {
    lines.push("=== SELECTED SECTORS ===");
    for (const id of selectedSectorIds) {
      const meta = catalog.get(id);
      const items = corpus.bySector.get(id) ?? [];
      const name = meta?.name ?? id;
      const loadedAt = corpus.loadedAtBySector.get(id);
      const stamp = loadedAt
        ? new Date(loadedAt).toISOString()
        : "unknown";
      lines.push(
        ` • ${name} (id=${id}): ${items.length} item(s), last synced ${stamp}`,
      );
    }
  }
  lines.push("");
  lines.push("Today is " + new Date().toISOString().slice(0, 10) + ".");

  return lines.join("\n");
}

function buildDashboardTools() {
  return [
    {
      type: "function" as const,
      function: {
        name: "list_sectors",
        description:
          "List every sector the dashboard tracks, with id, display name, and the number of news items currently synced. Use this when the user asks about sectors outside their current selection.",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "list_headlines",
        description:
          "Lightweight headlines for one or more sectors, ranked by impact + recency. Each entry includes id, headline, sector, sentiment, impactScore (0-10), urgency, theme, source, and publishedAt. Use this to discover what's in a sector before drilling in.",
        parameters: {
          type: "object",
          properties: {
            sectorIds: {
              type: "array",
              items: { type: "string" },
              description:
                "Sector ids to fetch headlines for. If omitted or empty, the user's selected sectors are used.",
            },
            limit: {
              type: "number",
              description: `Max headlines per sector. Default ${DASHBOARD_DEFAULT_HEADLINES_PER_SECTOR}, capped at ${DASHBOARD_MAX_HEADLINES_PER_SECTOR}.`,
            },
          },
          additionalProperties: false,
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "search_news",
        description:
          "Case-insensitive substring search across headline, summary, theme, subsector, and affected companies. Defaults to the user's selected sectors; pass scope='all' to search every sector.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search string (required)." },
            sectorIds: {
              type: "array",
              items: { type: "string" },
              description: "Optional explicit sector ids. Overrides scope.",
            },
            scope: {
              type: "string",
              enum: ["selected", "all"],
              description:
                "Defaults to 'selected'. Use 'all' to search the entire dashboard.",
            },
            limit: {
              type: "number",
              description: `Max results to return. Default 15, capped at ${DASHBOARD_MAX_SEARCH_RESULTS}.`,
            },
          },
          required: ["query"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "get_news_details",
        description:
          "Full analyst-grade fields for specific news items by id: whyItMatters, bull case, bear case, related catalyst, affected companies, KPIs, time horizon, source confidence, etc. Call AFTER list_headlines or search_news; batch multiple ids in one call.",
        parameters: {
          type: "object",
          properties: {
            ids: {
              type: "array",
              items: { type: "string" },
              description: `News item ids (1..${DASHBOARD_MAX_DETAIL_IDS}).`,
            },
          },
          required: ["ids"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "fetch_article",
        description:
          "Fetch and return the readable text of a news item's source URL. Cached for 30 days in KV. Capped at ~8k chars per call. Use only when the question actually requires article body content (e.g. specific numbers or quotes).",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string", description: "News item id." },
          },
          required: ["id"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "compare_news",
        description:
          "Compact side-by-side comparison of multiple news items. Returns the key analyst fields per item in a structured form ready for the user to read.",
        parameters: {
          type: "object",
          properties: {
            ids: {
              type: "array",
              items: { type: "string" },
              description: `News item ids to compare (2..${DASHBOARD_MAX_COMPARE_IDS}).`,
            },
          },
          required: ["ids"],
          additionalProperties: false,
        },
      },
    },
  ];
}

interface ToolContext {
  selectedSectorIds: string[];
  catalog: Map<string, { id: string; name: string; shortName?: string }>;
  corpus: NewsCorpus;
}

interface ToolResult {
  payload: unknown;
  error?: boolean;
}

async function runDashboardTool(
  env: Env,
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  switch (name) {
    case "list_sectors":
      return { payload: toolListSectors(ctx) };
    case "list_headlines":
      return { payload: toolListHeadlines(args, ctx) };
    case "search_news":
      return { payload: toolSearchNews(args, ctx) };
    case "get_news_details":
      return { payload: toolGetNewsDetails(args, ctx) };
    case "fetch_article":
      return { payload: await toolFetchArticle(env, args, ctx) };
    case "compare_news":
      return { payload: toolCompareNews(args, ctx) };
    default:
      return {
        payload: { error: `Unknown tool: ${name}` },
        error: true,
      };
  }
}

function recordTouchedSources(
  touched: Map<string, { read: boolean }>,
  name: string,
  args: Record<string, unknown>,
  result: ToolResult,
) {
  if (name === "get_news_details" || name === "compare_news") {
    const ids = Array.isArray(args.ids)
      ? args.ids.filter((s): s is string => typeof s === "string")
      : [];
    for (const id of ids) {
      if (!touched.has(id)) touched.set(id, { read: false });
    }
  } else if (name === "fetch_article") {
    const id = typeof args.id === "string" ? args.id : "";
    if (!id) return;
    // The tool returns either { body, ... } when the source was read or
    // { error, ... } when it wasn't. We mark `read` from the payload shape.
    const payload = result.payload as { body?: unknown } | undefined;
    const wasRead =
      !!payload && typeof payload.body === "string" && payload.body.length > 0;
    const existing = touched.get(id);
    if (existing) existing.read = existing.read || wasRead;
    else touched.set(id, { read: wasRead });
  }
}

interface SourceRow {
  id: string;
  headline: string;
  source?: string;
  sourceType?: string;
  publishedAt?: string;
  newsUrl?: string;
  sectorId: string;
  sectorName: string;
  read: boolean;
}

function collectSources(
  touched: Map<string, { read: boolean }>,
  corpus: NewsCorpus,
  catalog: Map<string, { id: string; name: string; shortName?: string }>,
): SourceRow[] {
  const out: SourceRow[] = [];
  for (const [id, info] of touched) {
    const n = corpus.byId.get(id);
    if (!n) continue;
    out.push({
      id: n.id,
      headline: n.headline,
      source: n.source,
      sourceType: n.sourceType,
      publishedAt: n.publishedAt,
      newsUrl: n.newsUrl,
      sectorId: n.sector,
      sectorName: catalog.get(n.sector)?.name ?? n.sector,
      read: info.read,
    });
  }
  // Read sources first, then the rest, then alphabetical-ish stable order.
  out.sort((a, b) => {
    if (a.read !== b.read) return a.read ? -1 : 1;
    return a.headline.localeCompare(b.headline);
  });
  return out;
}

function toolListSectors(ctx: ToolContext) {
  const rows: Array<{ id: string; name: string; count: number }> = [];
  // Include any sector in the catalog plus any that have synced items —
  // union so the model can see empty sectors too.
  const ids = new Set<string>([
    ...ctx.catalog.keys(),
    ...ctx.corpus.bySector.keys(),
  ]);
  for (const id of ids) {
    const meta = ctx.catalog.get(id);
    rows.push({
      id,
      name: meta?.name ?? id,
      count: (ctx.corpus.bySector.get(id) ?? []).length,
    });
  }
  rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return { sectors: rows, totalNewsItems: ctx.corpus.byId.size };
}

function resolveSectorIds(
  raw: unknown,
  ctx: ToolContext,
  fallbackToSelected: boolean,
): string[] {
  if (Array.isArray(raw)) {
    const cleaned = raw
      .filter((s): s is string => typeof s === "string" && s.length > 0)
      .filter((s) => ctx.corpus.bySector.has(s) || ctx.catalog.has(s));
    if (cleaned.length > 0) return cleaned;
  }
  if (fallbackToSelected) return ctx.selectedSectorIds.slice();
  return [];
}

function toolListHeadlines(args: Record<string, unknown>, ctx: ToolContext) {
  const sectorIds = resolveSectorIds(args.sectorIds, ctx, true);
  const requested =
    typeof args.limit === "number" && Number.isFinite(args.limit)
      ? args.limit
      : DASHBOARD_DEFAULT_HEADLINES_PER_SECTOR;
  const limit = Math.max(
    1,
    Math.min(DASHBOARD_MAX_HEADLINES_PER_SECTOR, Math.floor(requested)),
  );

  if (sectorIds.length === 0) {
    return {
      sectors: [],
      note: "No sectors resolved — user has no selection and none were passed.",
    };
  }

  const out = sectorIds.map((id) => {
    const items = ctx.corpus.bySector.get(id) ?? [];
    const ranked = rankNewsForTool(items).slice(0, limit);
    return {
      sectorId: id,
      sectorName: ctx.catalog.get(id)?.name ?? id,
      total: items.length,
      returned: ranked.length,
      headlines: ranked.map(toHeadlineRow),
    };
  });
  return { sectors: out };
}

function toolSearchNews(args: Record<string, unknown>, ctx: ToolContext) {
  const query = typeof args.query === "string" ? args.query.trim() : "";
  if (!query) {
    return { error: "query is required and must be a non-empty string." };
  }
  const scope = args.scope === "all" ? "all" : "selected";
  let sectorIds: string[] = [];
  if (Array.isArray(args.sectorIds)) {
    sectorIds = resolveSectorIds(args.sectorIds, ctx, false);
  }
  if (sectorIds.length === 0) {
    sectorIds =
      scope === "all"
        ? Array.from(ctx.corpus.bySector.keys())
        : ctx.selectedSectorIds.slice();
  }
  if (sectorIds.length === 0) sectorIds = Array.from(ctx.corpus.bySector.keys());

  const limitReq =
    typeof args.limit === "number" && Number.isFinite(args.limit)
      ? args.limit
      : 15;
  const limit = Math.max(
    1,
    Math.min(DASHBOARD_MAX_SEARCH_RESULTS, Math.floor(limitReq)),
  );

  const needle = query.toLowerCase();
  const hits: StoredNewsItem[] = [];
  for (const id of sectorIds) {
    const items = ctx.corpus.bySector.get(id) ?? [];
    for (const n of items) {
      const hay =
        (n.headline ?? "") +
        " " +
        (n.summary ?? "") +
        " " +
        (n.theme ?? "") +
        " " +
        (n.subsector ?? "") +
        " " +
        (n.affectedCompanies ?? []).join(" ");
      if (hay.toLowerCase().includes(needle)) hits.push(n);
    }
  }

  const ranked = rankNewsForTool(hits).slice(0, limit);
  return {
    query,
    scope: Array.isArray(args.sectorIds) && args.sectorIds.length > 0 ? "custom" : scope,
    sectorsSearched: sectorIds,
    total: hits.length,
    returned: ranked.length,
    results: ranked.map(toHeadlineRow),
  };
}

function toolGetNewsDetails(args: Record<string, unknown>, ctx: ToolContext) {
  const ids = Array.isArray(args.ids)
    ? args.ids.filter((s): s is string => typeof s === "string")
    : [];
  if (ids.length === 0) return { error: "ids must be a non-empty array." };
  const trimmed = ids.slice(0, DASHBOARD_MAX_DETAIL_IDS);
  const found: unknown[] = [];
  const missing: string[] = [];
  for (const id of trimmed) {
    const n = ctx.corpus.byId.get(id);
    if (!n) {
      missing.push(id);
      continue;
    }
    found.push(toDetailRow(n, ctx));
  }
  return {
    requested: trimmed.length,
    returned: found.length,
    items: found,
    missing,
    truncated: ids.length > trimmed.length,
  };
}

async function toolFetchArticle(
  env: Env,
  args: Record<string, unknown>,
  ctx: ToolContext,
) {
  const id = typeof args.id === "string" ? args.id : "";
  if (!id) return { error: "id is required." };
  const n = ctx.corpus.byId.get(id);
  if (!n) return { error: `Unknown news id: ${id}` };
  if (!n.newsUrl) {
    return {
      id,
      headline: n.headline,
      source: n.source,
      error: "This news item has no source URL.",
    };
  }
  const news: NewsContext = {
    id: n.id,
    headline: n.headline,
    summary: n.summary,
    sector: n.sector,
    newsUrl: n.newsUrl,
  };
  const text = await getSourceText(env, news);
  if (!text) {
    return {
      id,
      headline: n.headline,
      source: n.source,
      url: n.newsUrl,
      error:
        "Article body could not be fetched (paywall, JS-rendered page, or network error).",
    };
  }
  const trimmed = text.slice(0, DASHBOARD_ARTICLE_TRIM);
  return {
    id,
    headline: n.headline,
    source: n.source,
    url: n.newsUrl,
    sector: ctx.catalog.get(n.sector)?.name ?? n.sector,
    body: trimmed,
    truncated: text.length > trimmed.length,
    bodyLength: trimmed.length,
  };
}

function toolCompareNews(args: Record<string, unknown>, ctx: ToolContext) {
  const ids = Array.isArray(args.ids)
    ? args.ids.filter((s): s is string => typeof s === "string")
    : [];
  if (ids.length < 2) {
    return { error: "compare_news requires at least 2 ids." };
  }
  const trimmed = ids.slice(0, DASHBOARD_MAX_COMPARE_IDS);
  const rows: unknown[] = [];
  const missing: string[] = [];
  for (const id of trimmed) {
    const n = ctx.corpus.byId.get(id);
    if (!n) {
      missing.push(id);
      continue;
    }
    rows.push({
      id: n.id,
      headline: n.headline,
      sector: ctx.catalog.get(n.sector)?.name ?? n.sector,
      subsector: n.subsector,
      theme: n.theme,
      sentiment: n.sentiment,
      impactScore: n.impactScore,
      urgency: n.urgency,
      timeHorizon: n.timeHorizon,
      affectedCompanies: n.affectedCompanies,
      kpiAffected: n.kpiAffected,
      source: n.source,
      sourceType: n.sourceType,
      sourceConfidence: n.sourceConfidence,
      publishedAt: n.publishedAt,
      summary: n.summary,
    });
  }
  return {
    requested: trimmed.length,
    returned: rows.length,
    items: rows,
    missing,
    truncated: ids.length > trimmed.length,
  };
}

function toHeadlineRow(n: StoredNewsItem) {
  return {
    id: n.id,
    headline: n.headline,
    sector: n.sector,
    subsector: n.subsector,
    theme: n.theme,
    sentiment: n.sentiment,
    impactScore: n.impactScore,
    urgency: n.urgency,
    source: n.source,
    publishedAt: n.publishedAt,
  };
}

function toDetailRow(n: StoredNewsItem, ctx: ToolContext) {
  return {
    id: n.id,
    headline: n.headline,
    summary: n.summary,
    sector: ctx.catalog.get(n.sector)?.name ?? n.sector,
    sectorId: n.sector,
    subsector: n.subsector,
    theme: n.theme,
    sentiment: n.sentiment,
    impactScore: n.impactScore,
    urgency: n.urgency,
    timeHorizon: n.timeHorizon,
    affectedCompanies: n.affectedCompanies,
    kpiAffected: n.kpiAffected,
    whyItMatters: n.whyItMatters,
    bullCase: n.bullCase,
    bearCase: n.bearCase,
    relatedCatalyst: n.relatedCatalyst,
    source: n.source,
    sourceType: n.sourceType,
    sourceConfidence: n.sourceConfidence,
    publishedAt: n.publishedAt,
    newsUrl: n.newsUrl,
  };
}

// Same ranking idea as the client's rankNewsByImpact — impact × urgency,
// nudged by recency. Implemented again here so the worker stays standalone.
function rankNewsForTool(items: StoredNewsItem[]): StoredNewsItem[] {
  const now = Date.now();
  const urgencyWeight: Record<string, number> = {
    Critical: 1,
    High: 0.75,
    Medium: 0.5,
    Low: 0.25,
  };
  return items.slice().sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    return rb - ra;
  });
  function rank(n: StoredNewsItem) {
    const impact = typeof n.impactScore === "number" ? n.impactScore : 5;
    const u = urgencyWeight[n.urgency ?? "Medium"] ?? 0.5;
    const ageH = n.publishedAt
      ? Math.max(0, (now - new Date(n.publishedAt).getTime()) / 3_600_000)
      : 72;
    const r =
      ageH <= 1 ? 1 : ageH <= 6 ? 0.92 : ageH <= 24 ? 0.78 : ageH <= 72 ? 0.55 : ageH <= 168 ? 0.3 : 0.1;
    const conf =
      typeof n.sourceConfidence === "number"
        ? Math.max(0, Math.min(100, n.sourceConfidence))
        : 60;
    return impact * 10 + u * 6 + r * 5 + (conf / 100) * 3;
  }
}

async function loadNewsCorpus(env: Env): Promise<NewsCorpus> {
  const raw = await env.NEWS_KV.get(KV_KEY);
  const bySector = new Map<string, StoredNewsItem[]>();
  const byId = new Map<string, StoredNewsItem>();
  const loadedAtBySector = new Map<string, number>();
  if (!raw) return { bySector, byId, loadedAtBySector };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { bySector, byId, loadedAtBySector };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { bySector, byId, loadedAtBySector };
  }
  for (const [sectorId, payload] of Object.entries(
    parsed as Record<string, unknown>,
  )) {
    if (!payload || typeof payload !== "object") continue;
    const p = payload as { items?: unknown; loadedAt?: unknown };
    if (typeof p.loadedAt === "number") {
      loadedAtBySector.set(sectorId, p.loadedAt);
    }
    if (!Array.isArray(p.items)) continue;
    const cleaned: StoredNewsItem[] = [];
    for (const raw of p.items) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as StoredNewsItem;
      if (typeof r.id !== "string" || typeof r.headline !== "string") continue;
      cleaned.push(r);
      byId.set(r.id, r);
    }
    bySector.set(sectorId, cleaned);
  }
  return { bySector, byId, loadedAtBySector };
}

function buildSystemPrompt(news: NewsContext, sourceText: string | null): string {
  const lines: string[] = [];
  lines.push(
    "You are a senior equity research assistant embedded in a sector-news dashboard.",
    "Help the user reason about a single news item: implications, risks, second-order effects, and what to watch next.",
    "Ground answers in the article context below; if the user asks something the article doesn't cover, say so and reason from general market knowledge.",
    "Be concise and structured. Prefer short paragraphs and bullet points. Do not give personalized investment advice.",
    "",
    "=== NEWS ITEM ===",
    `Headline: ${news.headline}`,
  );
  if (news.summary) lines.push(`Summary: ${news.summary}`);
  if (news.sector) lines.push(`Sector: ${news.sector}`);
  if (news.subsector) lines.push(`Subsector: ${news.subsector}`);
  if (news.theme) lines.push(`Theme: ${news.theme}`);
  if (news.sentiment) lines.push(`Sentiment: ${news.sentiment}`);
  if (news.urgency) lines.push(`Urgency: ${news.urgency}`);
  if (typeof news.impactScore === "number")
    lines.push(`Impact score (0-10): ${news.impactScore}`);
  if (news.timeHorizon) lines.push(`Time horizon: ${news.timeHorizon}`);
  if (news.publishedAt) lines.push(`Published: ${news.publishedAt}`);
  if (news.source) lines.push(`Source: ${news.source}`);
  if (news.sourceType) lines.push(`Source type: ${news.sourceType}`);
  if (typeof news.sourceConfidence === "number")
    lines.push(`Source confidence: ${news.sourceConfidence}%`);
  if (news.newsUrl) lines.push(`URL: ${news.newsUrl}`);
  if (news.affectedCompanies?.length)
    lines.push(`Affected companies: ${news.affectedCompanies.join(", ")}`);
  if (news.kpiAffected?.length)
    lines.push(`KPIs affected: ${news.kpiAffected.join(", ")}`);
  if (news.whyItMatters) lines.push(`Why it matters: ${news.whyItMatters}`);
  if (news.bullCase) lines.push(`Bull case: ${news.bullCase}`);
  if (news.bearCase) lines.push(`Bear case: ${news.bearCase}`);
  if (news.relatedCatalyst)
    lines.push(`Related catalyst: ${news.relatedCatalyst}`);

  lines.push("", "=== ARTICLE CONTENT ===");
  if (sourceText) {
    lines.push(sourceText);
  } else {
    lines.push(
      "(Article body could not be fetched — paywall, JS-rendered page, or network error. Work from the metadata above and ask the user to paste relevant excerpts if needed.)",
    );
  }

  return lines.join("\n");
}
