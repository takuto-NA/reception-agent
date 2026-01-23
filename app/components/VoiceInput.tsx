"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionCtor;
    SpeechRecognition?: SpeechRecognitionCtor;
  }
}

export function VoiceInput({
  disabled,
  lang = "ja-JP",
  onText,
}: {
  disabled?: boolean;
  lang?: string;
  onText: (text: string) => void;
}) {
  const SpeechRecognitionImpl = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return (window.SpeechRecognition ??
      window.webkitSpeechRecognition) as SpeechRecognitionCtor | undefined;
  }, []);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!SpeechRecognitionImpl) return;
    const recognition = new SpeechRecognitionImpl();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const text = res[0]?.transcript ?? "";
        if (res.isFinal) finalText += text;
        else interimText += text;
      }
      if (finalText.trim()) onText(finalText.trim());
      if (interimText.trim()) {
        // optional: show interim to user; we keep UI minimal for now
      }
    };

    recognition.onerror = (e: any) => {
      setError(e?.error || "speech-error");
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    return () => {
      recognitionRef.current = null;
    };
  }, [SpeechRecognitionImpl, lang, onText]);

  if (!SpeechRecognitionImpl) {
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
          setError(null);
          const rec = recognitionRef.current;
          if (!rec) return;
          if (listening) {
            rec.stop();
            setListening(false);
            return;
          }
          setListening(true);
          rec.start();
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
}

