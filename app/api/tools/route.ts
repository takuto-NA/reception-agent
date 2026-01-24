import { toolCatalog } from "@/mastra/tools/registry";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ tools: toolCatalog });
}
