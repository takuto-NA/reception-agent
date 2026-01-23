import { weatherTool } from "./weather-tool";

export const tools = {
  weather: weatherTool,
};

export type ToolKey = keyof typeof tools;

export const toolCatalog: Array<{
  key: ToolKey;
  id: string;
  description?: string;
}> = Object.entries(tools).map(([key, tool]) => ({
  key: key as ToolKey,
  id: (tool as any).id,
  description: (tool as any).description,
}));

