import { mastra } from "@/mastra/index";
import { toAISdkStream } from "@mastra/ai-sdk";
import { createUIMessageStreamResponse } from "ai";
import { RequestContext } from "@mastra/core/request-context";
import { getAppConfig } from "@/lib/appConfig";
import { z } from "zod";

export const runtime = "nodejs";

const MAX_CHAT_MESSAGES = 200;

const ChatMessageSchema = z.unknown();

const ChatRequestSchema = z
  .object({
    messages: z.array(ChatMessageSchema).max(MAX_CHAT_MESSAGES),
  })
  .strict();

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
    const stream = await agent.stream(parsedBody.data.messages as any, {
      requestContext,
      system: { role: "system", content: config.systemPrompt },
      activeTools: config.enabledTools,
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
