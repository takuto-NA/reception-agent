import { prisma } from "./prisma";
import { toolCatalog, type ToolKey } from "@/mastra/tools/registry";
import { decryptAppConfigSecret, encryptAppConfigSecret } from "./appConfigEncryption";

export type TextToSpeechEngine = "webSpeech" | "voicevox";

export type WebSpeechVoiceSettingsDTO = {
  rate: number;
  pitch: number;
  volume: number;
};

export type VoiceVoxVoiceSettingsDTO = {
  /**
   * Base URL for a locally running VOICEVOX Engine.
   *
   * Example:
   * - http://127.0.0.1:50021
   */
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

export type PresenceSettingsDTO = {
  isEnabledByDefault: boolean;
  isDebugPanelEnabledByDefault: boolean;
  isOverlayEnabledByDefault: boolean;
  detectionFps: number;
  maxFaces: number;
  minConfidence: number;
  minFaceAreaRatio: number;
  interactionZoneMarginRatio: number;
  assignmentIouThreshold: number;
  trackMaxMissedFrames: number;
  stableFramesRequired: number;
  dwellMsToGreet: number;
  greetCooldownMs: number;
  eventTextTemplate: string;
};

export type AppConfigDTO = {
  systemPrompt: string;
  model: string;
  enabledTools: ToolKey[];
  voiceSettings: VoiceSettingsDTO;
  presenceSettings: PresenceSettingsDTO;
  hasGroqApiKey: boolean;
};

const ENABLED_TOOL_KEY_SET = new Set<ToolKey>(
  toolCatalog.map((tool) => tool.key),
);

const DEFAULT_SPEECH_LANGUAGE_TAG = "ja-JP";
const DEFAULT_TEXT_TO_SPEECH_ENGINE: TextToSpeechEngine = "webSpeech";

const DEFAULT_VOICE_CONVERSATION_MODE_ENABLED = false;
const DEFAULT_AUTO_SEND_ENABLED = true;
const DEFAULT_TEXT_TO_SPEECH_ENABLED = true;
const DEFAULT_HAS_GROQ_API_KEY = false;

const DEFAULT_WEB_SPEECH_RATE = 1.0;
const DEFAULT_WEB_SPEECH_PITCH = 1.0;
const DEFAULT_WEB_SPEECH_VOLUME = 1.0;

const DEFAULT_VOICEVOX_ENGINE_URL = "http://127.0.0.1:50021";
const DEFAULT_VOICEVOX_SPEAKER_ID = 1;
const DEFAULT_VOICEVOX_SPEED_SCALE = 1.0;
const DEFAULT_VOICEVOX_PITCH_SCALE = 0.0;
const DEFAULT_VOICEVOX_INTONATION_SCALE = 1.0;
const DEFAULT_VOICEVOX_VOLUME_SCALE = 1.0;

const DEFAULT_PRESENCE_ENABLED = false;
const DEFAULT_PRESENCE_DEBUG_PANEL_ENABLED = true;
const DEFAULT_PRESENCE_OVERLAY_ENABLED = true;
const DEFAULT_PRESENCE_DETECTION_FPS = 8;
const DEFAULT_PRESENCE_MAX_FACES = 6;
const DEFAULT_PRESENCE_MIN_CONFIDENCE = 0.6;
const DEFAULT_PRESENCE_MIN_FACE_AREA_RATIO = 0.01;
const DEFAULT_PRESENCE_INTERACTION_ZONE_MARGIN_RATIO = 0.1;
const DEFAULT_PRESENCE_ASSIGNMENT_IOU_THRESHOLD = 0.25;
const DEFAULT_PRESENCE_TRACK_MAX_MISSED_FRAMES = 10;
const DEFAULT_PRESENCE_STABLE_FRAMES_REQUIRED = 4;
const DEFAULT_PRESENCE_DWELL_MS_TO_GREET = 3500;
const DEFAULT_PRESENCE_GREET_COOLDOWN_MS = 20000;
const DEFAULT_PRESENCE_EVENT_TEXT_TEMPLATE =
  "【来客】{count}名がカメラ前に滞在しています。受付としてグループに話しかけてください。";

function parseEnabledToolsJson(value: unknown): ToolKey[] {
  // Guard: Prisma Json might be null/unknown.
  if (!Array.isArray(value)) return DEFAULTS.enabledTools;

  const enabledTools = value.filter((item): item is ToolKey => {
    if (typeof item !== "string") return false;
    return ENABLED_TOOL_KEY_SET.has(item as ToolKey);
  });

  // Guard: empty or fully invalid config -> fall back to defaults.
  if (enabledTools.length === 0) return DEFAULTS.enabledTools;
  return enabledTools;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseString(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value;
  return fallback;
}

function parseNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

function parseTextToSpeechEngine(
  value: unknown,
  fallback: TextToSpeechEngine,
): TextToSpeechEngine {
  if (value === "webSpeech") return "webSpeech";
  if (value === "voicevox") return "voicevox";
  return fallback;
}

function parseWebSpeechVoiceSettings(
  value: unknown,
  fallback: WebSpeechVoiceSettingsDTO,
): WebSpeechVoiceSettingsDTO {
  // Guard: invalid shape.
  if (!isRecord(value)) return fallback;
  return {
    rate: parseNumber(value.rate, fallback.rate),
    pitch: parseNumber(value.pitch, fallback.pitch),
    volume: parseNumber(value.volume, fallback.volume),
  };
}

function parseVoiceVoxVoiceSettings(
  value: unknown,
  fallback: VoiceVoxVoiceSettingsDTO,
): VoiceVoxVoiceSettingsDTO {
  // Guard: invalid shape.
  if (!isRecord(value)) return fallback;
  return {
    engineUrl: parseString(value.engineUrl, fallback.engineUrl),
    speakerId: parseNumber(value.speakerId, fallback.speakerId),
    speedScale: parseNumber(value.speedScale, fallback.speedScale),
    pitchScale: parseNumber(value.pitchScale, fallback.pitchScale),
    intonationScale: parseNumber(value.intonationScale, fallback.intonationScale),
    volumeScale: parseNumber(value.volumeScale, fallback.volumeScale),
  };
}

function parseVoiceSettingsJson(value: unknown): VoiceSettingsDTO {
  const fallback = DEFAULTS.voiceSettings;
  // Guard: Prisma Json might be null/unknown.
  if (!isRecord(value)) return fallback;

  return {
    isVoiceConversationModeEnabledByDefault: parseBoolean(
      value.isVoiceConversationModeEnabledByDefault,
      fallback.isVoiceConversationModeEnabledByDefault,
    ),
    isAutoSendEnabledByDefault: parseBoolean(
      value.isAutoSendEnabledByDefault,
      fallback.isAutoSendEnabledByDefault,
    ),
    isTextToSpeechEnabledByDefault: parseBoolean(
      value.isTextToSpeechEnabledByDefault,
      fallback.isTextToSpeechEnabledByDefault,
    ),
    speechLanguageTag: parseString(value.speechLanguageTag, fallback.speechLanguageTag),
    textToSpeechEngine: parseTextToSpeechEngine(
      value.textToSpeechEngine,
      fallback.textToSpeechEngine,
    ),
    webSpeech: parseWebSpeechVoiceSettings(value.webSpeech, fallback.webSpeech),
    voicevox: parseVoiceVoxVoiceSettings(value.voicevox, fallback.voicevox),
  };
}

function parsePresenceSettingsJson(value: unknown): PresenceSettingsDTO {
  /**
   * Responsibility:
   * - Parse Presence settings JSON from Prisma with defensive fallbacks.
   */
  const fallback = DEFAULTS.presenceSettings;
  // Guard: Prisma Json might be null/unknown.
  if (!isRecord(value)) return fallback;

  return {
    isEnabledByDefault: parseBoolean(value.isEnabledByDefault, fallback.isEnabledByDefault),
    isDebugPanelEnabledByDefault: parseBoolean(
      value.isDebugPanelEnabledByDefault,
      fallback.isDebugPanelEnabledByDefault,
    ),
    isOverlayEnabledByDefault: parseBoolean(
      value.isOverlayEnabledByDefault,
      fallback.isOverlayEnabledByDefault,
    ),
    detectionFps: parseNumber(value.detectionFps, fallback.detectionFps),
    maxFaces: parseNumber(value.maxFaces, fallback.maxFaces),
    minConfidence: parseNumber(value.minConfidence, fallback.minConfidence),
    minFaceAreaRatio: parseNumber(value.minFaceAreaRatio, fallback.minFaceAreaRatio),
    interactionZoneMarginRatio: parseNumber(
      value.interactionZoneMarginRatio,
      fallback.interactionZoneMarginRatio,
    ),
    assignmentIouThreshold: parseNumber(
      value.assignmentIouThreshold,
      fallback.assignmentIouThreshold,
    ),
    trackMaxMissedFrames: parseNumber(
      value.trackMaxMissedFrames,
      fallback.trackMaxMissedFrames,
    ),
    stableFramesRequired: parseNumber(
      value.stableFramesRequired,
      fallback.stableFramesRequired,
    ),
    dwellMsToGreet: parseNumber(value.dwellMsToGreet, fallback.dwellMsToGreet),
    greetCooldownMs: parseNumber(value.greetCooldownMs, fallback.greetCooldownMs),
    eventTextTemplate: parseString(value.eventTextTemplate, fallback.eventTextTemplate),
  };
}

const DEFAULTS: AppConfigDTO = {
  systemPrompt:
    "You are a helpful assistant. Be concise, ask clarifying questions when needed, and use tools when appropriate.",
  // Provider-agnostic model identifier.
  // Backward compatible: GROQ_MODEL is still supported.
  model:
    process.env.MODEL_ID ??
    process.env.GROQ_MODEL ??
    "groq/llama-3.3-70b-versatile",
  enabledTools: toolCatalog.map((t) => t.key),
  voiceSettings: {
    isVoiceConversationModeEnabledByDefault: DEFAULT_VOICE_CONVERSATION_MODE_ENABLED,
    isAutoSendEnabledByDefault: DEFAULT_AUTO_SEND_ENABLED,
    isTextToSpeechEnabledByDefault: DEFAULT_TEXT_TO_SPEECH_ENABLED,
    speechLanguageTag: DEFAULT_SPEECH_LANGUAGE_TAG,
    textToSpeechEngine: DEFAULT_TEXT_TO_SPEECH_ENGINE,
    webSpeech: {
      rate: DEFAULT_WEB_SPEECH_RATE,
      pitch: DEFAULT_WEB_SPEECH_PITCH,
      volume: DEFAULT_WEB_SPEECH_VOLUME,
    },
    voicevox: {
      engineUrl: DEFAULT_VOICEVOX_ENGINE_URL,
      speakerId: DEFAULT_VOICEVOX_SPEAKER_ID,
      speedScale: DEFAULT_VOICEVOX_SPEED_SCALE,
      pitchScale: DEFAULT_VOICEVOX_PITCH_SCALE,
      intonationScale: DEFAULT_VOICEVOX_INTONATION_SCALE,
      volumeScale: DEFAULT_VOICEVOX_VOLUME_SCALE,
    },
  },
  presenceSettings: {
    isEnabledByDefault: DEFAULT_PRESENCE_ENABLED,
    isDebugPanelEnabledByDefault: DEFAULT_PRESENCE_DEBUG_PANEL_ENABLED,
    isOverlayEnabledByDefault: DEFAULT_PRESENCE_OVERLAY_ENABLED,
    detectionFps: DEFAULT_PRESENCE_DETECTION_FPS,
    maxFaces: DEFAULT_PRESENCE_MAX_FACES,
    minConfidence: DEFAULT_PRESENCE_MIN_CONFIDENCE,
    minFaceAreaRatio: DEFAULT_PRESENCE_MIN_FACE_AREA_RATIO,
    interactionZoneMarginRatio: DEFAULT_PRESENCE_INTERACTION_ZONE_MARGIN_RATIO,
    assignmentIouThreshold: DEFAULT_PRESENCE_ASSIGNMENT_IOU_THRESHOLD,
    trackMaxMissedFrames: DEFAULT_PRESENCE_TRACK_MAX_MISSED_FRAMES,
    stableFramesRequired: DEFAULT_PRESENCE_STABLE_FRAMES_REQUIRED,
    dwellMsToGreet: DEFAULT_PRESENCE_DWELL_MS_TO_GREET,
    greetCooldownMs: DEFAULT_PRESENCE_GREET_COOLDOWN_MS,
    eventTextTemplate: DEFAULT_PRESENCE_EVENT_TEXT_TEMPLATE,
  },
  hasGroqApiKey: DEFAULT_HAS_GROQ_API_KEY,
};

export async function getAppConfig(): Promise<AppConfigDTO> {
  const row = await prisma.appConfig.findUnique({ where: { id: "default" } });
  if (!row) return DEFAULTS;
  const enabledTools = parseEnabledToolsJson(row.enabledTools);
  const voiceSettings = parseVoiceSettingsJson(row.voiceSettings);
  const presenceSettings = parsePresenceSettingsJson(row.presenceSettings);
  const hasGroqApiKey = Boolean(row.groqApiKeyEncrypted?.trim());
  return {
    systemPrompt: row.systemPrompt,
    model: row.model,
    enabledTools,
    voiceSettings,
    presenceSettings,
    hasGroqApiKey,
  };
}

export async function upsertAppConfig(input: Partial<AppConfigDTO>) {
  const current = await getAppConfig();
  const next: AppConfigDTO = {
    systemPrompt: input.systemPrompt ?? current.systemPrompt,
    model: input.model ?? current.model,
    enabledTools: input.enabledTools ?? current.enabledTools,
    voiceSettings: input.voiceSettings ?? current.voiceSettings,
    presenceSettings: input.presenceSettings ?? current.presenceSettings,
    // Guard: API key is managed via dedicated endpoints and is never echoed back as plaintext.
    hasGroqApiKey: current.hasGroqApiKey,
  };

  await prisma.appConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      systemPrompt: next.systemPrompt,
      model: next.model,
      enabledTools: next.enabledTools,
      voiceSettings: next.voiceSettings,
      presenceSettings: next.presenceSettings,
    },
    update: {
      systemPrompt: next.systemPrompt,
      model: next.model,
      enabledTools: next.enabledTools,
      voiceSettings: next.voiceSettings,
      presenceSettings: next.presenceSettings,
    },
  });

  return next;
}

