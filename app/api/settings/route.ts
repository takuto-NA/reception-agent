import { z } from "zod";
import { getAppConfig, upsertAppConfig } from "@/lib/appConfig";
import { toolCatalog, type ToolKey } from "@/mastra/tools/registry";

export const runtime = "nodejs";

const ToolKeySchema = z.enum(
  toolCatalog.map((t) => t.key) as [ToolKey, ...ToolKey[]],
);

const UpdateSchema = z
  .object({
    systemPrompt: z.string().min(1).max(8000).optional(),
    model: z.string().min(1).max(200).optional(),
    enabledTools: z.array(ToolKeySchema).max(100).optional(),
  })
  .strict();

export async function GET() {
  const config = await getAppConfig();
  return Response.json(config);
}

export async function PUT(req: Request) {
  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const config = await upsertAppConfig(parsed.data);
  return Response.json(config);
}

