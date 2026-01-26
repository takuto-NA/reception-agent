/**
 * Responsibility:
 * - Synthesize speech audio using a locally running VOICEVOX Engine.
 *
 * Notes:
 * - This route runs on the server (Node.js) and proxies requests to VOICEVOX Engine.
 * - It returns `audio/wav` so the client can play it via `Audio`.
 */

import { z } from "zod";
import { getAppConfig } from "@/lib/appConfig";

export const runtime = "nodejs";

const TEXT_MIN_LENGTH = 1;
const TEXT_MAX_LENGTH = 2000;

const VOICEVOX_ENGINE_URL_MIN_LENGTH = 1;
const VOICEVOX_ENGINE_URL_MAX_LENGTH = 200;
const VOICEVOX_SPEAKER_ID_MIN = 0;
const VOICEVOX_SPEAKER_ID_MAX = 10000;

const VOICEVOX_SPEED_SCALE_MIN = 0.5;
const VOICEVOX_SPEED_SCALE_MAX = 2.0;
const VOICEVOX_PITCH_SCALE_MIN = -1.0;
const VOICEVOX_PITCH_SCALE_MAX = 1.0;
const VOICEVOX_INTONATION_SCALE_MIN = 0.0;
const VOICEVOX_INTONATION_SCALE_MAX = 2.0;
const VOICEVOX_VOLUME_SCALE_MIN = 0.0;
const VOICEVOX_VOLUME_SCALE_MAX = 2.0;

const VOICEVOX_REQUEST_TIMEOUT_MILLISECONDS = 30000;

const VoiceVoxOverrideSchema = z
  .object({
    engineUrl: z
      .string()
      .min(VOICEVOX_ENGINE_URL_MIN_LENGTH)
      .max(VOICEVOX_ENGINE_URL_MAX_LENGTH)
      .optional(),
    speakerId: z
      .number()
      .int()
      .min(VOICEVOX_SPEAKER_ID_MIN)
      .max(VOICEVOX_SPEAKER_ID_MAX)
      .optional(),
    speedScale: z
      .number()
      .min(VOICEVOX_SPEED_SCALE_MIN)
      .max(VOICEVOX_SPEED_SCALE_MAX)
      .optional(),
    pitchScale: z
      .number()
      .min(VOICEVOX_PITCH_SCALE_MIN)
      .max(VOICEVOX_PITCH_SCALE_MAX)
      .optional(),
    intonationScale: z
      .number()
      .min(VOICEVOX_INTONATION_SCALE_MIN)
      .max(VOICEVOX_INTONATION_SCALE_MAX)
      .optional(),
    volumeScale: z
      .number()
      .min(VOICEVOX_VOLUME_SCALE_MIN)
      .max(VOICEVOX_VOLUME_SCALE_MAX)
      .optional(),
  })
  .strict();

const RequestSchema = z
  .object({
    text: z.string().min(TEXT_MIN_LENGTH).max(TEXT_MAX_LENGTH),
    voicevox: VoiceVoxOverrideSchema.optional(),
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

function ensureOkOrThrow(response: Response, errorPrefix: string): Response {
  if (response.ok) return response;
  throw new Error(`${errorPrefix} (status: ${response.status})`);
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
    const configured = config.voiceSettings.voicevox;
    const overrides = parsed.data.voicevox ?? {};

    const engineUrl = overrides.engineUrl ?? configured.engineUrl;
    const speakerId = overrides.speakerId ?? configured.speakerId;

    const { signal, cancelTimeout } = createAbortSignalWithTimeout(
      VOICEVOX_REQUEST_TIMEOUT_MILLISECONDS,
    );

    try {
      const audioQueryResponse = await fetch(
        `${engineUrl}/audio_query?text=${encodeURIComponent(
          parsed.data.text,
        )}&speaker=${speakerId}`,
        { method: "POST", signal },
      );
      ensureOkOrThrow(audioQueryResponse, "VOICEVOX audio_query failed");

      const audioQueryJson = (await audioQueryResponse.json()) as Record<string, unknown>;
      const patchedAudioQuery = {
        ...audioQueryJson,
        speedScale: overrides.speedScale ?? configured.speedScale,
        pitchScale: overrides.pitchScale ?? configured.pitchScale,
        intonationScale: overrides.intonationScale ?? configured.intonationScale,
        volumeScale: overrides.volumeScale ?? configured.volumeScale,
      };

      const synthesisResponse = await fetch(
        `${engineUrl}/synthesis?speaker=${speakerId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchedAudioQuery),
          signal,
        },
      );
      ensureOkOrThrow(synthesisResponse, "VOICEVOX synthesis failed");

      const wavBuffer = await synthesisResponse.arrayBuffer();
      return new Response(wavBuffer, {
        status: 200,
        headers: {
          "Content-Type": "audio/wav",
          "Cache-Control": "no-store",
        },
      });
    } finally {
      cancelTimeout();
    }
  } catch (caughtError) {
    return Response.json(
      { error: "VOICEVOX request failed", detail: String(caughtError) },
      { status: 502 },
    );
  }
}