export async function setGroqApiKey(plaintextGroqApiKey: string) {
  // Guard: refuse empty input.
  if (!plaintextGroqApiKey.trim()) {
    throw new Error("Groq API key must be non-empty");
  }

  const encrypted = encryptAppConfigSecret(plaintextGroqApiKey.trim());

  await prisma.appConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      systemPrompt: DEFAULTS.systemPrompt,
      model: DEFAULTS.model,
      enabledTools: DEFAULTS.enabledTools,
      voiceSettings: DEFAULTS.voiceSettings,
      presenceSettings: DEFAULTS.presenceSettings,
      groqApiKeyEncrypted: encrypted,
    },
    update: {
      groqApiKeyEncrypted: encrypted,
    },
  });
}

export async function clearGroqApiKey() {
  await prisma.appConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      systemPrompt: DEFAULTS.systemPrompt,
      model: DEFAULTS.model,
      enabledTools: DEFAULTS.enabledTools,
      voiceSettings: DEFAULTS.voiceSettings,
      presenceSettings: DEFAULTS.presenceSettings,
      groqApiKeyEncrypted: null,
    },
    update: {
      groqApiKeyEncrypted: null,
    },
  });
}

export async function resolveGroqApiKey(): Promise<string | null> {
  const row = await prisma.appConfig.findUnique({
    where: { id: "default" },
    select: { groqApiKeyEncrypted: true },
  });

  const encrypted = row?.groqApiKeyEncrypted?.trim();
  if (encrypted) {
    return decryptAppConfigSecret(encrypted);
  }

  return process.env.GROQ_API_KEY ?? null;
}

/**
 * Responsibility:
 * - Resolve LMSTUDIO configuration from environment variables.
 *
 * Returns:
 * - Base URL and API key for LMSTUDIO, or null if not configured.
 */
export function resolveLmStudioConfig(): {
  baseUrl: string;
  apiKey: string;
} | null {
  const baseUrl = process.env.LMSTUDIO_BASE_URL?.trim();
  // Guard: base URL is required for LMSTUDIO.
  if (!baseUrl) {
    return null;
  }

  // Guard: validate URL format.
  try {
    new URL(baseUrl);
  } catch {
    return null;
  }

  const apiKey = process.env.LMSTUDIO_API_KEY?.trim() ?? "lm-studio";

  return {
    baseUrl,
    apiKey,
  };
}

/**
 * Responsibility:
 * - Check if a model identifier uses LMSTUDIO provider.
 *
 * Returns:
 * - true if model starts with "lmstudio/" prefix.
 */
export function isLmStudioModel(model: string): boolean {
  return model.toLowerCase().startsWith("lmstudio/");
}
