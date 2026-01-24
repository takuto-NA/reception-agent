/**
 * Responsibility:
 * - Provide a tiny, typed API layer for the Settings page.
 *
 * Notes:
 * - Keep fetch/JSON parsing and error shaping out of the component for readability.
 */

export type AppConfigDTO = {
  systemPrompt: string;
  model: string;
  enabledTools: string[];
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
  const body = (await response.json()) as ResponseBody;
  return body;
}

export async function fetchSettingsAndTools(
  signal?: AbortSignal,
): Promise<{ config: AppConfigDTO; tools: ToolCatalogItem[] }> {
  const [settingsResponse, toolsResponse] = await Promise.all([
    fetch("/api/settings", { signal }),
    fetch("/api/tools", { signal }),
  ]);

  const settingsConfig = await readJson<AppConfigDTO>(settingsResponse);
  const toolsPayload = await readJson<ToolsResponseBody>(toolsResponse);

  return { config: settingsConfig, tools: toolsPayload.tools ?? [] };
}

export async function updateSettings(
  nextConfig: AppConfigDTO,
): Promise<AppConfigDTO> {
  const updateResponse = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(nextConfig),
  });

  const responseBody = await readJson<unknown>(updateResponse);
  if (updateResponse.ok) {
    return responseBody as AppConfigDTO;
  }

  const errorText =
    typeof responseBody === "object" &&
    responseBody !== null &&
    "error" in responseBody
      ? String((responseBody as { error?: unknown }).error)
      : "Save failed";
  throw new Error(errorText);
}

export function toSettingsErrorMessage(caughtError: unknown): string {
  return getErrorMessage(caughtError);
}
