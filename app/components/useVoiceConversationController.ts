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
  const isTextToSpeechPlaybackInProgressRef = useRef(false);

  const POST_TEXT_TO_SPEECH_RESUME_DELAY_MILLISECONDS = 600;

  function getLastAssistantMessage(): UiMessageLike | undefined {
    return [...messages].reverse().find((message) => message.role === "assistant");
  }

  useEffect(() => {
    // Guard: voice conversation mode is disabled.
    if (!isVoiceConversationModeEnabled) return;
    // Guard: do not start listening while assistant is streaming.
    if (isAssistantStreaming) return;
    // Guard: do not start listening during text-to-speech playback.
    // (Prevents the assistant's own voice from being recognized.)
    if (isTextToSpeechPlaybackInProgressRef.current) return;

    const isTextToSpeechPotentiallyAvailable =
      isTextToSpeechEnabled && isTextToSpeechSupported !== false;
    if (isTextToSpeechPotentiallyAvailable) {
      const lastAssistantMessage = getLastAssistantMessage();
      const lastAssistantMessageId = lastAssistantMessage?.id;
      const hasUnhandledAssistantMessage =
        Boolean(lastAssistantMessageId) &&
        lastHandledAssistantMessageIdRef.current !== lastAssistantMessageId;

      // Guard: about to read the assistant message; don't start mic now.
      if (hasUnhandledAssistantMessage) return;
    }

    voiceInputRef.current?.startListening();
  }, [
    isAssistantStreaming,
    isTextToSpeechEnabled,
    isTextToSpeechSupported,
    isVoiceConversationModeEnabled,
    messages,
    voiceInputRef,
  ]);

  useEffect(() => {
    // Guard: wait until the assistant finished streaming the response.
    if (isAssistantStreaming) return;
    // Guard: voice conversation mode is disabled.
    if (!isVoiceConversationModeEnabled) return;

    const lastAssistantMessage = getLastAssistantMessage();
    // Guard: no assistant message yet.
    if (!lastAssistantMessage?.id) return;
    // Guard: already handled this assistant message.
    if (lastHandledAssistantMessageIdRef.current === lastAssistantMessage.id)
      return;

    lastHandledAssistantMessageIdRef.current = lastAssistantMessage.id;

    const assistantText = extractMessageText(lastAssistantMessage);
    const resumeListening = () => {
      // Guard: voice conversation mode is disabled.
      if (!isVoiceConversationModeEnabled) return;
      voiceInputRef.current?.startListening();
    };

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
      // Guard: stop mic before speaking to prevent self-recognition.
      voiceInputRef.current?.stopListening();
      isTextToSpeechPlaybackInProgressRef.current = true;
      try {
        await speakTextToSpeech(assistantText, { lang: speechLanguageTag });
        await new Promise<void>((resolve) =>
          setTimeout(resolve, POST_TEXT_TO_SPEECH_RESUME_DELAY_MILLISECONDS),
        );
      } catch {
        // Guard: ignore TTS errors and keep the voice conversation loop alive.
      } finally {
        isTextToSpeechPlaybackInProgressRef.current = false;
        resumeListening();
      }
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
