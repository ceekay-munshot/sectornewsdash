interface Env {
  ASSETS: Fetcher;
  NEWS_KV: KVNamespace;
  // Set via `npx wrangler secret put OPENAI_API_KEY`. Never bake into client.
  OPENAI_API_KEY?: string;
  // Optional override; falls back to a sensible default model.
  OPENAI_MODEL?: string;
}

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
