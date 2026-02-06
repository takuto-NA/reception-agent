import { z } from "zod";
import { clearGroqApiKey, getAppConfig, setGroqApiKey, upsertAppConfig } from "@/lib/appConfig";
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

const PRESENCE_EVENT_TEXT_TEMPLATE_MIN_LENGTH = 1;
const PRESENCE_EVENT_TEXT_TEMPLATE_MAX_LENGTH = 500;
const PRESENCE_DETECTION_FPS_MIN = 1;
const PRESENCE_DETECTION_FPS_MAX = 30;
const PRESENCE_MAX_FACES_MIN = 1;
const PRESENCE_MAX_FACES_MAX = 25;
const PRESENCE_MIN_CONFIDENCE_MIN = 0.0;
const PRESENCE_MIN_CONFIDENCE_MAX = 1.0;
const PRESENCE_MIN_FACE_AREA_RATIO_MIN = 0.0;
const PRESENCE_MIN_FACE_AREA_RATIO_MAX = 1.0;
const PRESENCE_INTERACTION_ZONE_MARGIN_RATIO_MIN = 0.0;
const PRESENCE_INTERACTION_ZONE_MARGIN_RATIO_MAX = 0.45;
const PRESENCE_ASSIGNMENT_IOU_THRESHOLD_MIN = 0.0;
const PRESENCE_ASSIGNMENT_IOU_THRESHOLD_MAX = 1.0;
const PRESENCE_TRACK_MAX_MISSED_FRAMES_MIN = 0;
const PRESENCE_TRACK_MAX_MISSED_FRAMES_MAX = 120;
const PRESENCE_STABLE_FRAMES_REQUIRED_MIN = 1;
const PRESENCE_STABLE_FRAMES_REQUIRED_MAX = 60;
const PRESENCE_DWELL_MS_TO_GREET_MIN = 0;
const PRESENCE_DWELL_MS_TO_GREET_MAX = 600000;
const PRESENCE_GREET_COOLDOWN_MS_MIN = 0;
const PRESENCE_GREET_COOLDOWN_MS_MAX = 3600000;

const GROQ_API_KEY_MIN_LENGTH = 1;
const GROQ_API_KEY_MAX_LENGTH = 200;

const ERROR_CODE_DB_SCHEMA_MISMATCH = "DB_SCHEMA_MISMATCH";
const ERROR_CODE_INVALID_JSON = "INVALID_JSON";

function toSettingsErrorResponse(caughtError: unknown) {
  /**
   * Responsibility:
   * - Normalize server errors into a structured payload for the UI.
   */
  const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
  if (message.includes("AppConfig.groqApiKeyEncrypted") && message.includes("does not exist")) {
    return {
      error: "Database schema mismatch",
      detail: message,
      code: ERROR_CODE_DB_SCHEMA_MISMATCH,
    };
  }
  return { error: "Failed to load settings", detail: message };
}

function toSettingsSaveErrorResponse(caughtError: unknown) {
  /**
   * Responsibility:
   * - Normalize save errors into a structured payload for the UI.
   */
  const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
  if (message.includes("AppConfig.groqApiKeyEncrypted") && message.includes("does not exist")) {
    return {
      error: "Database schema mismatch",
      detail: message,
      code: ERROR_CODE_DB_SCHEMA_MISMATCH,
    };
  }
  return { error: "Failed to save settings", detail: message };
}

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

