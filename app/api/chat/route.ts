import { mastra } from "@/mastra/index";
import { toAISdkStream } from "@mastra/ai-sdk";
import { createUIMessageStreamResponse } from "ai";
import { RequestContext } from "@mastra/core/request-context";
import {
  getAppConfig,
  resolveGroqApiKey,
  resolveLmStudioConfig,
  isLmStudioModel,
} from "@/lib/appConfig";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
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

/**
 * Responsibility:
 * - Create LMSTUDIO provider instance with error handling.
 *
 * Returns:
 * - OpenAI-compatible provider instance, or null if configuration is invalid.
 */
function createLmStudioProvider() {
  const config = resolveLmStudioConfig();
  // Guard: LMSTUDIO configuration is required.
  if (!config) {
    return null;
  }

  try {
    // Guard: ensure baseURL ends with /v1 for OpenAI-compatible API.
    // LMSTUDIO uses /v1/chat/completions endpoint.
    const baseUrl = config.baseUrl.endsWith("/v1")
      ? config.baseUrl
      : config.baseUrl.endsWith("/")
      ? `${config.baseUrl}v1`
      : `${config.baseUrl}/v1`;

    return createOpenAICompatible({
      name: "lmstudio",
      baseURL: baseUrl,
      apiKey: config.apiKey,
    });
  } catch (error) {
    // Guard: provider creation failed.
    console.error("Failed to create LMSTUDIO provider:", error);
    return null;
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
    const modelId = config.model;
    const isLmStudio = isLmStudioModel(modelId);

    // Guard: validate provider configuration based on model type.
    if (isLmStudio) {
      const lmStudioConfig = resolveLmStudioConfig();
      if (!lmStudioConfig) {
        return Response.json(
          {
            error: "LMSTUDIO configuration is missing",
            detail:
              "Set LMSTUDIO_BASE_URL in .env.local (e.g., http://127.0.0.1:1234).",
          },
          { status: 400 },
        );
      }

      // Guard: validate LMSTUDIO base URL is reachable format.
      try {
        const url = new URL(lmStudioConfig.baseUrl);
        if (!["http:", "https:"].includes(url.protocol)) {
          return Response.json(
            {
              error: "Invalid LMSTUDIO base URL protocol",
              detail: "LMSTUDIO_BASE_URL must use http:// or https:// protocol.",
            },
            { status: 400 },
          );
        }
      } catch (urlError) {
        return Response.json(
          {
            error: "Invalid LMSTUDIO base URL format",
            detail: `LMSTUDIO_BASE_URL is invalid: ${String(urlError)}`,
          },
          { status: 400 },
        );
      }
    } else {
      const groqApiKey = await resolveGroqApiKey();
      // Guard: missing API key configuration for Groq.
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
    }

    const requestContext = new RequestContext();
    requestContext.set("model", modelId);

    // Guard: set LMSTUDIO provider if using LMSTUDIO model.
    if (isLmStudio) {
      const lmStudioProvider = createLmStudioProvider();
      if (!lmStudioProvider) {
        return Response.json(
          {
            error: "Failed to initialize LMSTUDIO provider",
            detail:
              "Check LMSTUDIO_BASE_URL and ensure LMSTUDIO server is running.",
          },
          { status: 500 },
        );
      }

      // Extract model name from "lmstudio/model-name" format.
      const actualModelName = modelId.replace(/^lmstudio\//i, "");
      // Guard: model name must not be empty after prefix removal.
      if (!actualModelName) {
        return Response.json(
          {
            error: "Invalid LMSTUDIO model name",
            detail: `Model identifier "${modelId}" must include a model name after "lmstudio/" prefix.`,
          },
          { status: 400 },
        );
      }

      const chatModel = lmStudioProvider.chatModel(actualModelName);
      requestContext.set("provider", chatModel);
    }

    const agent = mastra.getAgent("chatAgent");
    /**
     * Responsibility:
     * - Pass through the AI SDK message array to Mastra.
     *
     * Notes:
     * - `@ai-sdk/react` and Mastra's `MessageListInput` types don't align 1:1 across versions.
     * - We validate "messages is an array" at the boundary and keep the cast localized here.
     * - For LMSTUDIO, provider is set in requestContext; for Groq, API key is set via environment variable.
     */
    const stream = isLmStudio
      ? await agent.stream(parsedBody.data.messages as any, {
          requestContext,
          system: { role: "system", content: config.systemPrompt },
          activeTools: config.enabledTools,
        })
      : await withTemporaryGroqApiKey(
          await resolveGroqApiKey(),
          async () => {
            return await agent.stream(parsedBody.data.messages as any, {
              requestContext,
              system: { role: "system", content: config.systemPrompt },
              activeTools: config.enabledTools,
            });
          },
        );

    const uiMessageStream = toUiMessageStream(stream);
    return createUIMessageStreamResponse({ stream: uiMessageStream as any });
  } catch (caughtError) {
    // Guard: handle errors with detailed information for debugging.
    const errorMessage =
      caughtError instanceof Error ? caughtError.message : String(caughtError);
    const errorStack =
      caughtError instanceof Error ? caughtError.stack : undefined;

    // Guard: log error details for debugging (server-side only).
    console.error("Chat request failed:", {
      error: errorMessage,
      stack: errorStack,
    });

    // Guard: provide user-friendly error message without exposing internal details.
    return Response.json(
      {
        error: "Chat request failed",
        detail: errorMessage,
      },
      { status: 500 },
    );
  }
}
