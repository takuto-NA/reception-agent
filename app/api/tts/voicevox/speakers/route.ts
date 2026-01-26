/**
 * Responsibility:
 * - Fetch VOICEVOX speaker/style list via server to avoid browser CORS issues.
 */

import { z } from "zod";
import { getAppConfig } from "@/lib/appConfig";

export const runtime = "nodejs";

const VOICEVOX_ENGINE_URL_MIN_LENGTH = 1;
const VOICEVOX_ENGINE_URL_MAX_LENGTH = 200;
const VOICEVOX_REQUEST_TIMEOUT_MILLISECONDS = 5000;

const RequestSchema = z
  .object({
    engineUrl: z
      .string()
      .min(VOICEVOX_ENGINE_URL_MIN_LENGTH)
      .max(VOICEVOX_ENGINE_URL_MAX_LENGTH)
      .optional(),
  })
  .strict();

function createAbortSignalWithTimeout(timeoutMilliseconds: number): {
  signal: AbortSignal;
  cancelTimeout: () => void;
} {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMilliseconds);
  return { signal: abortController.signal, cancelTimeout: () => clearTimeout(timeoutId) };
}

export async function POST(request: Request) {
  try {
    const requestBody = await request.json().catch(() => null);
    // Guard: invalid JSON.
    if (!requestBody) {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = RequestSchema.safeParse(requestBody);
    // Guard: invalid request shape.
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const config = await getAppConfig();
    const engineUrl = parsed.data.engineUrl ?? config.voiceSettings.voicevox.engineUrl;

    const { signal, cancelTimeout } = createAbortSignalWithTimeout(
      VOICEVOX_REQUEST_TIMEOUT_MILLISECONDS,
    );
    try {
      const response = await fetch(`${engineUrl}/speakers`, { method: "GET", signal });
      if (!response.ok) {
        return Response.json(
          { error: "VOICEVOX speakers request failed", status: response.status },
          { status: 502 },
        );
      }

      const speakersJson = await response.json();
      return Response.json({ speakers: speakersJson }, { status: 200 });
    } finally {
      cancelTimeout();
    }
  } catch (caughtError) {
    return Response.json(
      { error: "VOICEVOX speakers request failed", detail: String(caughtError) },
      { status: 502 },
    );
  }
}

