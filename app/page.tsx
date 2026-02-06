"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { VoiceInput, type VoiceInputHandle } from "./components/VoiceInput";
import {
  useTextToSpeech,
  type TextToSpeechSettings,
} from "./hooks/useTextToSpeech";
import {
  type UiMessageLike,
  useVoiceConversationController,
} from "./hooks/useVoiceConversationController";
import {
  fetchSettings,
  toSettingsErrorMessage,
  type AppConfigDTO,
} from "./settings/settingsApi";
import { PresenceDetector } from "./vision/presence/PresenceDetector";
import {
  FaceTrackManager,
  filterDetectionsForPresence,
  type FaceTrack,
  type TrackUpdateResult,
} from "./vision/presence/FaceTrackManager";
import {
  PresenceStateMachine,
  type PresenceEvent,
  type PresenceState,
} from "./vision/presence/PresenceStateMachine";
import { toPresenceEventText } from "./vision/presence/presenceEventText";

const DEFAULT_SPEECH_LANGUAGE_TAG = "ja-JP";

const DEFAULT_TEXT_TO_SPEECH_SETTINGS: TextToSpeechSettings = {
  textToSpeechEngine: "webSpeech",
  speechLanguageTag: DEFAULT_SPEECH_LANGUAGE_TAG,
  webSpeech: { rate: 1.0, pitch: 1.0, volume: 1.0 },
  voicevox: {
    engineUrl: "http://127.0.0.1:50021",
    speakerId: 1,
    speedScale: 1.0,
    pitchScale: 0.0,
    intonationScale: 1.0,
    volumeScale: 1.0,
  },
};

// UI readability constants (avoid burying critical layout intent in strings).
const CHAT_SCROLL_MAX_HEIGHT_CLASS = "max-h-[60vh]";
const CHAT_MESSAGE_MAX_WIDTH_CLASS = "max-w-[85%]";
const FIRST_RUN_DATABASE_URL = "file:./prisma/dev.db";
const FIRST_RUN_MODEL_LMSTUDIO = "lmstudio/lfm2-8b-a1b";
const FIRST_RUN_MODEL_GROQ = "groq/llama-3.3-70b-versatile";
const FIRST_RUN_LMSTUDIO_URL = "http://127.0.0.1:1234";

const CAMERA_IDEAL_WIDTH_PIXELS = 1280;
const CAMERA_IDEAL_HEIGHT_PIXELS = 720;

const PRESENCE_MESSAGE_KIND = "presence";
const PRESENCE_EVENT_LOG_MAX_ENTRIES = 200;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractMessageText(message: UiMessageLike): string {
  const parts = message.parts;
  if (Array.isArray(parts) && parts.length > 0) {
    return parts
      .map((messagePart) => {
        if (messagePart.type === "text") return messagePart.text;
        if (messagePart.type === "text-delta") return messagePart.textDelta;
        return "";
      })
      .join("");
  }
  if (typeof message.content === "string") return message.content;
  return "";
}

function isPresenceSensorMessage(message: UiMessageLike): boolean {
  const asRecord = message as unknown;
  // Guard: not an object.
  if (!isRecord(asRecord)) return false;
  const metadata = asRecord.metadata;
  // Guard: no metadata.
  if (!isRecord(metadata)) return false;
  return metadata.kind === PRESENCE_MESSAGE_KIND;
}

type PresenceDebugSnapshot = {
  camera: {
    isRunning: boolean;
    lastError: string | null;
  };
  lastDetection: {
    detectedAtMs: number;
    acceptedCount: number;
    rejectedCount: number;
    rejectionCounts: Record<string, number>;
  } | null;
  lastTrackUpdate: TrackUpdateResult | null;
  presenceState: PresenceState | null;
  recentEvents: Array<{
    event: PresenceEvent;
    createdAtMs: number;
  }>;
  lastSentPresenceText: string | null;
};

