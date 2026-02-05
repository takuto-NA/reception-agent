import { mastra } from "@/mastra/index";
import { toAISdkStream } from "@mastra/ai-sdk";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessageChunk,
} from "ai";
import { RequestContext } from "@mastra/core/request-context";
import { CHAT_AGENT_KEY } from "@/mastra/agents/registry";
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

// Tool visibility policy: prevent tool logs from leaking into the user-visible text.
const INTERNAL_TOOL_OUTPUT_POLICY = [
  "Tool usage policy (critical):",
  "- Tools are internal. Do not mention tools or tool execution.",
  "- Never output tool call traces or tool results verbatim.",
  '- Never output strings like "[TOOL_RESULT]" or "[END_TOOL_RESULT]".',
  "- Call tools only when the user explicitly asks for information that requires tools (e.g., weather).",
  "- Do not volunteer weather/temperature or similar tool-derived facts unless the user explicitly asked for it.",
  '- If the user greets (e.g., "こんにちは"), reply with a greeting and a helpful follow-up question instead of calling tools or stating weather.',
].join("\n");

const WEATHER_TOOL_KEY = "weather";
const LMSTUDIO_MODEL_PREFIX_PATTERN = /^lmstudio\//i;
const TOOL_LOG_BLOCK_START_MARKER = "[TOOL_RESULT]";
const TOOL_LOG_BLOCK_END_MARKER = "[END_TOOL_RESULT]";
const GREETING_ONLY_PATTERN =
  /^\s*(こんにちは|こんばんは|おはよう|hello|hi|hey)\s*[!！。.\u3000]*\s*$/i;
const WEATHER_INTENT_KEYWORDS = [
  "天気",
  "気温",
  "降水",
  "雨",
  "晴れ",
  "曇",
  "雪",
  "weather",
  "forecast",
  "temperature",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractLatestUserText(messages: unknown[]): string {
  /**
   * Responsibility:
   * - Extract the latest user message as plain text for lightweight intent checks.
   *
   * Notes:
   * - The AI SDK message shape can vary by version (content string vs parts array).
   */
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!isRecord(message)) continue;
    if (message.role !== "user") continue;

    const content = message.content;
    if (typeof content === "string") return content;

    const parts = message.parts;
    if (!Array.isArray(parts)) return "";

    const text = parts
      .map((part) => {
        if (!isRecord(part)) return "";
        if (part.type === "text" && typeof part.text === "string") return part.text;
        return "";
      })
      .join("");

    return text;
  }

  return "";
}

function includesAnyKeyword(haystack: string, keywords: string[]): boolean {
  const normalized = haystack.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function deriveActiveToolsForRequest(params: {
  enabledTools: string[];
  latestUserText: string;
}): string[] {
  /**
   * Responsibility:
   * - Avoid unsolicited tool calls by gating tool availability per request.
   *
   * Notes:
   * - Currently this project only registers the `weather` tool.
   * - If the user message does not indicate weather intent, we disable the weather tool.
   */
  const enabledTools = params.enabledTools;
  const latestUserText = params.latestUserText.trim();
  // Guard: no user text -> do not enable tools.
  if (!latestUserText) return [];

  const isWeatherIntent = includesAnyKeyword(latestUserText, WEATHER_INTENT_KEYWORDS);
  if (isWeatherIntent) return enabledTools;

  return enabledTools.filter((toolKey) => toolKey !== WEATHER_TOOL_KEY);
}

const ChatRequestSchema = z
  .object({
    messages: z.array(ChatMessageSchema).max(MAX_CHAT_MESSAGES),
  })
  .passthrough();

type MastraAgentStream = Parameters<typeof toAISdkStream>[0];

function createStaticAssistantTextStreamResponse(text: string): Response {
  /**
   * Responsibility:
   * - Return a valid AI SDK UI message stream response without calling any model/tools.
   *
   * Notes:
   * - Used as a safety mechanism for greetings/small talk to prevent UX accidents.
   */
  const textId = "static-text";
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: "text-start", id: textId });
      writer.write({ type: "text-delta", id: textId, delta: text });
      writer.write({ type: "text-end", id: textId });
    },
  });
  return createUIMessageStreamResponse({ stream });
}

function isGreetingOnlyMessage(text: string): boolean {
  return GREETING_ONLY_PATTERN.test(text);
}

