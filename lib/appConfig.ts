import { prisma } from "./prisma";
import { toolCatalog, type ToolKey } from "@/mastra/tools/registry";

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

export type AppConfigDTO = {
  systemPrompt: string;
  model: string;
  enabledTools: ToolKey[];
  voiceSettings: VoiceSettingsDTO;
};

const ENABLED_TOOL_KEY_SET = new Set<ToolKey>(
  toolCatalog.map((tool) => tool.key),
);

const DEFAULT_SPEECH_LANGUAGE_TAG = "ja-JP";
const DEFAULT_TEXT_TO_SPEECH_ENGINE: TextToSpeechEngine = "webSpeech";

const DEFAULT_VOICE_CONVERSATION_MODE_ENABLED = false;
const DEFAULT_AUTO_SEND_ENABLED = true;
const DEFAULT_TEXT_TO_SPEECH_ENABLED = true;

const DEFAULT_WEB_SPEECH_RATE = 1.0;
const DEFAULT_WEB_SPEECH_PITCH = 1.0;
const DEFAULT_WEB_SPEECH_VOLUME = 1.0;

const DEFAULT_VOICEVOX_ENGINE_URL = "http://127.0.0.1:50021";
const DEFAULT_VOICEVOX_SPEAKER_ID = 1;
const DEFAULT_VOICEVOX_SPEED_SCALE = 1.0;
const DEFAULT_VOICEVOX_PITCH_SCALE = 0.0;
const DEFAULT_VOICEVOX_INTONATION_SCALE = 1.0;
const DEFAULT_VOICEVOX_VOLUME_SCALE = 1.0;

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

const DEFAULTS: AppConfigDTO = {
  systemPrompt:
    "You are a helpful assistant. Be concise, ask clarifying questions when needed, and use tools when appropriate.",
  model: process.env.GROQ_MODEL ?? "groq/llama-3.3-70b-versatile",
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
};

export async function getAppConfig(): Promise<AppConfigDTO> {
  const row = await prisma.appConfig.findUnique({ where: { id: "default" } });
  if (!row) return DEFAULTS;
  const enabledTools = parseEnabledToolsJson(row.enabledTools);
  const voiceSettings = parseVoiceSettingsJson(row.voiceSettings);
  return {
    systemPrompt: row.systemPrompt,
    model: row.model,
    enabledTools,
    voiceSettings,
  };
}

export async function upsertAppConfig(input: Partial<AppConfigDTO>) {
  const current = await getAppConfig();
  const next: AppConfigDTO = {
    systemPrompt: input.systemPrompt ?? current.systemPrompt,
    model: input.model ?? current.model,
    enabledTools: input.enabledTools ?? current.enabledTools,
    voiceSettings: input.voiceSettings ?? current.voiceSettings,
  };

  await prisma.appConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      systemPrompt: next.systemPrompt,
      model: next.model,
      enabledTools: next.enabledTools,
      voiceSettings: next.voiceSettings,
    },
    update: {
      systemPrompt: next.systemPrompt,
      model: next.model,
      enabledTools: next.enabledTools,
      voiceSettings: next.voiceSettings,
    },
  });

  return next;
}