export default function Home() {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
      }),
    [],
  );

  const [settingsLoadError, setSettingsLoadError] = useState<string | null>(null);
  const [textToSpeechSettings, setTextToSpeechSettings] =
    useState<TextToSpeechSettings>(DEFAULT_TEXT_TO_SPEECH_SETTINGS);
  const [speechLanguageTag, setSpeechLanguageTag] = useState(
    DEFAULT_SPEECH_LANGUAGE_TAG,
  );
  const [presenceSettings, setPresenceSettings] = useState<
    AppConfigDTO["presenceSettings"] | null
  >(null);

  const {
    messages: rawMessages,
    status,
    error,
    sendMessage,
    stop,
  } = useChat({
    transport,
  });
  /**
   * Responsibility:
   * - Keep `status` comparisons robust across AI SDK typing differences.
   *
   * Notes:
   * - Some versions of `@ai-sdk/react` don't include `"streaming"` in the type,
   *   even though it can occur at runtime. Keep the cast localized.
   */
  const chatStatusText = String(status);
  const isAssistantStreaming = chatStatusText === "streaming";
  const messages = rawMessages as unknown as UiMessageLike[];
  const [input, setInput] = useState("");

  const [isVoiceConversationModeEnabled, setIsVoiceConversationModeEnabled] =
    useState(false);
  const [isAutoSendEnabled, setIsAutoSendEnabled] = useState(true);
  const [isTextToSpeechEnabled, setIsTextToSpeechEnabled] = useState(true);

  const voiceInputRef = useRef<VoiceInputHandle | null>(null);
  const {
    isSupported: isTextToSpeechSupported,
    speak: speakTextToSpeechInternal,
    cancel: cancelTextToSpeech,
  } = useTextToSpeech(textToSpeechSettings);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const detectionIntervalIdRef = useRef<number | null>(null);

  const presenceDetectorRef = useRef<PresenceDetector | null>(null);
  const faceTrackManagerRef = useRef<FaceTrackManager | null>(null);
  const presenceStateMachineRef = useRef<PresenceStateMachine | null>(null);

  const presenceSettingsRef = useRef<AppConfigDTO["presenceSettings"] | null>(null);
  useEffect(() => {
    presenceSettingsRef.current = presenceSettings;
  }, [presenceSettings]);

  const [isPresenceEnabled, setIsPresenceEnabled] = useState(false);
  const [isPresenceDebugPanelEnabled, setIsPresenceDebugPanelEnabled] = useState(true);
  const [isPresenceOverlayEnabled, setIsPresenceOverlayEnabled] = useState(true);

  const isPresenceEnabledRef = useRef(false);
  const isPresenceOverlayEnabledRef = useRef(true);
  const isAssistantStreamingRef = useRef(false);
  useEffect(() => {
    isPresenceEnabledRef.current = isPresenceEnabled;
  }, [isPresenceEnabled]);
  useEffect(() => {
    isPresenceOverlayEnabledRef.current = isPresenceOverlayEnabled;
  }, [isPresenceOverlayEnabled]);
  useEffect(() => {
    isAssistantStreamingRef.current = isAssistantStreaming;
  }, [isAssistantStreaming]);

  const [presenceDebugSnapshot, setPresenceDebugSnapshot] =
    useState<PresenceDebugSnapshot>({
      camera: { isRunning: false, lastError: null },
      lastDetection: null,
      lastTrackUpdate: null,
      presenceState: null,
      recentEvents: [],
      lastSentPresenceText: null,
    });

  useEffect(() => {
    const abortController = new AbortController();
    (async () => {
      try {
        const appConfig: AppConfigDTO = await fetchSettings(abortController.signal);
        // Guard: request was aborted (unmounted).
        if (abortController.signal.aborted) return;

        const voiceSettings = appConfig.voiceSettings;

        setIsVoiceConversationModeEnabled(
          voiceSettings.isVoiceConversationModeEnabledByDefault,
        );
        setIsAutoSendEnabled(voiceSettings.isAutoSendEnabledByDefault);
        setIsTextToSpeechEnabled(voiceSettings.isTextToSpeechEnabledByDefault);
        setSpeechLanguageTag(voiceSettings.speechLanguageTag);
        setTextToSpeechSettings({
          textToSpeechEngine: voiceSettings.textToSpeechEngine,
          speechLanguageTag: voiceSettings.speechLanguageTag,
          webSpeech: voiceSettings.webSpeech,
          voicevox: voiceSettings.voicevox,
        });
        setPresenceSettings(appConfig.presenceSettings);
        setIsPresenceEnabled(appConfig.presenceSettings.isEnabledByDefault);
        setIsPresenceDebugPanelEnabled(
          appConfig.presenceSettings.isDebugPanelEnabledByDefault,
        );
        setIsPresenceOverlayEnabled(
          appConfig.presenceSettings.isOverlayEnabledByDefault,
        );
        setSettingsLoadError(null);
      } catch (caughtError) {
        // Guard: request was aborted (unmounted).
        if (abortController.signal.aborted) return;
        setSettingsLoadError(toSettingsErrorMessage(caughtError));
      }
    })();

    return () => {
      abortController.abort();
    };
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Stop camera on unmount.
  }, []);

  function appendPresenceEventsToDebugLog(events: PresenceEvent[], detectedAtMs: number) {
    if (events.length === 0) return;
    setPresenceDebugSnapshot((previous) => {
      const nextEntries = [
        ...previous.recentEvents,
        ...events.map((event) => ({ event, createdAtMs: detectedAtMs })),
      ];
      const trimmed =
        nextEntries.length > PRESENCE_EVENT_LOG_MAX_ENTRIES
          ? nextEntries.slice(-PRESENCE_EVENT_LOG_MAX_ENTRIES)
          : nextEntries;
      return { ...previous, recentEvents: trimmed };
    });
  }

  function drawOverlay(params: {
    tracks: FaceTrack[];
    stableTracks: FaceTrack[];
    presenceSettings: AppConfigDTO["presenceSettings"];
    videoWidth: number;
    videoHeight: number;
  }) {
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;
    // Guard: elements not ready.
    if (!canvas || !video) return;

    const canvasWidth = params.videoWidth;
    const canvasHeight = params.videoHeight;
    // Guard: invalid video size.
    if (!canvasWidth || !canvasHeight) return;

    if (canvas.width !== canvasWidth) canvas.width = canvasWidth;
    if (canvas.height !== canvasHeight) canvas.height = canvasHeight;

    const context = canvas.getContext("2d");
    // Guard: canvas context unavailable.
    if (!context) return;

    context.clearRect(0, 0, canvasWidth, canvasHeight);

    const margin = params.presenceSettings.interactionZoneMarginRatio;
    context.strokeStyle = "rgba(255,255,255,0.35)";
    context.lineWidth = 2;
    context.strokeRect(
      canvasWidth * margin,
      canvasHeight * margin,
      canvasWidth * (1 - margin * 2),
      canvasHeight * (1 - margin * 2),
    );

    const stableTrackIdSet = new Set<number>(
      params.stableTracks.map((track) => track.trackId),
    );

    for (const track of params.tracks) {
      const box = track.latestBoundingBox;
      const x = box.xMin * canvasWidth;
      const y = box.yMin * canvasHeight;
      const width = box.width * canvasWidth;
      const height = box.height * canvasHeight;

      const isStable = stableTrackIdSet.has(track.trackId);
      context.strokeStyle = isStable ? "rgba(0,255,0,0.85)" : "rgba(0,180,255,0.75)";
      context.lineWidth = isStable ? 3 : 2;
      context.strokeRect(x, y, width, height);

      context.fillStyle = "rgba(0,0,0,0.55)";
      context.fillRect(x, Math.max(0, y - 18), 160, 18);
      context.fillStyle = "white";
      context.font = "12px sans-serif";
      const dwellMs = Math.max(0, performance.now() - track.firstMatchedAtMs);
      const dwellSeconds = (dwellMs / 1000).toFixed(1);
      context.fillText(
        `#${track.trackId} stable=${String(isStable)} dwell=${dwellSeconds}s miss=${track.missedFrameCount}`,
        x + 4,
        Math.max(12, y - 5),
      );
    }
  }

  async function startCamera() {
    const video = videoRef.current;
    // Guard: video element missing (should not happen).
    if (!video) return;
    // Guard: already running.
    if (cameraStreamRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: CAMERA_IDEAL_WIDTH_PIXELS },
          height: { ideal: CAMERA_IDEAL_HEIGHT_PIXELS },
        },
        audio: false,
      });

      cameraStreamRef.current = stream;
      video.srcObject = stream;
      await video.play();

      const latestPresenceSettings = presenceSettingsRef.current;
      // Guard: presence settings not loaded yet.
      if (!latestPresenceSettings) return;

      const detector = new PresenceDetector({
        detectionFps: latestPresenceSettings.detectionFps,
        maxFaces: latestPresenceSettings.maxFaces,
        minConfidence: latestPresenceSettings.minConfidence,
      });
      await detector.initialize();
      presenceDetectorRef.current = detector;

      faceTrackManagerRef.current = new FaceTrackManager({
        assignmentIouThreshold: latestPresenceSettings.assignmentIouThreshold,
        trackMaxMissedFrames: latestPresenceSettings.trackMaxMissedFrames,
        stableFramesRequired: latestPresenceSettings.stableFramesRequired,
      });

      presenceStateMachineRef.current = new PresenceStateMachine({
        dwellMsToGreet: latestPresenceSettings.dwellMsToGreet,
        greetCooldownMs: latestPresenceSettings.greetCooldownMs,
      });

      setPresenceDebugSnapshot((previous) => ({
        ...previous,
        camera: { isRunning: true, lastError: null },
      }));

      const intervalMs = Math.max(1, Math.floor(1000 / latestPresenceSettings.detectionFps));
      detectionIntervalIdRef.current = window.setInterval(() => {
        const detectorInstance = presenceDetectorRef.current;
        const trackManager = faceTrackManagerRef.current;
        const stateMachine = presenceStateMachineRef.current;
        const settings = presenceSettingsRef.current;
        const currentVideo = videoRef.current;

        // Guard: presence disabled.
        if (!isPresenceEnabledRef.current) return;
        // Guard: not initialized.
        if (!detectorInstance || !trackManager || !stateMachine || !settings) return;
        // Guard: video not ready.
        if (!currentVideo) return;

        const detectionResult = detectorInstance.detect(currentVideo);
        if (!detectionResult) return;

        const filtered = filterDetectionsForPresence({
          detections: detectionResult.detections,
          minConfidence: settings.minConfidence,
          filterSettings: {
            minFaceAreaRatio: settings.minFaceAreaRatio,
            interactionZoneMarginRatio: settings.interactionZoneMarginRatio,
          },
        });

        const rejectionCounts: Record<string, number> = {};
        for (const rejected of filtered.rejectedDetections) {
          for (const reason of rejected.rejectionReasons) {
            rejectionCounts[reason] = (rejectionCounts[reason] ?? 0) + 1;
          }
        }

        const trackUpdate = trackManager.update({
          detections: filtered.acceptedDetections,
          detectedAtMs: detectionResult.detectedAtMs,
        });

        const stableCount = trackUpdate.stableTracks.length;
        const presenceEvents = stateMachine.update({
          stableCount,
          detectedAtMs: detectionResult.detectedAtMs,
        });

        appendPresenceEventsToDebugLog(presenceEvents, detectionResult.detectedAtMs);

        setPresenceDebugSnapshot((previous) => ({
          ...previous,
          lastDetection: {
            detectedAtMs: detectionResult.detectedAtMs,
            acceptedCount: filtered.acceptedDetections.length,
            rejectedCount: filtered.rejectedDetections.length,
            rejectionCounts,
          },
          lastTrackUpdate: trackUpdate,
          presenceState: stateMachine.getState(),
        }));

        if (isPresenceOverlayEnabledRef.current) {
          drawOverlay({
            tracks: trackUpdate.tracks,
            stableTracks: trackUpdate.stableTracks,
            presenceSettings: settings,
            videoWidth: detectionResult.videoWidth,
            videoHeight: detectionResult.videoHeight,
          });
        }

        for (const event of presenceEvents) {
          const eventText = toPresenceEventText({
            event,
            template: settings.eventTextTemplate,
          });
          if (!eventText) continue;
          // Guard: do not auto-send while assistant is already streaming (keeps UX predictable).
          if (isAssistantStreamingRef.current) continue;
          sendMessage(
            {
              text: eventText,
              metadata: { kind: PRESENCE_MESSAGE_KIND },
            } as unknown as { text: string; metadata: unknown },
          );
          setPresenceDebugSnapshot((previous) => ({
            ...previous,
            lastSentPresenceText: eventText,
          }));
        }
      }, intervalMs);
    } catch (caughtError) {
      setPresenceDebugSnapshot((previous) => ({
        ...previous,
        camera: { isRunning: false, lastError: getErrorMessage(caughtError) },
      }));
    }
  }

  function stopCamera() {
    const intervalId = detectionIntervalIdRef.current;
    if (intervalId) window.clearInterval(intervalId);
    detectionIntervalIdRef.current = null;

    const stream = cameraStreamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    cameraStreamRef.current = null;

    presenceDetectorRef.current?.close();
    presenceDetectorRef.current = null;
    faceTrackManagerRef.current?.reset();
    faceTrackManagerRef.current = null;
    presenceStateMachineRef.current?.reset();
    presenceStateMachineRef.current = null;

    const video = videoRef.current;
    if (video) video.srcObject = null;

    const canvas = overlayCanvasRef.current;
    if (canvas) {
      const context = canvas.getContext("2d");
      context?.clearRect(0, 0, canvas.width, canvas.height);
    }

    setPresenceDebugSnapshot((previous) => ({
      ...previous,
      camera: { isRunning: false, lastError: null },
      lastDetection: null,
      lastTrackUpdate: null,
      presenceState: null,
    }));
  }

  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, status]);

  useVoiceConversationController({
    isVoiceConversationModeEnabled,
    isTextToSpeechEnabled,
    isTextToSpeechSupported,
    isAssistantStreaming,
    speechLanguageTag,
    messages,
    voiceInputRef,
    speakTextToSpeech: async (text: string) => {
      await speakTextToSpeechInternal(text);
    },
  });

  const visibleMessages = messages.filter(
    (message) => !isPresenceSensorMessage(message),
  );

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Chat</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Streaming chat powered by Mastra + LMSTUDIO/Groq.
        </p>
        {settingsLoadError ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
            <div className="font-medium">First-run setup required</div>
            <div className="mt-1 text-xs text-amber-900/80 dark:text-amber-100/80">
              Settings failed to load. Complete the checklist below and refresh this page.
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <div>
                1) Copy <code>env.example</code> to <code>.env.local</code> and set
                <code>DATABASE_URL=&quot;{FIRST_RUN_DATABASE_URL}&quot;</code>.
              </div>
              <div>
                2) Run <code>npm run db:setup</code> to initialize the DB (Windows: stop{" "}
                <code>npm run dev</code> first if Prisma shows <code>EPERM</code>).
              </div>
              <div>
                3) For LMSTUDIO set <code>LMSTUDIO_BASE_URL={FIRST_RUN_LMSTUDIO_URL}</code> and
                set <code>MODEL_ID={FIRST_RUN_MODEL_LMSTUDIO}</code>. For Groq set{" "}
                <code>MODEL_ID={FIRST_RUN_MODEL_GROQ}</code>.
              </div>
              <div>
                4) Open <a className="underline" href="/settings">Settings</a> to confirm.
              </div>
              <div>
                Need help? See <code>docs/troubleshooting.md</code>.
              </div>
            </div>
          </div>
        ) : null}
        {settingsLoadError ? (
          <div className="text-sm text-red-600 dark:text-red-400">
            Settings load failed: {settingsLoadError}
          </div>
        ) : null}
        {error ? (
          <div className="text-sm text-red-600 dark:text-red-400">
            {getErrorMessage(error)}
            <div className="mt-1 text-xs text-red-600/80 dark:text-red-300/80">
              Check that the model is valid and the provider server is running.
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5">
        <div className={`${CHAT_SCROLL_MAX_HEIGHT_CLASS} overflow-auto p-4`}>
          <div className="space-y-4">
            {visibleMessages.length === 0 ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">
                Try: “What&apos;s the weather in Tokyo?”
              </div>
            ) : null}

            {visibleMessages.map((message) => {
              const role = message.role;
              const bubble =
                role === "user"
                  ? "ml-auto bg-zinc-900 text-white dark:bg-white dark:text-black"
                  : "mr-auto bg-zinc-100 text-zinc-900 dark:bg-white/10 dark:text-zinc-50";

              return (
                <div key={message.id} className="flex">
                  <div
                    className={`${CHAT_MESSAGE_MAX_WIDTH_CLASS} whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm leading-6 ${bubble}`}
                  >
                    {extractMessageText(message)}
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        </div>

        <div className="border-t border-zinc-200 p-3 dark:border-white/10">
          <form
            className="flex items-end gap-2"
            onSubmit={(submitEvent) => {
              submitEvent.preventDefault();
              const text = input.trim();
              if (!text) return;
              sendMessage({ text });
              setInput("");
            }}
          >
            <div className="flex-1">
              <textarea
                value={input}
                onChange={(changeEvent) => setInput(changeEvent.target.value)}
                rows={2}
                placeholder="Type your message…"
                className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-white/10 dark:bg-black/30 dark:focus:ring-white/20"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                  <div>Status: {status}</div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isVoiceConversationModeEnabled}
                      onChange={(changeEvent) =>
                        setIsVoiceConversationModeEnabled(
                          changeEvent.target.checked,
                        )
                      }
                    />
                    Voice mode
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isAutoSendEnabled}
                      onChange={(changeEvent) =>
                        setIsAutoSendEnabled(changeEvent.target.checked)
                      }
                      disabled={!isVoiceConversationModeEnabled}
                    />
                    Auto send
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isTextToSpeechEnabled}
                      onChange={(changeEvent) =>
                        setIsTextToSpeechEnabled(changeEvent.target.checked)
                      }
                      disabled={!isVoiceConversationModeEnabled}
                    />
                    Read aloud
                  </label>
                </div>
                <VoiceInput
                  ref={voiceInputRef}
                  disabled={isAssistantStreaming}
                  lang={speechLanguageTag}
                  onFinalText={(text) => {
                    if (!isVoiceConversationModeEnabled) {
                      setInput((previousInput) =>
                        previousInput ? `${previousInput} ${text}` : text,
                      );
                      return;
                    }

                    if (!isAutoSendEnabled) {
                      setInput((previousInput) =>
                        previousInput ? `${previousInput} ${text}` : text,
                      );
                      return;
                    }

                    const trimmed = text.trim();
                    // Guard: empty speech result.
                    if (!trimmed) return;

                    sendMessage({ text: trimmed });
                    setInput("");
                  }}
                />
              </div>
            </div>
            <div className="flex gap-2">
              {isAssistantStreaming ? (
                <button
                  type="button"
                  onClick={() => stop()}
                  className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                >
                  Stop
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => cancelTextToSpeech()}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                Stop voice
              </button>
              <button
                type="submit"
                disabled={!input.trim() || isAssistantStreaming}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Presence debug</div>
            <div className="text-xs text-zinc-500">
              Face detection + tracking + transitions (client-side).
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isPresenceEnabled}
                onChange={(changeEvent) => setIsPresenceEnabled(changeEvent.target.checked)}
                disabled={!presenceSettings}
              />
              Enabled
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isPresenceDebugPanelEnabled}
                onChange={(changeEvent) =>
                  setIsPresenceDebugPanelEnabled(changeEvent.target.checked)
                }
              />
              Panel
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isPresenceOverlayEnabled}
                onChange={(changeEvent) =>
                  setIsPresenceOverlayEnabled(changeEvent.target.checked)
                }
              />
              Overlay
            </label>
            {presenceDebugSnapshot.camera.isRunning ? (
              <button
                type="button"
                onClick={() => stopCamera()}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                Stop camera
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void startCamera()}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                Start camera
              </button>
            )}
          </div>
        </div>

        {presenceDebugSnapshot.camera.lastError ? (
          <div className="mt-3 text-sm text-red-600 dark:text-red-400">
            Camera error: {presenceDebugSnapshot.camera.lastError}
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <div className="relative overflow-hidden rounded-xl border border-zinc-200 dark:border-white/10">
              <video
                ref={videoRef}
                muted
                playsInline
                className="block h-auto w-full bg-black"
              />
              <canvas
                ref={overlayCanvasRef}
                className={`absolute left-0 top-0 h-full w-full ${
                  isPresenceOverlayEnabled ? "block" : "hidden"
                }`}
              />
            </div>
            <div className="text-xs text-zinc-500">
              Tip: open Settings → Presence to tune thresholds for your camera placement.
            </div>
          </div>

          {isPresenceDebugPanelEnabled ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-white/10">
                  <div className="text-xs text-zinc-500">Last detection</div>
                  <div className="mt-1 font-medium">
                    {presenceDebugSnapshot.lastDetection
                      ? `${presenceDebugSnapshot.lastDetection.acceptedCount} accepted / ${presenceDebugSnapshot.lastDetection.rejectedCount} rejected`
                      : "—"}
                  </div>
                  {presenceDebugSnapshot.lastDetection &&
                  Object.keys(presenceDebugSnapshot.lastDetection.rejectionCounts).length ? (
                    <div className="mt-1 text-xs text-zinc-500">
                      {Object.entries(presenceDebugSnapshot.lastDetection.rejectionCounts)
                        .map(([reason, count]) => `${reason}:${count}`)
                        .join(" ")}
                    </div>
                  ) : null}
                </div>
                <div className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-white/10">
                  <div className="text-xs text-zinc-500">Presence state</div>
                  <div className="mt-1 font-medium">
                    {presenceDebugSnapshot.presenceState
                      ? presenceDebugSnapshot.presenceState.state
                      : "—"}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-white/10">
                <div className="text-xs text-zinc-500">Tracks</div>
                <div className="mt-2 space-y-1 text-xs">
                  {presenceDebugSnapshot.lastTrackUpdate?.tracks?.length ? (
                    presenceDebugSnapshot.lastTrackUpdate.tracks.map((track) => (
                      <div key={track.trackId} className="flex justify-between gap-3">
                        <div className="font-medium">#{track.trackId}</div>
                        <div className="text-zinc-500">
                          stable=
                          {String(
                            track.consecutiveMatchCount >=
                              (presenceSettings?.stableFramesRequired ?? 0),
                          )}
                          , miss={track.missedFrameCount}, conf=
                          {track.latestConfidence.toFixed(2)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-zinc-500">—</div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-white/10">
                <div className="text-xs text-zinc-500">Recent events</div>
                <div className="mt-2 max-h-48 space-y-1 overflow-auto text-xs">
                  {presenceDebugSnapshot.recentEvents.length ? (
                    [...presenceDebugSnapshot.recentEvents]
                      .slice()
                      .reverse()
                      .map((entry, index) => (
                        <div
                          key={`${entry.createdAtMs}-${index}`}
                          className="flex justify-between gap-3"
                        >
                          <div className="font-medium">
                            {entry.event.type}
                            {"suppressionReason" in entry.event
                              ? `(${entry.event.suppressionReason})`
                              : ""}
                          </div>
                          <div className="text-zinc-500">
                            count={
                              "stableCount" in entry.event
                                ? String(entry.event.stableCount)
                                : "—"
                            }
                            {"visitDurationMs" in entry.event
                              ? `, visitMs=${String(entry.event.visitDurationMs)}`
                              : ""}
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="text-zinc-500">—</div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-white/10">
                <div className="text-xs text-zinc-500">Last sent presence text</div>
                <div className="mt-1 text-xs">
                  {presenceDebugSnapshot.lastSentPresenceText ?? "—"}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