function sanitizeUiMessageStream(
  stream: ReadableStream<UIMessageChunk>,
): ReadableStream<UIMessageChunk> {
  /**
   * Responsibility:
   * - Prevent tool logs from leaking into user-visible text as a last line of defense.
   *
   * Notes:
   * - We only sanitize text deltas. Non-text chunks are forwarded as-is.
   * - Streaming can split marker strings across chunks; we must handle cross-chunk markers.
   */
  let isInToolLogBlock = false;
  const markerStart = TOOL_LOG_BLOCK_START_MARKER;
  const markerEnd = TOOL_LOG_BLOCK_END_MARKER;
  const markerScanTailLength = Math.max(markerStart.length, markerEnd.length) - 1;
  let carry = "";
  let activeTextId: string | null = null;
  let isTextOpen = false;

  function dropPartialMarkerSuffix(value: string): string {
    /**
     * Responsibility:
     * - Remove a trailing partial marker (prefix of start/end) to avoid leaking it on stream end.
     */
    if (!value) return value;
    for (let position = 0; position < value.length; position += 1) {
      const suffix = value.slice(position);
      if (markerStart.startsWith(suffix) || markerEnd.startsWith(suffix)) {
        return value.slice(0, position);
      }
    }
    return value;
  }

  return stream.pipeThrough(
    new TransformStream<UIMessageChunk, UIMessageChunk>({
      transform(chunk, controller) {
        if (chunk.type === "text-start") {
          activeTextId = chunk.id;
          isTextOpen = true;
          controller.enqueue(chunk);
          return;
        }

        if (chunk.type === "text-end") {
          // Guard: flush remaining safe carry before ending the text part.
          if (isTextOpen && activeTextId === chunk.id && !isInToolLogBlock) {
            const safeCarry = dropPartialMarkerSuffix(carry);
            carry = "";
            if (safeCarry) {
              controller.enqueue({
                type: "text-delta",
                id: chunk.id,
                delta: safeCarry,
              });
            }
          }
          controller.enqueue(chunk);
          if (activeTextId === chunk.id) {
            isTextOpen = false;
            activeTextId = null;
          }
          return;
        }

        if (chunk.type !== "text-delta") {
          controller.enqueue(chunk);
          return;
        }

        let combined = carry + chunk.delta;
        carry = "";

        while (combined.length > 0) {
          if (isInToolLogBlock) {
            const endIndex = combined.indexOf(markerEnd);
            if (endIndex === -1) {
              // Guard: still inside tool block; keep small tail to detect end marker.
              if (combined.length > markerScanTailLength) {
                carry = combined.slice(-markerScanTailLength);
              } else {
                carry = combined;
              }
              return;
            }

            combined = combined.slice(endIndex + markerEnd.length);
            isInToolLogBlock = false;
            continue;
          }

          const startIndex = combined.indexOf(markerStart);
          if (startIndex === -1) {
            // Guard: no marker start found; emit safe content and keep tail.
            if (combined.length <= markerScanTailLength) {
              carry = combined;
              return;
            }
            const safeText = combined.slice(0, combined.length - markerScanTailLength);
            carry = combined.slice(combined.length - markerScanTailLength);
            controller.enqueue({ ...chunk, delta: safeText });
            return;
          }

          const before = combined.slice(0, startIndex);
          if (before) {
            controller.enqueue({ ...chunk, delta: before });
          }
          combined = combined.slice(startIndex + markerStart.length);
          isInToolLogBlock = true;
        }
      },
      flush() {
        // Note:
        // - We intentionally do not emit extra chunks here.
        // - Emitting a new text-delta without a matching text-start breaks the UI stream protocol.
        // - Remaining carry is flushed on 'text-end' with the correct id.
      },
    }),
  );
}

type LmStudioConfig = NonNullable<ReturnType<typeof resolveLmStudioConfig>>;

function getValidLmStudioConfigOrErrorResponse(): {
  config: LmStudioConfig;
} | { errorResponse: Response } {
  /**
   * Responsibility:
   * - Validate LMSTUDIO configuration and return a user-friendly error response on failure.
   */
  const lmStudioConfig = resolveLmStudioConfig();
  if (!lmStudioConfig) {
    return {
      errorResponse: Response.json(
        {
          error: "LMSTUDIO configuration is missing",
          detail:
            "Set LMSTUDIO_BASE_URL in .env.local (e.g., http://127.0.0.1:1234).",
        },
        { status: 400 },
      ),
    };
  }

  try {
    const url = new URL(lmStudioConfig.baseUrl);
    // Guard: protocol must be http(s).
    if (!["http:", "https:"].includes(url.protocol)) {
      return {
        errorResponse: Response.json(
          {
            error: "Invalid LMSTUDIO base URL protocol",
            detail: "LMSTUDIO_BASE_URL must use http:// or https:// protocol.",
          },
          { status: 400 },
        ),
      };
    }
  } catch (urlError) {
    return {
      errorResponse: Response.json(
        {
          error: "Invalid LMSTUDIO base URL format",
          detail: `LMSTUDIO_BASE_URL is invalid: ${String(urlError)}`,
        },
        { status: 400 },
      ),
    };
  }

  return { config: lmStudioConfig };
}

