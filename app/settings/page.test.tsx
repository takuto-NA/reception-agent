import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import SettingsLayout from "./layout";
import SettingsPage from "./page";

function createOkJsonResponse(jsonBody: unknown): Response {
  return {
    ok: true,
    json: async () => jsonBody,
  } as unknown as Response;
}

describe("Settings page", () => {
  it("renders heading", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => {
        return createOkJsonResponse({
          systemPrompt: "x",
          model: "y",
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
        });
      });

    render(
      <SettingsLayout>
        <SettingsPage />
      </SettingsLayout>,
    );
    expect(screen.getByRole("heading", { name: "Settings" })).toBeTruthy();
    await screen.findByDisplayValue("y");

    fetchSpy.mockRestore();
  });
});
