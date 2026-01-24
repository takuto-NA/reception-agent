import { weatherTool } from "./weather-tool";

/**
 * Responsibility:
 * - Register all Mastra tools in one place.
 * - Provide a safe, typed catalog for the Settings UI (/api/tools).
 */
export const tools = {
  weather: weatherTool,
};

export type ToolKey = keyof typeof tools;

type ToolDefinition = {
  id: string;
  description?: string;
};

function getToolDefinition(tool: unknown): ToolDefinition {
  // Guard: tool must be an object.
  if (typeof tool !== "object" || tool === null) {
    throw new Error("Invalid tool: expected an object.");
  }

  const id = (tool as { id?: unknown }).id;
  // Guard: tool.id must be a non-empty string.
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Invalid tool: expected a non-empty string id.");
  }

  const description = (tool as { description?: unknown }).description;
  return {
    id,
    description: typeof description === "string" ? description : undefined,
  };
}

export const toolCatalog: Array<{
  key: ToolKey;
  id: string;
  description?: string;
}> = Object.entries(tools).map(([toolKey, tool]) => {
  const toolDefinition = getToolDefinition(tool);
  return {
    key: toolKey as ToolKey,
    id: toolDefinition.id,
    description: toolDefinition.description,
  };
});