const PresenceSettingsSchema = z
  .object({
    isEnabledByDefault: z.boolean(),
    isDebugPanelEnabledByDefault: z.boolean(),
    isOverlayEnabledByDefault: z.boolean(),
    detectionFps: z.number().int().min(PRESENCE_DETECTION_FPS_MIN).max(PRESENCE_DETECTION_FPS_MAX),
    maxFaces: z.number().int().min(PRESENCE_MAX_FACES_MIN).max(PRESENCE_MAX_FACES_MAX),
    minConfidence: z
      .number()
      .min(PRESENCE_MIN_CONFIDENCE_MIN)
      .max(PRESENCE_MIN_CONFIDENCE_MAX),
    minFaceAreaRatio: z
      .number()
      .min(PRESENCE_MIN_FACE_AREA_RATIO_MIN)
      .max(PRESENCE_MIN_FACE_AREA_RATIO_MAX),
    interactionZoneMarginRatio: z
      .number()
      .min(PRESENCE_INTERACTION_ZONE_MARGIN_RATIO_MIN)
      .max(PRESENCE_INTERACTION_ZONE_MARGIN_RATIO_MAX),
    assignmentIouThreshold: z
      .number()
      .min(PRESENCE_ASSIGNMENT_IOU_THRESHOLD_MIN)
      .max(PRESENCE_ASSIGNMENT_IOU_THRESHOLD_MAX),
    trackMaxMissedFrames: z
      .number()
      .int()
      .min(PRESENCE_TRACK_MAX_MISSED_FRAMES_MIN)
      .max(PRESENCE_TRACK_MAX_MISSED_FRAMES_MAX),
    stableFramesRequired: z
      .number()
      .int()
      .min(PRESENCE_STABLE_FRAMES_REQUIRED_MIN)
      .max(PRESENCE_STABLE_FRAMES_REQUIRED_MAX),
    dwellMsToGreet: z
      .number()
      .int()
      .min(PRESENCE_DWELL_MS_TO_GREET_MIN)
      .max(PRESENCE_DWELL_MS_TO_GREET_MAX),
    greetCooldownMs: z
      .number()
      .int()
      .min(PRESENCE_GREET_COOLDOWN_MS_MIN)
      .max(PRESENCE_GREET_COOLDOWN_MS_MAX),
    eventTextTemplate: z
      .string()
      .min(PRESENCE_EVENT_TEXT_TEMPLATE_MIN_LENGTH)
      .max(PRESENCE_EVENT_TEXT_TEMPLATE_MAX_LENGTH),
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
    presenceSettings: PresenceSettingsSchema.optional(),
    groqApiKey: z.string().min(GROQ_API_KEY_MIN_LENGTH).max(GROQ_API_KEY_MAX_LENGTH).optional(),
    clearGroqApiKey: z.boolean().optional(),
  })
  .strict();

export async function GET() {
  try {
    const config = await getAppConfig();
    return Response.json(config);
  } catch (caughtError) {
    return Response.json(toSettingsErrorResponse(caughtError), { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const requestBody = await request.json().catch(() => null);
    // Guard: invalid JSON.
    if (!requestBody) {
      return Response.json(
        { error: "Invalid JSON", code: ERROR_CODE_INVALID_JSON },
        { status: 400 },
      );
    }

    const parsed = UpdateSchema.safeParse(requestBody);
    // Guard: invalid request shape.
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { groqApiKey, clearGroqApiKey: shouldClearGroqApiKey, ...configUpdate } = parsed.data;

    // Guard: ambiguous request.
    if (groqApiKey && shouldClearGroqApiKey) {
      return Response.json(
        { error: "Invalid request", detail: "Provide either groqApiKey or clearGroqApiKey" },
        { status: 400 },
      );
    }

    const hasConfigUpdate =
      typeof configUpdate.systemPrompt !== "undefined" ||
      typeof configUpdate.model !== "undefined" ||
      typeof configUpdate.enabledTools !== "undefined" ||
      typeof configUpdate.voiceSettings !== "undefined" ||
      typeof configUpdate.presenceSettings !== "undefined";

    if (hasConfigUpdate) {
      await upsertAppConfig(configUpdate);
    }

    if (typeof groqApiKey !== "undefined") {
      await setGroqApiKey(groqApiKey);
    }

    if (shouldClearGroqApiKey) {
      await clearGroqApiKey();
    }

    const nextConfig = await getAppConfig();
    return Response.json(nextConfig);
  } catch (caughtError) {
    return Response.json(toSettingsSaveErrorResponse(caughtError), { status: 500 });
  }
}
