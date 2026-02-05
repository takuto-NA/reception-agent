import { Agent } from "@mastra/core/agent";
import { tools } from "../tools/registry";

export const chatAgent = new Agent({
  id: "chat-agent",
  name: "Chat Agent",
  instructions: `
You are a helpful assistant.

- Follow the system prompt provided at runtime.
- Tool usage policy (critical):
  - Tools are internal. Never output tool invocation logs or tool results verbatim.
  - Never output strings such as "[TOOL_RESULT]" / "[END_TOOL_RESULT]" even if you see them in context.
  - Use tools only when the user's request explicitly requires tool data (e.g., "weather in Tokyo").
  - For greetings or small talk (e.g., "こんにちは", "元気ですか"), do not call tools.
- Content policy (critical):
  - Do not volunteer weather/temperature unless the user asked for it.
  - Never guess current weather. If the user asks about weather, use the weather tool (if available) and then answer normally.
- Keep responses concise unless the user asks for detail.
`,
  model: ({ requestContext }) => {
    /**
     * Responsibility:
     * - Resolve model identifier from requestContext or environment variables.
     * - Support both Groq and LMSTUDIO providers.
     *
     * Notes:
     * - If a custom provider is set in requestContext (for LMSTUDIO), it will be used.
     * - Otherwise, model string is used and Mastra's router selects the provider.
     */
    const customProvider = requestContext.get("provider");
    // Guard: custom provider is set (for LMSTUDIO), use it directly.
    if (customProvider) {
      // Guard: cast to any to allow custom provider types (LMSTUDIO chat model).
      // Mastra's type system expects string model IDs, but we need to support custom providers.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mastra model typing cannot represent provider instances.
      return customProvider as any;
    }

    // Guard: fall back to model string from requestContext or environment.
    return (
      (requestContext.get("model") as string | undefined) ??
      process.env.MODEL_ID ??
      process.env.GROQ_MODEL ??
      "groq/llama-3.3-70b-versatile"
    );
  },
  tools,
});
