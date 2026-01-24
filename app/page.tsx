"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { VoiceInput, type VoiceInputHandle } from "./components/VoiceInput";
import { useSpeechSynthesis } from "./components/useSpeechSynthesis";
import {
  type UiMessageLike,
  useVoiceConversationController,
} from "./components/useVoiceConversationController";

const SPEECH_RECOGNITION_LANGUAGE_TAG = "ja-JP";

// UI readability constants (avoid burying critical layout intent in strings).
const CHAT_SCROLL_MAX_HEIGHT_CLASS = "max-h-[60vh]";
const CHAT_MESSAGE_MAX_WIDTH_CLASS = "max-w-[85%]";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
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

export default function Home() {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
      }),
    [],
  );

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
  const { isSupported: isTextToSpeechSupported, speak: speakTextToSpeech } =
    useSpeechSynthesis();

  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, status]);

  useVoiceConversationController({
    isVoiceConversationModeEnabled,
    isTextToSpeechEnabled,
    isTextToSpeechSupported,
    isAssistantStreaming,
    speechLanguageTag: SPEECH_RECOGNITION_LANGUAGE_TAG,
    messages,
    voiceInputRef,
    speakTextToSpeech,
  });

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Chat</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Streaming chat powered by Mastra + Groq.
        </p>
        {error ? (
          <div className="text-sm text-red-600 dark:text-red-400">
            {getErrorMessage(error)}
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5">
        <div className={`${CHAT_SCROLL_MAX_HEIGHT_CLASS} overflow-auto p-4`}>
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">
                Try: “What&apos;s the weather in Tokyo?”
              </div>
            ) : null}

            {messages.map((message) => {
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
    </div>
  );
}
