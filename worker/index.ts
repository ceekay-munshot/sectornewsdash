interface Env {
  ASSETS: Fetcher;
  NEWS_KV: KVNamespace;
}

const KV_KEY = "agent-news-by-sector-v1";

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
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

    return env.ASSETS.fetch(req);
  },
};
