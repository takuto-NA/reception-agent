"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { VoiceInput } from "./components/VoiceInput";

function extractMessageText(message: any): string {
  const parts = message?.parts;
  if (Array.isArray(parts) && parts.length > 0) {
    return parts
      .map((p: any) => {
        if (p?.type === "text" && typeof p.text === "string") return p.text;
        if (p?.type === "text-delta" && typeof p.textDelta === "string")
          return p.textDelta;
        return "";
      })
      .join("");
  }
  if (typeof message?.content === "string") return message.content;
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

  const { messages, status, error, sendMessage, stop } = useChat({ transport });
  const [input, setInput] = useState("");

  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, status]);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Chat</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Streaming chat powered by Mastra + Groq.
        </p>
        {error ? (
          <div className="text-sm text-red-600 dark:text-red-400">
            {String((error as any).message || error)}
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5">
        <div className="max-h-[60vh] overflow-auto p-4">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">
                Try: “What&apos;s the weather in Tokyo?”
              </div>
            ) : null}

            {messages.map((m: any) => {
              const role = m.role;
              const bubble =
                role === "user"
                  ? "ml-auto bg-zinc-900 text-white dark:bg-white dark:text-black"
                  : "mr-auto bg-zinc-100 text-zinc-900 dark:bg-white/10 dark:text-zinc-50";

              return (
                <div key={m.id} className="flex">
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm leading-6 ${bubble}`}
                  >
                    {extractMessageText(m)}
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
            onSubmit={(e) => {
              e.preventDefault();
              const text = input.trim();
              if (!text) return;
              sendMessage({ text });
              setInput("");
            }}
          >
            <div className="flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={2}
                placeholder="Type your message…"
                className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-white/10 dark:bg-black/30 dark:focus:ring-white/20"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="text-xs text-zinc-500">Status: {status}</div>
                <VoiceInput
                  disabled={status === "streaming"}
                  onText={(text) =>
                    setInput((prev) => (prev ? `${prev} ${text}` : text))
                  }
                />
              </div>
            </div>
            <div className="flex gap-2">
              {status === "streaming" ? (
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
                disabled={!input.trim() || status === "streaming"}
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
