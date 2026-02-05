"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export type VoiceInputHandle = {
  isSupported: () => boolean;
  startListening: () => void;
  stopListening: () => void;
  isListening: () => boolean;
};

const DEFAULT_SPEECH_RECOGNITION_LANGUAGE_TAG = "ja-JP";

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionCtor;
    SpeechRecognition?: SpeechRecognitionCtor;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

type SpeechRecognitionResultEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal?: boolean;
    0?: { transcript?: string };
  }>;
};

function parseSpeechRecognitionResultEvent(
  value: unknown,
): SpeechRecognitionResultEventLike | null {
  // Guard: event must be an object.
  if (!isRecord(value)) return null;
  const resultIndex = value.resultIndex;
  const results = value.results;
  // Guard: basic shape check.
  if (typeof resultIndex !== "number" || !results || typeof results !== "object") {
    return null;
  }
  return value as SpeechRecognitionResultEventLike;
}

export const VoiceInput = forwardRef<
  VoiceInputHandle,
  {
    disabled?: boolean;
    lang?: string;
    onFinalText: (text: string) => void;
  }
>(function VoiceInputInner(
  { disabled, lang = DEFAULT_SPEECH_RECOGNITION_LANGUAGE_TAG, onFinalText },
  ref,
) {
  /**
   * Responsibility:
   * - Decide speech-recognition availability on the client only.
   *
   * Guard:
   * - Avoid server/client branching during initial render to prevent hydration mismatch.
   */
  const [speechRecognitionCtor, setSpeechRecognitionCtor] = useState<
    SpeechRecognitionCtor | undefined | null
  >(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Guard: only resolve browser APIs on the client.
    const ctor = (window.SpeechRecognition ??
      window.webkitSpeechRecognition) as SpeechRecognitionCtor | undefined;
    // Guard: React treats function arguments as state updaters; wrap to store the function itself.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Client-only API detection after mount.
    setSpeechRecognitionCtor(() => ctor);
  }, []);

  useEffect(() => {
    if (!speechRecognitionCtor) return;
    const recognition = new speechRecognitionCtor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (resultEvent: unknown) => {
      const parsedEvent = parseSpeechRecognitionResultEvent(resultEvent);
      // Guard: unexpected event shape.
      if (!parsedEvent) return;
      let finalText = "";
      for (
        let resultIndex = parsedEvent.resultIndex;
        resultIndex < parsedEvent.results.length;
        resultIndex++
      ) {
        const speechResult = parsedEvent.results[resultIndex];
        const text = speechResult[0]?.transcript ?? "";
        if (speechResult.isFinal) finalText += text;
      }
      if (finalText.trim()) onFinalText(finalText.trim());
    };

    recognition.onerror = (errorEvent: unknown) => {
      const errorValue = isRecord(errorEvent) ? errorEvent.error : undefined;
      setError(typeof errorValue === "string" && errorValue ? errorValue : "speech-error");
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [speechRecognitionCtor, lang, onFinalText]);

  useImperativeHandle(
    ref,
    () => ({
      isSupported: () => Boolean(speechRecognitionCtor),
      startListening: () => {
        // Guard: cannot start while disabled.
        if (disabled) return;
        const recognition = recognitionRef.current;
        // Guard: speech recognition is not ready/available.
        if (!recognition) return;
        // Guard: already listening.
        if (listening) return;

        setError(null);
        setListening(true);
        recognition.start();
      },
      stopListening: () => {
        const recognition = recognitionRef.current;
        // Guard: speech recognition is not ready/available.
        if (!recognition) return;

        recognition.stop();
        setListening(false);
      },
      isListening: () => listening,
    }),
    [disabled, listening, speechRecognitionCtor],
  );

  if (speechRecognitionCtor === null) {
    return null;
  }

  if (!speechRecognitionCtor) {
    return (
      <div className="text-xs text-zinc-500">
        Voice input is not supported in this browser.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (listening) {
            const recognition = recognitionRef.current;
            // Guard: speech recognition is not ready/available.
            if (!recognition) return;

            recognition.stop();
            return;
          }

          const recognition = recognitionRef.current;
          // Guard: speech recognition is not ready/available.
          if (!recognition) return;

          setError(null);
          setListening(true);
          recognition.start();
        }}
        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
      >
        {listening ? "Stop mic" : "Mic"}
      </button>
      {error ? (
        <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
      ) : null}
    </div>
  );
});
