/**
 * Responsibility:
 * - Provide a small, promise-based wrapper around the Web Speech API (speechSynthesis).
 *
 * Notes:
 * - Voice quality depends on the OS/browser voice installed. This is "handy" and requires no backend.
 * - This hook is client-only.
 */
import { useCallback, useEffect, useRef, useState } from "react";

type SpeakOptions = {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
};

const DEFAULT_SPEECH_SYNTHESIS_LANGUAGE_TAG = "ja-JP";
const DEFAULT_SPEECH_SYNTHESIS_RATE = 1.0;
const DEFAULT_SPEECH_SYNTHESIS_PITCH = 1.0;
const DEFAULT_SPEECH_SYNTHESIS_VOLUME = 1.0;

export function useSpeechSynthesis() {
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    // Guard: detect browser API only on the client.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Client-only API detection after mount.
    setIsSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  const cancel = useCallback(() => {
    // Guard: unsupported.
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    currentUtteranceRef.current = null;
  }, [isSupported]);

  const speak = useCallback(
    async (text: string, options?: SpeakOptions): Promise<void> => {
      // Guard: unsupported.
      if (!isSupported) return;
      // Guard: empty.
      if (!text.trim()) return;

      cancel();

      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        currentUtteranceRef.current = utterance;

        utterance.lang = options?.lang ?? DEFAULT_SPEECH_SYNTHESIS_LANGUAGE_TAG;
        utterance.rate = options?.rate ?? DEFAULT_SPEECH_SYNTHESIS_RATE;
        utterance.pitch = options?.pitch ?? DEFAULT_SPEECH_SYNTHESIS_PITCH;
        utterance.volume = options?.volume ?? DEFAULT_SPEECH_SYNTHESIS_VOLUME;

        utterance.onend = () => {
          if (currentUtteranceRef.current === utterance) {
            currentUtteranceRef.current = null;
          }
          resolve();
        };
        utterance.onerror = () => {
          if (currentUtteranceRef.current === utterance) {
            currentUtteranceRef.current = null;
          }
          resolve();
        };

        window.speechSynthesis.speak(utterance);
      });
    },
    [cancel, isSupported],
  );

  return { isSupported, speak, cancel };
}

