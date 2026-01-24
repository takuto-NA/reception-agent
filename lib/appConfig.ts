import { prisma } from "./prisma";
import { toolCatalog, type ToolKey } from "@/mastra/tools/registry";

export type AppConfigDTO = {
  systemPrompt: string;
  model: string;
  enabledTools: ToolKey[];
};

const ENABLED_TOOL_KEY_SET = new Set<ToolKey>(
  toolCatalog.map((tool) => tool.key),
);

function parseEnabledToolsJson(value: unknown): ToolKey[] {
  // Guard: Prisma Json might be null/unknown.
  if (!Array.isArray(value)) return DEFAULTS.enabledTools;

  const enabledTools = value.filter((item): item is ToolKey => {
    if (typeof item !== "string") return false;
    return ENABLED_TOOL_KEY_SET.has(item as ToolKey);
  });

  // Guard: empty or fully invalid config -> fall back to defaults.
  if (enabledTools.length === 0) return DEFAULTS.enabledTools;
  return enabledTools;
}

const DEFAULTS: AppConfigDTO = {
  systemPrompt:
    "You are a helpful assistant. Be concise, ask clarifying questions when needed, and use tools when appropriate.",
  model: process.env.GROQ_MODEL ?? "groq/llama-3.3-70b-versatile",
  enabledTools: toolCatalog.map((t) => t.key),
};

export async function getAppConfig(): Promise<AppConfigDTO> {
  const row = await prisma.appConfig.findUnique({ where: { id: "default" } });
  if (!row) return DEFAULTS;
  const enabledTools = parseEnabledToolsJson(row.enabledTools);
  return { systemPrompt: row.systemPrompt, model: row.model, enabledTools };
}

export async function upsertAppConfig(input: Partial<AppConfigDTO>) {
  const current = await getAppConfig();
  const next: AppConfigDTO = {
    systemPrompt: input.systemPrompt ?? current.systemPrompt,
    model: input.model ?? current.model,
    enabledTools: input.enabledTools ?? current.enabledTools,
  };

  await prisma.appConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      systemPrompt: next.systemPrompt,
      model: next.model,
      enabledTools: next.enabledTools,
    },
    update: {
      systemPrompt: next.systemPrompt,
      model: next.model,
      enabledTools: next.enabledTools,
    },
  });

  return next;
}
