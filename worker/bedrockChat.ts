// Claude/Bedrock chat provider — a self-contained parallel path to the
// OpenAI calls in worker/index.ts. Selected only when env.LLM_PROVIDER is
// set to "claude" (default remains "openai", see worker/index.ts).
//
// bedrockChatCompletion() takes the exact same request body shape the
// OpenAI Chat Completions calls in index.ts already build (model,
// temperature, messages incl. system/user/assistant/tool roles and
// tool_calls, tools, tool_choice) and returns a Response whose JSON body
// mirrors the OpenAI Chat Completions response shape
// (`{ choices: [{ message: { role, content, tool_calls? }, finish_reason }] }`)
// so every downstream caller in index.ts works unmodified regardless of
// which provider answered.
//
// To remove the Claude path entirely: delete this file and the
// `provider === "claude"` branches in worker/index.ts — the OpenAI logic is
// untouched by either.

export interface BedrockEnv {
  // Bedrock bearer API key. Set via
  // `npx wrangler secret put temp_claude_token`. Never bake into client.
  temp_claude_token?: string;
  // Optional overrides — default to us-east-1 /
  // us.anthropic.claude-sonnet-4-5-20250929-v1:0. ASSUMPTION: verify these
  // against the target AWS account before relying on this in production.
  BEDROCK_REGION?: string;
  BEDROCK_MODEL_ID?: string;
}

const DEFAULT_BEDROCK_REGION = "us-east-1";
const DEFAULT_BEDROCK_MODEL_ID = "us.anthropic.claude-sonnet-4-5-20250929-v1:0";

type OAIToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type OAIMessage = {
  role: string;
  content?: string | null;
  tool_calls?: OAIToolCall[];
  tool_call_id?: string;
};

type OAIFunctionTool = {
  type: "function";
  function: { name: string; description?: string; parameters?: unknown };
};

export type OAIChatBody = {
  model?: string;
  temperature?: number;
  messages: OAIMessage[];
  tools?: OAIFunctionTool[];
  tool_choice?: unknown;
  response_format?: unknown;
};

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function bedrockChatCompletion(
  env: BedrockEnv,
  body: OAIChatBody,
): Promise<Response> {
  if (!env.temp_claude_token) {
    return errorResponse(
      "Claude Bedrock token not configured. Set the temp_claude_token secret on the Worker.",
      500,
    );
  }

  const region = env.BEDROCK_REGION || DEFAULT_BEDROCK_REGION;
  const modelId = env.BEDROCK_MODEL_ID || DEFAULT_BEDROCK_MODEL_ID;

  const systemBlocks: Array<{ text: string }> = [];
  const converseMessages: Array<{ role: "user" | "assistant"; content: unknown[] }> = [];

  for (const m of body.messages) {
    if (m.role === "system") {
      if (typeof m.content === "string" && m.content) {
        systemBlocks.push({ text: m.content });
      }
      continue;
    }

    if (m.role === "user") {
      converseMessages.push({ role: "user", content: [{ text: m.content ?? "" }] });
      continue;
    }

    if (m.role === "assistant") {
      const content: unknown[] = [];
      if (typeof m.content === "string" && m.content) content.push({ text: m.content });
      for (const tc of m.tool_calls ?? []) {
        let input: unknown = {};
        try {
          input = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
        } catch {
          input = {};
        }
        content.push({
          toolUse: { toolUseId: tc.id, name: tc.function.name, input },
        });
      }
      if (content.length === 0) content.push({ text: "" });
      converseMessages.push({ role: "assistant", content });
      continue;
    }

    if (m.role === "tool") {
      converseMessages.push({
        role: "user",
        content: [
          {
            toolResult: {
              toolUseId: m.tool_call_id ?? "",
              content: [
                {
                  text:
                    typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? ""),
                },
              ],
            },
          },
        ],
      });
      continue;
    }
  }

  const converseBody: Record<string, unknown> = { messages: converseMessages };
  if (systemBlocks.length > 0) converseBody.system = systemBlocks;
  if (typeof body.temperature === "number") {
    converseBody.inferenceConfig = { temperature: body.temperature };
  }
  if (Array.isArray(body.tools) && body.tools.length > 0) {
    converseBody.toolConfig = {
      tools: body.tools.map((t) => ({
        toolSpec: {
          name: t.function.name,
          description: t.function.description ?? "",
          inputSchema: { json: t.function.parameters ?? { type: "object", properties: {} } },
        },
      })),
      toolChoice: { auto: {} },
    };
  }

  let bedrockRes: Response;
  try {
    bedrockRes = await fetch(
      `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/converse`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.temp_claude_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(converseBody),
      },
    );
  } catch (e) {
    return errorResponse(`Bedrock request failed: ${(e as Error).message}`, 502);
  }

  if (!bedrockRes.ok) {
    const detail = await bedrockRes.text();
    return errorResponse(
      `Bedrock ${bedrockRes.status}: ${detail.slice(0, 500)}`,
      bedrockRes.status >= 500 ? 502 : 400,
    );
  }

  const data = (await bedrockRes.json()) as {
    output?: {
      message?: {
        content?: Array<{
          text?: string;
          toolUse?: { toolUseId: string; name: string; input: unknown };
        }>;
      };
    };
    stopReason?: string;
  };

  const blocks = data.output?.message?.content ?? [];
  const textParts: string[] = [];
  const toolCalls: OAIToolCall[] = [];
  for (const block of blocks) {
    if (typeof block.text === "string") textParts.push(block.text);
    if (block.toolUse) {
      toolCalls.push({
        id: block.toolUse.toolUseId,
        type: "function",
        function: {
          name: block.toolUse.name,
          arguments: JSON.stringify(block.toolUse.input ?? {}),
        },
      });
    }
  }

  const message: { role: "assistant"; content: string | null; tool_calls?: OAIToolCall[] } = {
    role: "assistant",
    content: textParts.length > 0 ? textParts.join("") : null,
  };
  if (toolCalls.length > 0) message.tool_calls = toolCalls;

  const openaiShaped = {
    choices: [
      {
        message,
        finish_reason: data.stopReason === "tool_use" ? "tool_calls" : "stop",
      },
    ],
  };

  return new Response(JSON.stringify(openaiShaped), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