function getLmStudioModelNameOrErrorResponse(params: {
  modelId: string;
}): { modelName: string } | { errorResponse: Response } {
  /**
   * Responsibility:
   * - Extract the actual LMSTUDIO model name from "lmstudio/<model>" identifier.
   */
  const modelName = params.modelId.replace(LMSTUDIO_MODEL_PREFIX_PATTERN, "");
  // Guard: model name must not be empty after prefix removal.
  if (!modelName) {
    return {
      errorResponse: Response.json(
        {
          error: "Invalid LMSTUDIO model name",
          detail: `Model identifier "${params.modelId}" must include a model name after "lmstudio/" prefix.`,
        },
        { status: 400 },
      ),
    };
  }
  return { modelName };
}

function toUiMessageStream(agentStream: unknown) {
  /**
   * Responsibility:
   * - Bridge Mastra's stream type into the AI SDK UI stream for Next.js responses.
   *
   * Notes:
   * - Mastra/AI SDK stream types are intentionally kept flexible; we keep the cast localized here.
   */
  return toAISdkStream(agentStream as MastraAgentStream, { from: "agent" });
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
function createLmStudioProvider(config: LmStudioConfig) {
  try {
    // Guard: ensure baseURL ends with /v1 for OpenAI-compatible API.
    // LMSTUDIO uses /v1/chat/completions endpoint.
    const trimmedBaseUrl = config.baseUrl.trim();
    let baseUrl = trimmedBaseUrl;
    if (!baseUrl.endsWith("/v1")) {
      baseUrl = baseUrl.endsWith("/") ? `${baseUrl}v1` : `${baseUrl}/v1`;
    }

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
  /**
   * Responsibility:
   * - Validate request, resolve settings, and stream Mastra agent output as AI SDK UI stream.
   */
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
    const latestUserText = extractLatestUserText(parsedBody.data.messages);
    // Guard: greetings should not call tools or volunteer tool-derived facts.
    if (isGreetingOnlyMessage(latestUserText)) {
      return createStaticAssistantTextStreamResponse(
        "こんにちは！今日は何をお手伝いしましょうか？",
      );
    }
    const activeTools = deriveActiveToolsForRequest({
      enabledTools: config.enabledTools,
      latestUserText,
    });
    const systemPrompt = [config.systemPrompt, INTERNAL_TOOL_OUTPUT_POLICY].join("\n\n");

    // Guard: validate provider configuration based on model type.
    let validatedLmStudioConfig: LmStudioConfig | null = null;
    if (isLmStudio) {
      const validated = getValidLmStudioConfigOrErrorResponse();
      if ("errorResponse" in validated) return validated.errorResponse;
      validatedLmStudioConfig = validated.config;
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
      // Guard: validated earlier.
      if (!validatedLmStudioConfig) {
        return Response.json(
          {
            error: "LMSTUDIO configuration is missing",
            detail:
              "Set LMSTUDIO_BASE_URL in .env.local (e.g., http://127.0.0.1:1234).",
          },
          { status: 400 },
        );
      }

      const lmStudioProvider = createLmStudioProvider(validatedLmStudioConfig);
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

      const modelNameResult = getLmStudioModelNameOrErrorResponse({ modelId });
      if ("errorResponse" in modelNameResult) return modelNameResult.errorResponse;

      const chatModel = lmStudioProvider.chatModel(modelNameResult.modelName);
      requestContext.set("provider", chatModel);
    }

    const agent = mastra.getAgent(CHAT_AGENT_KEY);
    const messagesForAgent = parsedBody.data.messages as unknown as Parameters<
      typeof agent.stream
    >[0];
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
      ? await agent.stream(messagesForAgent, {
          requestContext,
          system: { role: "system", content: systemPrompt },
          activeTools,
        })
      : await withTemporaryGroqApiKey(
          await resolveGroqApiKey(),
          async () => {
            return await agent.stream(messagesForAgent, {
              requestContext,
              system: { role: "system", content: systemPrompt },
              activeTools,
            });
          },
        );

    const uiMessageStream = toUiMessageStream(stream);
    const sanitizedStream = sanitizeUiMessageStream(
      uiMessageStream as unknown as ReadableStream<UIMessageChunk>,
    );
    return createUIMessageStreamResponse({ stream: sanitizedStream });
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
