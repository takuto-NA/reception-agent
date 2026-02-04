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
type ApiErrorResponse = {
  error?: string;
  detail?: string;
  code?: string;
};

const SETTINGS_ERROR_CODE_MESSAGE_MAP: Record<string, string> = {
  DB_SCHEMA_MISMATCH:
    "Database schema mismatch. Run `npm run db:setup` and confirm DATABASE_URL is file:./prisma/dev.db.",
  INVALID_JSON: "Invalid JSON request. Refresh the page and try again.",
};

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

function mapSettingsApiError(responseBody: ApiErrorResponse | null): string | null {
  if (!responseBody?.code) return null;
  const mappedMessage = SETTINGS_ERROR_CODE_MESSAGE_MAP[responseBody.code];
  return mappedMessage ?? null;
}

async function readSettingsApiError(response: Response): Promise<string> {
  const fallbackMessage = `Load failed (status: ${response.status})`;
  const responseText = await response.text().catch(() => "");
  if (!responseText.trim()) return fallbackMessage;

  try {
    const parsedJson = JSON.parse(responseText) as ApiErrorResponse;
    const mappedMessage = mapSettingsApiError(parsedJson);
    if (mappedMessage) return mappedMessage;
    if (parsedJson?.error) return String(parsedJson.error);
    return fallbackMessage;
  } catch {
    return responseText;
  }
}

export async function fetchSettings(signal?: AbortSignal): Promise<AppConfigDTO> {
  const response = await fetch("/api/settings", { signal });
  if (response.ok) {
    const responseBody = await readJson<unknown>(response);
    return responseBody as AppConfigDTO;
  }
  const errorMessage = await readSettingsApiError(response);
  throw new Error(errorMessage);
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
  const fallbackMessage = `Save failed (status: ${updateResponse.status})`;
  const responseText = await updateResponse.text().catch(() => "");
  if (!responseText.trim()) throw new Error(fallbackMessage);
  try {
    const parsedJson = JSON.parse(responseText) as ApiErrorResponse;
    const mappedMessage = mapSettingsApiError(parsedJson);
    if (mappedMessage) throw new Error(mappedMessage);
    if (parsedJson?.error) throw new Error(String(parsedJson.error));
    throw new Error(fallbackMessage);
  } catch {
    throw new Error(responseText);
  }
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
  const fallbackMessage = `Save failed (status: ${updateResponse.status})`;
  const responseText = await updateResponse.text().catch(() => "");
  if (!responseText.trim()) throw new Error(fallbackMessage);
  try {
    const parsedJson = JSON.parse(responseText) as ApiErrorResponse;
    const mappedMessage = mapSettingsApiError(parsedJson);
    if (mappedMessage) throw new Error(mappedMessage);
    if (parsedJson?.error) throw new Error(String(parsedJson.error));
    throw new Error(fallbackMessage);
  } catch {
    throw new Error(responseText);
  }
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
  const fallbackMessage = `Save failed (status: ${updateResponse.status})`;
  const responseText = await updateResponse.text().catch(() => "");
  if (!responseText.trim()) throw new Error(fallbackMessage);
  try {
    const parsedJson = JSON.parse(responseText) as ApiErrorResponse;
    const mappedMessage = mapSettingsApiError(parsedJson);
    if (mappedMessage) throw new Error(mappedMessage);
    if (parsedJson?.error) throw new Error(String(parsedJson.error));
    throw new Error(fallbackMessage);
  } catch {
    throw new Error(responseText);
  }
}

export function toSettingsErrorMessage(caughtError: unknown): string {
  return getErrorMessage(caughtError);
}
