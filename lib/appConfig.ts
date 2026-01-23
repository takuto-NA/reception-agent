import { prisma } from "./prisma";
import { toolCatalog, type ToolKey } from "@/mastra/tools/registry";

export type AppConfigDTO = {
  systemPrompt: string;
  model: string;
  enabledTools: ToolKey[];
};

const DEFAULTS: AppConfigDTO = {
  systemPrompt:
    "You are a helpful assistant. Be concise, ask clarifying questions when needed, and use tools when appropriate.",
  model: process.env.GROQ_MODEL ?? "groq/llama-3.3-70b-versatile",
  enabledTools: toolCatalog.map((t) => t.key),
};

export async function getAppConfig(): Promise<AppConfigDTO> {
  const row = await prisma.appConfig.findUnique({ where: { id: "default" } });
  if (!row) return DEFAULTS;
  const enabledTools = Array.isArray(row.enabledTools)
    ? (row.enabledTools as ToolKey[])
    : DEFAULTS.enabledTools;
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
      enabledTools: next.enabledTools as any,
    },
    update: {
      systemPrompt: next.systemPrompt,
      model: next.model,
      enabledTools: next.enabledTools as any,
    },
  });

  return next;
}

