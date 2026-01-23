import { mastra } from "@/mastra/index";
import { toAISdkStream } from "@mastra/ai-sdk";
import { createUIMessageStreamResponse } from "ai";
import { RequestContext } from "@mastra/core/request-context";
import { getAppConfig } from "@/lib/appConfig";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { messages } = (await req.json()) as { messages: unknown };

    const config = await getAppConfig();

    const requestContext = new RequestContext();
    requestContext.set("model", config.model);

    const agent = mastra.getAgent("chatAgent");
    const stream = await agent.stream(messages as any, {
      requestContext,
      system: { role: "system", content: config.systemPrompt },
      activeTools: config.enabledTools as any,
    });

    const uiMessageStream = toAISdkStream(stream as any, { from: "agent" });
    return createUIMessageStreamResponse({ stream: uiMessageStream as any });
  } catch (e) {
    return Response.json(
      { error: "Chat request failed", detail: String(e) },
      { status: 500 },
    );
  }
}

