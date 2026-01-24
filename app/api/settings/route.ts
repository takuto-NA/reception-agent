import { z } from "zod";
import { getAppConfig, upsertAppConfig } from "@/lib/appConfig";
import { toolCatalog, type ToolKey } from "@/mastra/tools/registry";

export const runtime = "nodejs";

const SYSTEM_PROMPT_MIN_LENGTH = 1;
const SYSTEM_PROMPT_MAX_LENGTH = 8000;
const MODEL_ID_MIN_LENGTH = 1;
const MODEL_ID_MAX_LENGTH = 200;
const ENABLED_TOOLS_MAX_COUNT = 100;

const ToolKeySchema = z.enum(
  toolCatalog.map((toolCatalogItem) => toolCatalogItem.key) as [
    ToolKey,
    ...ToolKey[],
  ],
);

const UpdateSchema = z
  .object({
    systemPrompt: z
      .string()
      .min(SYSTEM_PROMPT_MIN_LENGTH)
      .max(SYSTEM_PROMPT_MAX_LENGTH)
      .optional(),
    model: z
      .string()
      .min(MODEL_ID_MIN_LENGTH)
      .max(MODEL_ID_MAX_LENGTH)
      .optional(),
    enabledTools: z
      .array(ToolKeySchema)
      .max(ENABLED_TOOLS_MAX_COUNT)
      .optional(),
  })
  .strict();

export async function GET() {
  const config = await getAppConfig();
  return Response.json(config);
}

export async function PUT(request: Request) {
  const requestBody = await request.json();
  const parsed = UpdateSchema.safeParse(requestBody);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const config = await upsertAppConfig(parsed.data);
  return Response.json(config);
}
