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
  model: ({ requestContext }) =>
    (requestContext.get("model") as string | undefined) ??
    process.env.GROQ_MODEL ??
    "groq/llama-3.3-70b-versatile",
  tools,
  memory: new Memory(),
});

