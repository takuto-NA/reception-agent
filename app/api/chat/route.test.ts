// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

function createUiMessageChunkStream(chunks: unknown[]): ReadableStream<unknown> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

describe("/api/chat route", () => {
  it("does not call Mastra for greeting-only input", async () => {
    vi.resetModules();
    const getAgent = vi.fn();

    vi.doMock("@/mastra/index", () => ({
      mastra: { getAgent },
    }));
    vi.doMock("@/lib/appConfig", () => ({
      getAppConfig: vi.fn(async () => ({
        systemPrompt: "test",
        model: "groq/llama-3.3-70b-versatile",
        enabledTools: ["weather"],
        voiceSettings: {
          isVoiceConversationModeEnabledByDefault: false,
          isAutoSendEnabledByDefault: true,
          isTextToSpeechEnabledByDefault: true,
          speechLanguageTag: "ja-JP",
          textToSpeechEngine: "webSpeech",
          webSpeech: { rate: 1, pitch: 1, volume: 1 },
          voicevox: {
            engineUrl: "http://127.0.0.1:50021",
            speakerId: 1,
            speedScale: 1,
            pitchScale: 0,
            intonationScale: 1,
            volumeScale: 1,
          },
        },
        hasGroqApiKey: false,
      })),
      resolveGroqApiKey: vi.fn(async () => "dummy"),
      resolveLmStudioConfig: vi.fn(() => null),
      isLmStudioModel: vi.fn(() => false),
    }));
    vi.doMock("@/mastra/agents/registry", () => ({ CHAT_AGENT_KEY: "chatAgent" }));
    vi.doMock("@mastra/ai-sdk", () => ({
      toAISdkStream: vi.fn(),
    }));

    const { POST } = await import("./route");

    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "こんにちは" }] }),
    });
    const response = await POST(request);
    const responseText = await response.text();

    expect(response.status).toBe(200);
    expect(responseText).toContain("こんにちは！今日は何をお手伝いしましょうか？");
    expect(getAgent).not.toHaveBeenCalled();
  });

  it("sanitizes tool log markers from streamed text", async () => {
    vi.resetModules();
    const agentStream = vi.fn(async () => "dummy-agent-stream");
    const getAgent = vi.fn(() => ({ stream: agentStream }));
    const toAISdkStream = vi.fn(() =>
      createUiMessageChunkStream([
        { type: "text-start", id: "t1" },
        {
          type: "text-delta",
          id: "t1",
          delta: "現在の天気をお調べします。\\n[TOOL_",
        },
        {
          type: "text-delta",
          id: "t1",
          delta: "RESULT]{\"name\":\"weather\"}\\n[END_",
        },
        {
          type: "text-delta",
          id: "t1",
          delta: "TOOL_RESULT]\\nこんにちは",
        },
        { type: "text-end", id: "t1" },
      ]),
    );

    vi.doMock("@/mastra/index", () => ({
      mastra: { getAgent },
    }));
    vi.doMock("@/lib/appConfig", () => ({
      getAppConfig: vi.fn(async () => ({
        systemPrompt: "test",
        model: "groq/llama-3.3-70b-versatile",
        enabledTools: ["weather"],
        voiceSettings: {
          isVoiceConversationModeEnabledByDefault: false,
          isAutoSendEnabledByDefault: true,
          isTextToSpeechEnabledByDefault: true,
          speechLanguageTag: "ja-JP",
          textToSpeechEngine: "webSpeech",
          webSpeech: { rate: 1, pitch: 1, volume: 1 },
          voicevox: {
            engineUrl: "http://127.0.0.1:50021",
            speakerId: 1,
            speedScale: 1,
            pitchScale: 0,
            intonationScale: 1,
            volumeScale: 1,
          },
        },
        hasGroqApiKey: false,
      })),
      resolveGroqApiKey: vi.fn(async () => "dummy"),
      resolveLmStudioConfig: vi.fn(() => null),
      isLmStudioModel: vi.fn(() => false),
    }));
    vi.doMock("@/mastra/agents/registry", () => ({ CHAT_AGENT_KEY: "chatAgent" }));
    vi.doMock("@mastra/ai-sdk", () => ({
      toAISdkStream,
    }));

    const { POST } = await import("./route");

    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "東京の天気は？" }],
      }),
    });
    const response = await POST(request);
    const responseText = await response.text();

    expect(response.status).toBe(200);
    expect(getAgent).toHaveBeenCalled();
    expect(agentStream).toHaveBeenCalled();
    expect(toAISdkStream).toHaveBeenCalled();
    expect(responseText).not.toContain("[TOOL_RESULT]");
    expect(responseText).not.toContain("[END_TOOL_RESULT]");
    expect(responseText).toContain("現在の天気");
    expect(responseText).toContain("をお調べします。");
    expect(responseText).toContain("こんにちは");
  });
});

