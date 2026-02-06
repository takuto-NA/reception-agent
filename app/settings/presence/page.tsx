"use client";

/**
 * Responsibility:
 * - Render Settings > Presence page (camera presence detection + debug defaults).
 *
 * Notes:
 * - The actual camera permission is requested from the Chat page.
 * - This page only configures thresholds and default UI toggles.
 */

import { useEffect, useState } from "react";
import {
  type AppConfigDTO,
  fetchSettings,
  toSettingsErrorMessage,
  updateSettings,
} from "../settingsApi";

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

function toNumberOrFallback(input: string, fallback: number): number {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

export default function PresenceSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfigDTO | null>(null);

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

  const presenceSettings = config.presenceSettings;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      {error ? (
        <div className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</div>
      ) : null}

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <div className="text-sm font-medium">Defaults</div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={presenceSettings.isEnabledByDefault}
                onChange={(changeEvent) =>
                  setConfig((previousConfig) => {
                    // Guard: state should exist here.
                    if (!previousConfig) return previousConfig;
                    return {
                      ...previousConfig,
                      presenceSettings: {
                        ...previousConfig.presenceSettings,
                        isEnabledByDefault: changeEvent.target.checked,
                      },
                    };
                  })
                }
              />
              Presence detection enabled
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={presenceSettings.isDebugPanelEnabledByDefault}
                onChange={(changeEvent) =>
                  setConfig((previousConfig) => {
                    // Guard: state should exist here.
                    if (!previousConfig) return previousConfig;
                    return {
                      ...previousConfig,
                      presenceSettings: {
                        ...previousConfig.presenceSettings,
                        isDebugPanelEnabledByDefault: changeEvent.target.checked,
                      },
                    };
                  })
                }
              />
              Debug panel enabled
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={presenceSettings.isOverlayEnabledByDefault}
                onChange={(changeEvent) =>
                  setConfig((previousConfig) => {
                    // Guard: state should exist here.
                    if (!previousConfig) return previousConfig;
                    return {
                      ...previousConfig,
                      presenceSettings: {
                        ...previousConfig.presenceSettings,
                        isOverlayEnabledByDefault: changeEvent.target.checked,
                      },
                    };
                  })
                }
              />
              Video overlay enabled
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Detection</div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Detection FPS</label>
              <input
                type="number"
                min={PRESENCE_DETECTION_FPS_MIN}
                max={PRESENCE_DETECTION_FPS_MAX}
                step={1}
                value={presenceSettings.detectionFps}
                onChange={(changeEvent) =>
                  setConfig((previousConfig) => {
                    // Guard: state should exist here.
                    if (!previousConfig) return previousConfig;
                    const nextValue = toNumberOrFallback(
                      changeEvent.target.value,
                      previousConfig.presenceSettings.detectionFps,
                    );
                    return {
                      ...previousConfig,
                      presenceSettings: {
                        ...previousConfig.presenceSettings,
                        detectionFps: nextValue,
                      },
                    };
                  })
                }
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-white/10 dark:bg-black/30 dark:focus:ring-white/20"
              />
              <div className="text-xs text-zinc-500">
                Lower FPS reduces CPU usage. Start with 8–12.
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Max faces</label>
              <input
                type="number"
                min={PRESENCE_MAX_FACES_MIN}
                max={PRESENCE_MAX_FACES_MAX}
                step={1}
                value={presenceSettings.maxFaces}
                onChange={(changeEvent) =>
                  setConfig((previousConfig) => {
                    // Guard: state should exist here.
                    if (!previousConfig) return previousConfig;
                    const nextValue = toNumberOrFallback(
                      changeEvent.target.value,
                      previousConfig.presenceSettings.maxFaces,
                    );
                    return {
                      ...previousConfig,
                      presenceSettings: {
                        ...previousConfig.presenceSettings,
                        maxFaces: nextValue,
                      },
                    };
                  })
                }
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-white/10 dark:bg-black/30 dark:focus:ring-white/20"
              />
              <div className="text-xs text-zinc-500">
                Caps compute and tracking cost.
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Min confidence</label>
              <input
                type="number"
                min={PRESENCE_MIN_CONFIDENCE_MIN}
                max={PRESENCE_MIN_CONFIDENCE_MAX}
                step={0.05}
                value={presenceSettings.minConfidence}
                onChange={(changeEvent) =>
                  setConfig((previousConfig) => {
                    // Guard: state should exist here.
                    if (!previousConfig) return previousConfig;
                    const nextValue = toNumberOrFallback(
                      changeEvent.target.value,
                      previousConfig.presenceSettings.minConfidence,
                    );
                    return {
                      ...previousConfig,
                      presenceSettings: {
                        ...previousConfig.presenceSettings,
                        minConfidence: nextValue,
                      },
                    };
                  })
                }
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-white/10 dark:bg-black/30 dark:focus:ring-white/20"
              />
              <div className="text-xs text-zinc-500">
                Increase to ignore uncertain detections.
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Min face area ratio</label>
              <input
                type="number"
                min={PRESENCE_MIN_FACE_AREA_RATIO_MIN}
                max={PRESENCE_MIN_FACE_AREA_RATIO_MAX}
                step={0.005}
                value={presenceSettings.minFaceAreaRatio}
                onChange={(changeEvent) =>
                  setConfig((previousConfig) => {
                    // Guard: state should exist here.
                    if (!previousConfig) return previousConfig;
                    const nextValue = toNumberOrFallback(
                      changeEvent.target.value,
                      previousConfig.presenceSettings.minFaceAreaRatio,
                    );
                    return {
                      ...previousConfig,
                      presenceSettings: {
                        ...previousConfig.presenceSettings,
                        minFaceAreaRatio: nextValue,
                      },
                    };
                  })
                }
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-white/10 dark:bg-black/30 dark:focus:ring-white/20"
              />
              <div className="text-xs text-zinc-500">
                Bounding box area divided by frame area.
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">
                Interaction zone margin ratio
              </label>
              <input
                type="number"
                min={PRESENCE_INTERACTION_ZONE_MARGIN_RATIO_MIN}
                max={PRESENCE_INTERACTION_ZONE_MARGIN_RATIO_MAX}
                step={0.01}
                value={presenceSettings.interactionZoneMarginRatio}
                onChange={(changeEvent) =>
                  setConfig((previousConfig) => {
                    // Guard: state should exist here.
                    if (!previousConfig) return previousConfig;
                    const nextValue = toNumberOrFallback(
                      changeEvent.target.value,
                      previousConfig.presenceSettings.interactionZoneMarginRatio,
                    );
                    return {
                      ...previousConfig,
                      presenceSettings: {
                        ...previousConfig.presenceSettings,
                        interactionZoneMarginRatio: nextValue,
                      },
                    };
                  })
                }
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-white/10 dark:bg-black/30 dark:focus:ring-white/20"
              />
              <div className="text-xs text-zinc-500">
                Ignore faces near the screen edge (passerby noise).
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Tracking + transitions</div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Assignment IoU threshold</label>
              <input
                type="number"
                min={PRESENCE_ASSIGNMENT_IOU_THRESHOLD_MIN}
                max={PRESENCE_ASSIGNMENT_IOU_THRESHOLD_MAX}
                step={0.05}
                value={presenceSettings.assignmentIouThreshold}
                onChange={(changeEvent) =>
                  setConfig((previousConfig) => {
                    // Guard: state should exist here.
                    if (!previousConfig) return previousConfig;
                    const nextValue = toNumberOrFallback(
                      changeEvent.target.value,
                      previousConfig.presenceSettings.assignmentIouThreshold,
                    );
                    return {
                      ...previousConfig,
                      presenceSettings: {
                        ...previousConfig.presenceSettings,
                        assignmentIouThreshold: nextValue,
                      },
                    };
                  })
                }
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-white/10 dark:bg-black/30 dark:focus:ring-white/20"
              />
              <div className="text-xs text-zinc-500">
                Higher value keeps IDs stable but may split tracks.
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Track max missed frames</label>
              <input
                type="number"
                min={PRESENCE_TRACK_MAX_MISSED_FRAMES_MIN}
                max={PRESENCE_TRACK_MAX_MISSED_FRAMES_MAX}
                step={1}
                value={presenceSettings.trackMaxMissedFrames}
                onChange={(changeEvent) =>
                  setConfig((previousConfig) => {
                    // Guard: state should exist here.
                    if (!previousConfig) return previousConfig;
                    const nextValue = toNumberOrFallback(
                      changeEvent.target.value,
                      previousConfig.presenceSettings.trackMaxMissedFrames,
                    );
                    return {
                      ...previousConfig,
                      presenceSettings: {
                        ...previousConfig.presenceSettings,
                        trackMaxMissedFrames: nextValue,
                      },
                    };
                  })
                }
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-white/10 dark:bg-black/30 dark:focus:ring-white/20"
              />
              <div className="text-xs text-zinc-500">
                How long a track can survive temporary misses.
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Stable frames required</label>
              <input
                type="number"
                min={PRESENCE_STABLE_FRAMES_REQUIRED_MIN}
                max={PRESENCE_STABLE_FRAMES_REQUIRED_MAX}
                step={1}
                value={presenceSettings.stableFramesRequired}
                onChange={(changeEvent) =>
                  setConfig((previousConfig) => {
                    // Guard: state should exist here.
                    if (!previousConfig) return previousConfig;
                    const nextValue = toNumberOrFallback(
                      changeEvent.target.value,
                      previousConfig.presenceSettings.stableFramesRequired,
                    );
                    return {
                      ...previousConfig,
                      presenceSettings: {
                        ...previousConfig.presenceSettings,
                        stableFramesRequired: nextValue,
                      },
                    };
                  })
                }
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-white/10 dark:bg-black/30 dark:focus:ring-white/20"
              />
              <div className="text-xs text-zinc-500">
                Avoids noisy one-frame detections.
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Dwell ms to greet</label>
              <input
                type="number"
                min={PRESENCE_DWELL_MS_TO_GREET_MIN}
                max={PRESENCE_DWELL_MS_TO_GREET_MAX}
                step={100}
                value={presenceSettings.dwellMsToGreet}
                onChange={(changeEvent) =>
                  setConfig((previousConfig) => {
                    // Guard: state should exist here.
                    if (!previousConfig) return previousConfig;
                    const nextValue = toNumberOrFallback(
                      changeEvent.target.value,
                      previousConfig.presenceSettings.dwellMsToGreet,
                    );
                    return {
                      ...previousConfig,
                      presenceSettings: {
                        ...previousConfig.presenceSettings,
                        dwellMsToGreet: nextValue,
                      },
                    };
                  })
                }
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-white/10 dark:bg-black/30 dark:focus:ring-white/20"
              />
              <div className="text-xs text-zinc-500">
                Speak only after staying in front of the camera.
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Greet cooldown ms</label>
              <input
                type="number"
                min={PRESENCE_GREET_COOLDOWN_MS_MIN}
                max={PRESENCE_GREET_COOLDOWN_MS_MAX}
                step={1000}
                value={presenceSettings.greetCooldownMs}
                onChange={(changeEvent) =>
                  setConfig((previousConfig) => {
                    // Guard: state should exist here.
                    if (!previousConfig) return previousConfig;
                    const nextValue = toNumberOrFallback(
                      changeEvent.target.value,
                      previousConfig.presenceSettings.greetCooldownMs,
                    );
                    return {
                      ...previousConfig,
                      presenceSettings: {
                        ...previousConfig.presenceSettings,
                        greetCooldownMs: nextValue,
                      },
                    };
                  })
                }
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-white/10 dark:bg-black/30 dark:focus:ring-white/20"
              />
              <div className="text-xs text-zinc-500">
                Prevents repeated greetings when people linger.
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Event text template</div>
          <textarea
            value={presenceSettings.eventTextTemplate}
            onChange={(changeEvent) =>
              setConfig((previousConfig) => {
                // Guard: state should exist here.
                if (!previousConfig) return previousConfig;
                return {
                  ...previousConfig,
                  presenceSettings: {
                    ...previousConfig.presenceSettings,
                    eventTextTemplate: changeEvent.target.value,
                  },
                };
              })
            }
            rows={3}
            className="w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-white/10 dark:bg-black/30 dark:focus:ring-white/20"
          />
          <div className="text-xs text-zinc-500">
            Variables: <code>{"{count}"}</code> is replaced with the number of stable
            tracks.
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

