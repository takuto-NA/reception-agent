"use client";

/**
 * Responsibility:
 * - Render Settings > Voice page (voice mode defaults + TTS engine parameters).
 */

import { useEffect, useState } from "react";
import {
  type AppConfigDTO,
  fetchSettings,
  toSettingsErrorMessage,
  updateSettings,
} from "../settingsApi";
import { useTextToSpeech } from "@/app/hooks/useTextToSpeech";

const WEB_SPEECH_RATE_MIN = 0.1;
const WEB_SPEECH_RATE_MAX = 10.0;
const WEB_SPEECH_PITCH_MIN = 0.0;
const WEB_SPEECH_PITCH_MAX = 2.0;
const WEB_SPEECH_VOLUME_MIN = 0.0;
const WEB_SPEECH_VOLUME_MAX = 1.0;

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

function toNumberOrFallback(input: string, fallback: number): number {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

type VoiceVoxSpeakerStyleOption = {
  styleId: number;
  label: string;
};

const VOICEVOX_SPEAKERS_API_PATH = "/api/tts/voicevox/speakers";
const DEFAULT_TEST_TEXT = "こんにちは。音声のテストです。";

export default function VoiceSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfigDTO | null>(null);
  const [testText, setTestText] = useState(DEFAULT_TEST_TEXT);
  const [speakerOptions, setSpeakerOptions] = useState<VoiceVoxSpeakerStyleOption[]>([]);
  const [speakerOptionsLoading, setSpeakerOptionsLoading] = useState(false);
  const [speakerOptionsError, setSpeakerOptionsError] = useState<string | null>(null);

  const { speak: speakPreview, cancel: cancelPreview } = useTextToSpeech(
    config
      ? {
          textToSpeechEngine: config.voiceSettings.textToSpeechEngine,
          speechLanguageTag: config.voiceSettings.speechLanguageTag,
          webSpeech: config.voiceSettings.webSpeech,
          voicevox: config.voiceSettings.voicevox,
        }
      : {
          textToSpeechEngine: "webSpeech",
          speechLanguageTag: "ja-JP",
          webSpeech: { rate: 1.0, pitch: 1.0, volume: 1.0 },
          voicevox: {
            engineUrl: "http://127.0.0.1:50021",
            speakerId: 1,
            speedScale: 1.0,
            pitchScale: 0.0,
            intonationScale: 1.0,
            volumeScale: 1.0,
          },
        },
  );

  useEffect(() => {
    const abortController = new AbortController();
    (async () => {
      try {
        const settingsConfig = await fetchSettings(abortController.signal);
        // Guard: request was aborted (unmounted).
        if (abortController.signal.aborted) return;
        setConfig(settingsConfig);
      } catch (caughtError) {
        // Guard: request was aborted (unmounted).
        if (abortController.signal.aborted) return;
        setError(toSettingsErrorMessage(caughtError));
      } finally {
        // Guard: request was aborted (unmounted).
        if (abortController.signal.aborted) return;
        setLoading(false);
      }
    })();
    return () => {
      abortController.abort();
    };
  }, []);

  useEffect(() => {
    // Guard: config not loaded yet.
    if (!config) return;
    // Guard: only fetch speakers when VOICEVOX is selected.
    if (config.voiceSettings.textToSpeechEngine !== "voicevox") return;

    const abortController = new AbortController();
    setSpeakerOptionsLoading(true);
    setSpeakerOptionsError(null);

    (async () => {
      try {
        const response = await fetch(VOICEVOX_SPEAKERS_API_PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ engineUrl: config.voiceSettings.voicevox.engineUrl }),
          signal: abortController.signal,
        });
        // Guard: request was aborted.
        if (abortController.signal.aborted) return;

        const payload = (await response.json().catch(() => null)) as
          | { speakers?: unknown }
          | null;
        if (!response.ok) {
          throw new Error("Failed to load VOICEVOX speakers");
        }

        const speakers = Array.isArray(payload?.speakers) ? payload?.speakers : [];
        const nextOptions: VoiceVoxSpeakerStyleOption[] = [];
        for (const speaker of speakers) {
          // Guard: unexpected speaker shape.
          if (!isRecord(speaker)) continue;
          const speakerName = typeof speaker.name === "string" ? speaker.name : "Unknown";

          const stylesValue = speaker.styles;
          const styles = Array.isArray(stylesValue) ? stylesValue : [];
          for (const style of styles) {
            // Guard: unexpected style shape.
            if (!isRecord(style)) continue;
            const styleId = style.id;
            // Guard: invalid style id.
            if (typeof styleId !== "number") continue;

            const styleName = typeof style.name === "string" ? style.name : "Default";
            nextOptions.push({
              styleId,
              label: `${speakerName} / ${styleName} (#${styleId})`,
            });
          }
        }

        setSpeakerOptions(nextOptions);
      } catch (caughtError) {
        // Guard: request was aborted.
        if (abortController.signal.aborted) return;
        setSpeakerOptionsError(toSettingsErrorMessage(caughtError));
        setSpeakerOptions([]);
      } finally {
        // Guard: request was aborted.
        if (abortController.signal.aborted) return;
        setSpeakerOptionsLoading(false);
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [config]);

  async function handleSubmit(submitEvent: React.FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    // Guard: config not loaded yet.
    if (!config) return;
    setSaving(true);
    setError(null);
    try {
      const updatedConfig = await updateSettings(config);
      setConfig(updatedConfig);
    } catch (caughtError) {
      setError(toSettingsErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
        <div className="text-sm text-zinc-600 dark:text-zinc-300">Loading…</div>
      </section>
    );
  }

  // Guard: config failed to load.
  if (!config) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
        {error ? (
          <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
        ) : (
          <div className="text-sm text-zinc-600 dark:text-zinc-300">
            Failed to load.
          </div>
        )}
      </section>
    );
  }

  const voiceSettings = config.voiceSettings;
  const isWebSpeechSelected = voiceSettings.textToSpeechEngine === "webSpeech";
  const isVoiceVoxSelected = voiceSettings.textToSpeechEngine === "voicevox";

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      {error ? (
        <div className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</div>
      ) : null}

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <div className="text-sm font-medium">Voice mode defaults</div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={voiceSettings.isVoiceConversationModeEnabledByDefault}
                onChange={(changeEvent) =>
                  setConfig((previousConfig) => {
                    // Guard: state should exist here.
                    if (!previousConfig) return previousConfig;
                    return {
                      ...previousConfig,
                      voiceSettings: {
                        ...previousConfig.voiceSettings,
                        isVoiceConversationModeEnabledByDefault:
                          changeEvent.target.checked,
                      },
                    };
                  })
                }
              />
              Voice mode enabled
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={voiceSettings.isAutoSendEnabledByDefault}
                onChange={(changeEvent) =>
                  setConfig((previousConfig) => {
                    // Guard: state should exist here.
                    if (!previousConfig) return previousConfig;
                    return {
                      ...previousConfig,
                      voiceSettings: {
                        ...previousConfig.voiceSettings,
                        isAutoSendEnabledByDefault: changeEvent.target.checked,
                      },
                    };
                  })
                }
              />
              Auto send
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={voiceSettings.isTextToSpeechEnabledByDefault}
                onChange={(changeEvent) =>
                  setConfig((previousConfig) => {
                    // Guard: state should exist here.
                    if (!previousConfig) return previousConfig;
                    return {
                      ...previousConfig,
                      voiceSettings: {
                        ...previousConfig.voiceSettings,
                        isTextToSpeechEnabledByDefault: changeEvent.target.checked,
                      },
                    };
                  })
                }
              />
              Read aloud
            </label>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Speech language tag</label>
            <input
              value={voiceSettings.speechLanguageTag}
              onChange={(changeEvent) =>
                setConfig((previousConfig) => {
                  // Guard: state should exist here.
                  if (!previousConfig) return previousConfig;
                  return {
                    ...previousConfig,
                    voiceSettings: {
                      ...previousConfig.voiceSettings,
                      speechLanguageTag: changeEvent.target.value,
                    },
                  };
                })
              }
              placeholder="ja-JP"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-white/10 dark:bg-black/30 dark:focus:ring-white/20"
            />
            <div className="text-xs text-zinc-500">
              Used for speech recognition and read-aloud.
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Text-to-Speech engine</label>
            <select
              value={voiceSettings.textToSpeechEngine}
              onChange={(changeEvent) =>
                setConfig((previousConfig) => {
                  // Guard: state should exist here.
                  if (!previousConfig) return previousConfig;
                  const nextEngine = changeEvent.target.value as
                    | "webSpeech"
                    | "voicevox";
                  return {
                    ...previousConfig,
                    voiceSettings: {
                      ...previousConfig.voiceSettings,
                      textToSpeechEngine: nextEngine,
                    },
                  };
                })
              }
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-white/10 dark:bg-black/30 dark:focus:ring-white/20"
            >
              <option value="webSpeech">Web Speech (browser)</option>
              <option value="voicevox">VOICEVOX (local engine)</option>
            </select>
            <div className="text-xs text-zinc-500">
              You can keep Web Speech as a fallback.
            </div>
          </div>
        </div>

        {isWebSpeechSelected ? (
          <div className="space-y-3">
            <div className="text-sm font-medium">Web Speech parameters</div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Rate</label>
                <input
                  type="number"
                  min={WEB_SPEECH_RATE_MIN}
                  max={WEB_SPEECH_RATE_MAX}
                  step={0.1}
                  value={voiceSettings.webSpeech.rate}
                  onChange={(changeEvent) =>
                    setConfig((previousConfig) => {
                      // Guard: state should exist here.
                      if (!previousConfig) return previousConfig;
                      const nextRate = toNumberOrFallback(
                        changeEvent.target.value,
                        previousConfig.voiceSettings.webSpeech.rate,
                      );
                      return {
                        ...previousConfig,
                        voiceSettings: {
                          ...previousConfig.voiceSettings,
                          webSpeech: {
                            ...previousConfig.voiceSettings.webSpeech,
                            rate: nextRate,
                          },
                        },
                      };
                    })
                  }
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-white/10 dark:bg-black/30 dark:focus:ring-white/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Pitch</label>
                <input
                  type="number"
                  min={WEB_SPEECH_PITCH_MIN}
                  max={WEB_SPEECH_PITCH_MAX}
                  step={0.1}
                  value={voiceSettings.webSpeech.pitch}
                  onChange={(changeEvent) =>
                    setConfig((previousConfig) => {
                      // Guard: state should exist here.
                      if (!previousConfig) return previousConfig;
                      const nextPitch = toNumberOrFallback(
                        changeEvent.target.value,
                        previousConfig.voiceSettings.webSpeech.pitch,
                      );
                      return {
                        ...previousConfig,
                        voiceSettings: {
                          ...previousConfig.voiceSettings,
                          webSpeech: {
                            ...previousConfig.voiceSettings.webSpeech,
                            pitch: nextPitch,
                          },
                        },
                      };
                    })
                  }
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-white/10 dark:bg-black/30 dark:focus:ring-white/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Volume</label>
                <input
                  type="number"
                  min={WEB_SPEECH_VOLUME_MIN}
                  max={WEB_SPEECH_VOLUME_MAX}
                  step={0.05}
                  value={voiceSettings.webSpeech.volume}
                  onChange={(changeEvent) =>
                    setConfig((previousConfig) => {
                      // Guard: state should exist here.
                      if (!previousConfig) return previousConfig;
                      const nextVolume = toNumberOrFallback(
                        changeEvent.target.value,
                        previousConfig.voiceSettings.webSpeech.volume,
                      );
                      return {
                        ...previousConfig,
                        voiceSettings: {
                          ...previousConfig.voiceSettings,
                          webSpeech: {
                            ...previousConfig.voiceSettings.webSpeech,
                            volume: nextVolume,
                          },
                        },
                      };
                    })
                  }
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-white/10 dark:bg-black/30 dark:focus:ring-white/20"
                />
              </div>
            </div>
          </div>
        ) : null}

        {isVoiceVoxSelected ? (
          <div className="space-y-3">
            <div className="text-sm font-medium">VOICEVOX parameters</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Engine URL</label>
                <input
                  value={voiceSettings.voicevox.engineUrl}
                  onChange={(changeEvent) =>
                    setConfig((previousConfig) => {
                      // Guard: state should exist here.
                      if (!previousConfig) return previousConfig;
                      return {
                        ...previousConfig,
                        voiceSettings: {
                          ...previousConfig.voiceSettings,
                          voicevox: {
                            ...previousConfig.voiceSettings.voicevox,
                            engineUrl: changeEvent.target.value,
                          },
                        },
                      };
                    })
                  }
                  placeholder="http://127.0.0.1:50021"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-white/10 dark:bg-black/30 dark:focus:ring-white/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Speaker ID</label>
                {(() => {
                  if (speakerOptionsLoading) {
                    return (
                      <div className="text-xs text-zinc-500">Loading speakers…</div>
                    );
                  }
                  if (speakerOptionsError) {
                    return (
                      <div className="text-xs text-red-600 dark:text-red-400">
                        {speakerOptionsError}
                      </div>
                    );
                  }
                  if (speakerOptions.length === 0) {
                    return null;
                  }
                  return (
                    <select
                      value={voiceSettings.voicevox.speakerId}
                      onChange={(changeEvent) =>
                        setConfig((previousConfig) => {
                          // Guard: state should exist here.
                          if (!previousConfig) return previousConfig;
                          const nextSpeakerId = toNumberOrFallback(
                            changeEvent.target.value,
                            previousConfig.voiceSettings.voicevox.speakerId,
                          );
                          return {
                            ...previousConfig,
                            voiceSettings: {
                              ...previousConfig.voiceSettings,
                              voicevox: {
                                ...previousConfig.voiceSettings.voicevox,
                                speakerId: nextSpeakerId,
                              },
                            },
                          };
                        })
                      }
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-white/10 dark:bg-black/30 dark:focus:ring-white/20"
                    >
                      {speakerOptions.map((option) => (
                        <option key={option.styleId} value={option.styleId}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  );
                })()}

                <input
                  type="number"
                  min={VOICEVOX_SPEAKER_ID_MIN}
                  max={VOICEVOX_SPEAKER_ID_MAX}
                  step={1}
                  value={voiceSettings.voicevox.speakerId}
                  onChange={(changeEvent) =>
                    setConfig((previousConfig) => {
                      // Guard: state should exist here.
                      if (!previousConfig) return previousConfig;
                      const nextSpeakerId = toNumberOrFallback(
                        changeEvent.target.value,
                        previousConfig.voiceSettings.voicevox.speakerId,
                      );
                      return {
                        ...previousConfig,
                        voiceSettings: {
                          ...previousConfig.voiceSettings,
                          voicevox: {
                            ...previousConfig.voiceSettings.voicevox,
                            speakerId: nextSpeakerId,
                          },
                        },
                      };
                    })
                  }
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-white/10 dark:bg-black/30 dark:focus:ring-white/20"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Speed</label>
                <input
                  type="number"
                  min={VOICEVOX_SPEED_SCALE_MIN}
                  max={VOICEVOX_SPEED_SCALE_MAX}
                  step={0.1}
                  value={voiceSettings.voicevox.speedScale}
                  onChange={(changeEvent) =>
                    setConfig((previousConfig) => {
                      // Guard: state should exist here.
                      if (!previousConfig) return previousConfig;
                      const nextValue = toNumberOrFallback(
                        changeEvent.target.value,
                        previousConfig.voiceSettings.voicevox.speedScale,
                      );
                      return {
                        ...previousConfig,
                        voiceSettings: {
                          ...previousConfig.voiceSettings,
                          voicevox: {
                            ...previousConfig.voiceSettings.voicevox,
                            speedScale: nextValue,
                          },
                        },
                      };
                    })
                  }
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-white/10 dark:bg-black/30 dark:focus:ring-white/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Pitch</label>
                <input
                  type="number"
                  min={VOICEVOX_PITCH_SCALE_MIN}
                  max={VOICEVOX_PITCH_SCALE_MAX}
                  step={0.05}
                  value={voiceSettings.voicevox.pitchScale}
                  onChange={(changeEvent) =>
                    setConfig((previousConfig) => {
                      // Guard: state should exist here.
                      if (!previousConfig) return previousConfig;
                      const nextValue = toNumberOrFallback(
                        changeEvent.target.value,
                        previousConfig.voiceSettings.voicevox.pitchScale,
                      );
                      return {
                        ...previousConfig,
                        voiceSettings: {
                          ...previousConfig.voiceSettings,
                          voicevox: {
                            ...previousConfig.voiceSettings.voicevox,
                            pitchScale: nextValue,
                          },
                        },
                      };
                    })
                  }
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-white/10 dark:bg-black/30 dark:focus:ring-white/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Intonation</label>
                <input
                  type="number"
                  min={VOICEVOX_INTONATION_SCALE_MIN}
                  max={VOICEVOX_INTONATION_SCALE_MAX}
                  step={0.1}
                  value={voiceSettings.voicevox.intonationScale}
                  onChange={(changeEvent) =>
                    setConfig((previousConfig) => {
                      // Guard: state should exist here.
                      if (!previousConfig) return previousConfig;
                      const nextValue = toNumberOrFallback(
                        changeEvent.target.value,
                        previousConfig.voiceSettings.voicevox.intonationScale,
                      );
                      return {
                        ...previousConfig,
                        voiceSettings: {
                          ...previousConfig.voiceSettings,
                          voicevox: {
                            ...previousConfig.voiceSettings.voicevox,
                            intonationScale: nextValue,
                          },
                        },
                      };
                    })
                  }
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-white/10 dark:bg-black/30 dark:focus:ring-white/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Volume</label>
                <input
                  type="number"
                  min={VOICEVOX_VOLUME_SCALE_MIN}
                  max={VOICEVOX_VOLUME_SCALE_MAX}
                  step={0.1}
                  value={voiceSettings.voicevox.volumeScale}
                  onChange={(changeEvent) =>
                    setConfig((previousConfig) => {
                      // Guard: state should exist here.
                      if (!previousConfig) return previousConfig;
                      const nextValue = toNumberOrFallback(
                        changeEvent.target.value,
                        previousConfig.voiceSettings.voicevox.volumeScale,
                      );
                      return {
                        ...previousConfig,
                        voiceSettings: {
                          ...previousConfig.voiceSettings,
                          voicevox: {
                            ...previousConfig.voiceSettings.voicevox,
                            volumeScale: nextValue,
                          },
                        },
                      };
                    })
                  }
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-white/10 dark:bg-black/30 dark:focus:ring-white/20"
                />
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="text-sm font-medium">Test read-aloud</div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <input
              value={testText}
              onChange={(changeEvent) => setTestText(changeEvent.target.value)}
              placeholder={DEFAULT_TEST_TEXT}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-white/10 dark:bg-black/30 dark:focus:ring-white/20"
            />
            <button
              type="button"
              onClick={() => {
                void speakPreview(testText);
              }}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              Play
            </button>
            <button
              type="button"
              onClick={() => cancelPreview()}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              Stop
            </button>
          </div>
          <div className="text-xs text-zinc-500">
            Uses the current on-screen values (even before saving).
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </section>
  );
}

