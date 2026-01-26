import { z } from "zod";
import { getAppConfig, upsertAppConfig } from "@/lib/appConfig";
import { toolCatalog, type ToolKey } from "@/mastra/tools/registry";

export const runtime = "nodejs";

const SYSTEM_PROMPT_MIN_LENGTH = 1;
const SYSTEM_PROMPT_MAX_LENGTH = 8000;
const MODEL_ID_MIN_LENGTH = 1;
const MODEL_ID_MAX_LENGTH = 200;
const ENABLED_TOOLS_MAX_COUNT = 100;

const SPEECH_LANGUAGE_TAG_MIN_LENGTH = 2;
const SPEECH_LANGUAGE_TAG_MAX_LENGTH = 50;

const WEB_SPEECH_RATE_MIN = 0.1;
const WEB_SPEECH_RATE_MAX = 10.0;
const WEB_SPEECH_PITCH_MIN = 0.0;
const WEB_SPEECH_PITCH_MAX = 2.0;
const WEB_SPEECH_VOLUME_MIN = 0.0;
const WEB_SPEECH_VOLUME_MAX = 1.0;

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

const ToolKeySchema = z.enum(
  toolCatalog.map((toolCatalogItem) => toolCatalogItem.key) as [
    ToolKey,
    ...ToolKey[],
  ],
);

const TextToSpeechEngineSchema = z.enum(["webSpeech", "voicevox"]);

const WebSpeechSettingsSchema = z
  .object({
    rate: z.number().min(WEB_SPEECH_RATE_MIN).max(WEB_SPEECH_RATE_MAX),
    pitch: z.number().min(WEB_SPEECH_PITCH_MIN).max(WEB_SPEECH_PITCH_MAX),
    volume: z.number().min(WEB_SPEECH_VOLUME_MIN).max(WEB_SPEECH_VOLUME_MAX),
  })
  .strict();

const VoiceVoxSettingsSchema = z
  .object({
    engineUrl: z
      .string()
      .min(VOICEVOX_ENGINE_URL_MIN_LENGTH)
      .max(VOICEVOX_ENGINE_URL_MAX_LENGTH),
    speakerId: z.number().int().min(VOICEVOX_SPEAKER_ID_MIN).max(VOICEVOX_SPEAKER_ID_MAX),
    speedScale: z.number().min(VOICEVOX_SPEED_SCALE_MIN).max(VOICEVOX_SPEED_SCALE_MAX),
    pitchScale: z.number().min(VOICEVOX_PITCH_SCALE_MIN).max(VOICEVOX_PITCH_SCALE_MAX),
    intonationScale: z
      .number()
      .min(VOICEVOX_INTONATION_SCALE_MIN)
      .max(VOICEVOX_INTONATION_SCALE_MAX),
    volumeScale: z.number().min(VOICEVOX_VOLUME_SCALE_MIN).max(VOICEVOX_VOLUME_SCALE_MAX),
  })
  .strict();

const VoiceSettingsSchema = z
  .object({
    isVoiceConversationModeEnabledByDefault: z.boolean(),
    isAutoSendEnabledByDefault: z.boolean(),
    isTextToSpeechEnabledByDefault: z.boolean(),
    speechLanguageTag: z
      .string()
      .min(SPEECH_LANGUAGE_TAG_MIN_LENGTH)
      .max(SPEECH_LANGUAGE_TAG_MAX_LENGTH),
    textToSpeechEngine: TextToSpeechEngineSchema,
    webSpeech: WebSpeechSettingsSchema,
    voicevox: VoiceVoxSettingsSchema,
  })
  .strict();

const UpdateSchema = z
  .object({
    systemPrompt: z
      .string()
      .min(SYSTEM_PROMPT_MIN_LENGTH)
      .max(SYSTEM_PROMPT_MAX_LENGTH)
      .optional(),
    model: z
      .string()
      .min(MODEL_ID_MIN_LENGTH)
      .max(MODEL_ID_MAX_LENGTH)
      .optional(),
    enabledTools: z
      .array(ToolKeySchema)
      .max(ENABLED_TOOLS_MAX_COUNT)
      .optional(),
    voiceSettings: VoiceSettingsSchema.optional(),
  })
  .strict();

export async function GET() {
  try {
    const config = await getAppConfig();
    return Response.json(config);
  } catch (caughtError) {
    return Response.json(
      { error: "Failed to load settings", detail: String(caughtError) },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const requestBody = await request.json().catch(() => null);
    // Guard: invalid JSON.
    if (!requestBody) {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = UpdateSchema.safeParse(requestBody);
    // Guard: invalid request shape.
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const config = await upsertAppConfig(parsed.data);
    return Response.json(config);
  } catch (caughtError) {
    return Response.json(
      { error: "Failed to save settings", detail: String(caughtError) },
      { status: 500 },
    );
  }
}
