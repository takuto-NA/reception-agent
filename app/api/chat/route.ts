import { mastra } from "@/mastra/index";
import { toAISdkStream } from "@mastra/ai-sdk";
import { createUIMessageStreamResponse } from "ai";
import { RequestContext } from "@mastra/core/request-context";
import { getAppConfig, resolveGroqApiKey } from "@/lib/appConfig";
import { z } from "zod";

export const runtime = "nodejs";

const MAX_CHAT_MESSAGES = 200;

const ChatMessageSchema = z.unknown();

const ChatRequestSchema = z
  .object({
    messages: z.array(ChatMessageSchema).max(MAX_CHAT_MESSAGES),
  })
  .passthrough();

function toUiMessageStream(agentStream: unknown) {
  /**
   * Responsibility:
   * - Bridge Mastra's stream type into the AI SDK UI stream for Next.js responses.
   *
   * Notes:
   * - Mastra/AI SDK stream types are intentionally kept flexible; we keep the cast localized here.
   */
  return toAISdkStream(agentStream as any, { from: "agent" });
}

async function withTemporaryGroqApiKey<T>(
  groqApiKey: string | null,
  action: () => Promise<T>,
): Promise<T> {
  /**
   * Responsibility:
   * - Provide Groq API key to the underlying provider during this request.
   *
   * Notes:
   * - Mastra's Groq router uses `process.env.GROQ_API_KEY` internally.
   * - This project targets local single-user usage; for multi-tenant concurrency, prefer a provider instance per request.
   */
  if (!groqApiKey) return action();

  const previousGroqApiKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = groqApiKey;
  try {
    return await action();
  } finally {
    // Guard: restore previous environment variable state.
    if (typeof previousGroqApiKey === "undefined") {
      delete process.env.GROQ_API_KEY;
    } else {
      process.env.GROQ_API_KEY = previousGroqApiKey;
    }
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    // Guard: invalid JSON.
    if (!body) {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsedBody = ChatRequestSchema.safeParse(body);
    // Guard: invalid request shape.
    if (!parsedBody.success) {
      return Response.json(
        { error: "Invalid request", details: parsedBody.error.flatten() },
        { status: 400 },
      );
    }

    const config = await getAppConfig();
    const groqApiKey = await resolveGroqApiKey();
    // Guard: missing API key configuration.
    if (!groqApiKey) {
      return Response.json(
        {
          error: "Groq API key is not configured",
          detail:
            "Set GROQ_API_KEY in .env.local, or set an API key from the Settings page (requires APP_CONFIG_ENCRYPTION_KEY).",
        },
        { status: 400 },
      );
    }

    const requestContext = new RequestContext();
    requestContext.set("model", config.model);

    const agent = mastra.getAgent("chatAgent");
    /**
     * Responsibility:
     * - Pass through the AI SDK message array to Mastra.
     *
     * Notes:
     * - `@ai-sdk/react` and Mastra's `MessageListInput` types don't align 1:1 across versions.
     * - We validate "messages is an array" at the boundary and keep the cast localized here.
     */
    const stream = await withTemporaryGroqApiKey(groqApiKey, async () => {
      return await agent.stream(parsedBody.data.messages as any, {
        requestContext,
        system: { role: "system", content: config.systemPrompt },
        activeTools: config.enabledTools,
      });
    });

    const uiMessageStream = toUiMessageStream(stream);
    return createUIMessageStreamResponse({ stream: uiMessageStream as any });
  } catch (caughtError) {
    return Response.json(
      { error: "Chat request failed", detail: String(caughtError) },
      { status: 500 },
    );
  }
}
