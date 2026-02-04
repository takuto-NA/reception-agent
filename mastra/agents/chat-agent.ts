import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { tools } from "../tools/registry";

export const chatAgent = new Agent({
  id: "chat-agent",
  name: "Chat Agent",
  instructions: `
You are a helpful assistant.

- Follow the system prompt provided at runtime.
- Use tools when appropriate.
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
      return customProvider as any;
    }

    // Guard: fall back to model string from requestContext or environment.
    return (
      (requestContext.get("model") as string | undefined) ??
      process.env.GROQ_MODEL ??
      "groq/llama-3.3-70b-versatile"
    );
  },
  tools,
  memory: new Memory(),
});
