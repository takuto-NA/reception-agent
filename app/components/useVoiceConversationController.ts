/**
 * Responsibility:
 * - Orchestrate voice conversation mode (STT start/stop + optional TTS read-aloud).
 *
 * Notes:
 * - This hook is UI-framework glue: keep it small and predictable.
 * - The caller owns message rendering and the mic button behavior.
 */

import { useEffect, useRef } from "react";
import type { VoiceInputHandle } from "./VoiceInput";

type UiMessagePart =
  | { type: "text"; text: string }
  | { type: "text-delta"; textDelta: string }
  | { type: string; [key: string]: unknown };

export type UiMessageLike = {
  id?: string;
  role?: string;
  content?: string;
  parts?: UiMessagePart[];
};

type SpeakTextToSpeech = (
  text: string,
  options?: { lang?: string },
) => Promise<void>;

type Params = {
  isVoiceConversationModeEnabled: boolean;
  isTextToSpeechEnabled: boolean;
  isTextToSpeechSupported: boolean | null;
  isAssistantStreaming: boolean;
  speechLanguageTag: string;
  messages: UiMessageLike[];
  voiceInputRef: React.RefObject<VoiceInputHandle | null>;
  speakTextToSpeech: SpeakTextToSpeech;
};

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

export function useVoiceConversationController({
  isVoiceConversationModeEnabled,
  isTextToSpeechEnabled,
  isTextToSpeechSupported,
  isAssistantStreaming,
  speechLanguageTag,
  messages,
  voiceInputRef,
  speakTextToSpeech,
}: Params) {
  const lastHandledAssistantMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Guard: voice conversation mode is disabled.
    if (!isVoiceConversationModeEnabled) return;
    // Guard: do not start listening while assistant is streaming.
    if (isAssistantStreaming) return;

    voiceInputRef.current?.startListening();
  }, [isAssistantStreaming, isVoiceConversationModeEnabled, voiceInputRef]);

  useEffect(() => {
    // Guard: wait until the assistant finished streaming the response.
    if (isAssistantStreaming) return;
    // Guard: voice conversation mode is disabled.
    if (!isVoiceConversationModeEnabled) return;

    const lastAssistantMessage = [...messages]
      .reverse()
      .find((message) => message.role === "assistant");
    // Guard: no assistant message yet.
    if (!lastAssistantMessage?.id) return;
    // Guard: already handled this assistant message.
    if (lastHandledAssistantMessageIdRef.current === lastAssistantMessage.id)
      return;

    lastHandledAssistantMessageIdRef.current = lastAssistantMessage.id;

    const assistantText = extractMessageText(lastAssistantMessage);
    const resumeListening = () => voiceInputRef.current?.startListening();

    if (!isTextToSpeechEnabled) {
      resumeListening();
      return;
    }

    // Guard: Text-to-Speech is not supported in this browser.
    if (isTextToSpeechSupported === false) {
      resumeListening();
      return;
    }

    (async () => {
      await speakTextToSpeech(assistantText, { lang: speechLanguageTag });
      resumeListening();
    })();
  }, [
    isAssistantStreaming,
    isTextToSpeechEnabled,
    isTextToSpeechSupported,
    isVoiceConversationModeEnabled,
    messages,
    speakTextToSpeech,
    speechLanguageTag,
    voiceInputRef,
  ]);
}
