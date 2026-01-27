/**
 * Responsibility:
 * - Provide a tiny, typed API layer for the Settings page.
 *
 * Notes:
 * - Keep fetch/JSON parsing and error shaping out of the component for readability.
 */

export type TextToSpeechEngine = "webSpeech" | "voicevox";

export type WebSpeechVoiceSettingsDTO = {
  rate: number;
  pitch: number;
  volume: number;
};

export type VoiceVoxVoiceSettingsDTO = {
  engineUrl: string;
  speakerId: number;
  speedScale: number;
  pitchScale: number;
  intonationScale: number;
  volumeScale: number;
};

export type VoiceSettingsDTO = {
  isVoiceConversationModeEnabledByDefault: boolean;
  isAutoSendEnabledByDefault: boolean;
  isTextToSpeechEnabledByDefault: boolean;
  speechLanguageTag: string;
  textToSpeechEngine: TextToSpeechEngine;
  webSpeech: WebSpeechVoiceSettingsDTO;
  voicevox: VoiceVoxVoiceSettingsDTO;
};

export type AppConfigDTO = {
  systemPrompt: string;
  model: string;
  enabledTools: string[];
  voiceSettings: VoiceSettingsDTO;
  hasGroqApiKey: boolean;
};

export type ToolCatalogItem = {
  key: string;
  id: string;
  description?: string;
};

type ToolsResponseBody = { tools: ToolCatalogItem[] };

function getErrorMessage(caughtError: unknown): string {
  if (caughtError instanceof Error) return caughtError.message;
  if (typeof caughtError === "string") return caughtError;
  return String(caughtError);
}

async function readJson<ResponseBody>(
  response: Response,
): Promise<ResponseBody> {
  try {
    const body = (await response.json()) as ResponseBody;
    return body;
  } catch {
    throw new Error("Invalid JSON response");
  }
}

export async function fetchSettings(signal?: AbortSignal): Promise<AppConfigDTO> {
  const response = await fetch("/api/settings", { signal });
  if (response.ok) {
    const responseBody = await readJson<unknown>(response);
    return responseBody as AppConfigDTO;
  }

  const responseText = await response.text().catch(() => "");
  const fallbackMessage = `Load failed (status: ${response.status})`;
  if (!responseText.trim()) throw new Error(fallbackMessage);

  try {
    const parsedJson = JSON.parse(responseText) as unknown;
    const errorText =
      typeof parsedJson === "object" &&
      parsedJson !== null &&
      "error" in parsedJson
        ? String((parsedJson as { error?: unknown }).error)
        : fallbackMessage;
    throw new Error(errorText);
  } catch {
    throw new Error(responseText);
  }
}

export async function fetchToolCatalog(
  signal?: AbortSignal,
): Promise<ToolCatalogItem[]> {
  const response = await fetch("/api/tools", { signal });
  if (response.ok) {
    const responseBody = await readJson<unknown>(response);
    const toolsPayload = responseBody as ToolsResponseBody;
    return toolsPayload.tools ?? [];
  }

  const responseText = await response.text().catch(() => "");
  const fallbackMessage = `Load failed (status: ${response.status})`;
  if (!responseText.trim()) throw new Error(fallbackMessage);
  throw new Error(responseText);
}

export async function updateSettings(
  nextConfig: AppConfigDTO,
): Promise<AppConfigDTO> {
  // Guard: do not send derived / server-managed fields (e.g. `hasGroqApiKey`) back to the API.
  const updatePayload = {
    systemPrompt: nextConfig.systemPrompt,
    model: nextConfig.model,
    enabledTools: nextConfig.enabledTools,
    voiceSettings: nextConfig.voiceSettings,
  };
  const updateResponse = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updatePayload),
  });

  if (updateResponse.ok) {
    const responseBody = await readJson<unknown>(updateResponse);
    return responseBody as AppConfigDTO;
  }

  const responseText = await updateResponse.text().catch(() => "");
  const fallbackMessage = `Save failed (status: ${updateResponse.status})`;
  if (!responseText.trim()) throw new Error(fallbackMessage);
  throw new Error(responseText);
}

export async function updateGroqApiKey(groqApiKey: string): Promise<AppConfigDTO> {
  const updateResponse = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groqApiKey }),
  });

  if (updateResponse.ok) {
    const responseBody = await readJson<unknown>(updateResponse);
    return responseBody as AppConfigDTO;
  }

  const responseText = await updateResponse.text().catch(() => "");
  const fallbackMessage = `Save failed (status: ${updateResponse.status})`;
  if (!responseText.trim()) throw new Error(fallbackMessage);
  throw new Error(responseText);
}

export async function clearStoredGroqApiKey(): Promise<AppConfigDTO> {
  const updateResponse = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clearGroqApiKey: true }),
  });

  if (updateResponse.ok) {
    const responseBody = await readJson<unknown>(updateResponse);
    return responseBody as AppConfigDTO;
  }

  const responseText = await updateResponse.text().catch(() => "");
  const fallbackMessage = `Save failed (status: ${updateResponse.status})`;
  if (!responseText.trim()) throw new Error(fallbackMessage);
  throw new Error(responseText);
}

export function toSettingsErrorMessage(caughtError: unknown): string {
  return getErrorMessage(caughtError);
}
