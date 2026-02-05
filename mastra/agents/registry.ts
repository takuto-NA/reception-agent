import { chatAgent } from "./chat-agent";
import { weatherAgent } from "./weather-agent";

/**
 * Responsibility:
 * - Centralize agent registration for Mastra.
 * - Provide a single source of truth for agent registration keys used by `mastra.getAgent(key)`.
 *
 * Notes:
 * - `Agent.id` is an internal identifier for logging/telemetry.
 * - The keys of this object are the **registration keys** used by `mastra.getAgent(...)`.
 */
export const agentRegistry = {
  chatAgent,
  weatherAgent,
} as const;

export type AgentKey = keyof typeof agentRegistry;

export const CHAT_AGENT_KEY: AgentKey = "chatAgent";
export const WEATHER_AGENT_KEY: AgentKey = "weatherAgent";

