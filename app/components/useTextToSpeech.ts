"use client";

/**
 * Responsibility:
 * - Provide a unified Text-to-Speech interface for:
 *   - Web Speech API (speechSynthesis)
 *   - VOICEVOX (server proxy -> local engine)
 */

import { useCallback, useMemo, useRef } from "react";
import { useSpeechSynthesis } from "./useSpeechSynthesis";

export type TextToSpeechEngine = "webSpeech" | "voicevox";

export type WebSpeechVoiceSettings = {
  rate: number;
  pitch: number;
  volume: number;
};

export type VoiceVoxVoiceSettings = {
  engineUrl: string;
  speakerId: number;
  speedScale: number;
  pitchScale: number;
  intonationScale: number;
  volumeScale: number;
};

export type TextToSpeechSettings = {
  textToSpeechEngine: TextToSpeechEngine;
  speechLanguageTag: string;
  webSpeech: WebSpeechVoiceSettings;
  voicevox: VoiceVoxVoiceSettings;
};

const VOICEVOX_API_PATH = "/api/tts/voicevox";

export function useTextToSpeech(settings: TextToSpeechSettings) {
  const {
    isSupported: isWebSpeechSupported,
    speak: speakWebSpeech,
    cancel: cancelWebSpeech,
  } = useSpeechSynthesis();

  const activeVoiceVoxAbortControllerRef = useRef<AbortController | null>(null);
  const activeVoiceVoxAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeVoiceVoxObjectUrlRef = useRef<string | null>(null);

  const isSupported = useMemo<boolean | null>(() => {
    if (settings.textToSpeechEngine === "webSpeech") return isWebSpeechSupported;
    return true;
  }, [isWebSpeechSupported, settings.textToSpeechEngine]);

  const cancelVoiceVox = useCallback(() => {
    activeVoiceVoxAbortControllerRef.current?.abort();
    activeVoiceVoxAbortControllerRef.current = null;

    const audio = activeVoiceVoxAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    activeVoiceVoxAudioRef.current = null;

    const objectUrl = activeVoiceVoxObjectUrlRef.current;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    activeVoiceVoxObjectUrlRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    cancelWebSpeech();
    cancelVoiceVox();
  }, [cancelVoiceVox, cancelWebSpeech]);

  const speak = useCallback(
    async (text: string): Promise<void> => {
      // Guard: empty.
      if (!text.trim()) return;

      cancel();

      if (settings.textToSpeechEngine === "webSpeech") {
        await speakWebSpeech(text, {
          lang: settings.speechLanguageTag,
          rate: settings.webSpeech.rate,
          pitch: settings.webSpeech.pitch,
          volume: settings.webSpeech.volume,
        });
        return;
      }

      const abortController = new AbortController();
      activeVoiceVoxAbortControllerRef.current = abortController;

      try {
        const response = await fetch(VOICEVOX_API_PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            voicevox: settings.voicevox,
          }),
          signal: abortController.signal,
        });

        // Guard: cancelled.
        if (abortController.signal.aborted) return;

        if (!response.ok) {
          const errorText = await response
            .text()
            .catch(() => "VOICEVOX request failed");
          throw new Error(errorText);
        }

        const wavBlob = await response.blob();
        const objectUrl = URL.createObjectURL(wavBlob);
        activeVoiceVoxObjectUrlRef.current = objectUrl;

        await new Promise<void>((resolve, reject) => {
          const audio = new Audio(objectUrl);
          activeVoiceVoxAudioRef.current = audio;

          audio.onended = () => resolve();
          audio.onerror = () => reject(new Error("VOICEVOX audio playback failed"));
          audio.play().catch((playError) => reject(playError));
        });
      } catch (caughtError) {
        // Guard: cancelled.
        if (abortController.signal.aborted) return;

        cancelVoiceVox();

        // Guard: fallback when VOICEVOX is unreachable or playback fails.
        if (isWebSpeechSupported) {
          await speakWebSpeech(text, {
            lang: settings.speechLanguageTag,
            rate: settings.webSpeech.rate,
            pitch: settings.webSpeech.pitch,
            volume: settings.webSpeech.volume,
          });
          return;
        }

        throw caughtError;
      } finally {
        cancelVoiceVox();
      }
    },
    [
      cancel,
      cancelVoiceVox,
      isWebSpeechSupported,
      settings.speechLanguageTag,
      settings.textToSpeechEngine,
      settings.voicevox,
      settings.webSpeech.pitch,
      settings.webSpeech.rate,
      settings.webSpeech.volume,
      speakWebSpeech,
    ],
  );

  return { isSupported, speak, cancel };
}

