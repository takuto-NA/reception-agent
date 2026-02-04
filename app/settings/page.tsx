"use client";

import { useEffect, useState } from "react";
import {
  type AppConfigDTO,
  clearStoredGroqApiKey,
  fetchSettings,
  toSettingsErrorMessage,
  updateGroqApiKey,
  updateSettings,
} from "./settingsApi";

const MODEL_PREFIX_LMSTUDIO = "lmstudio/";
const MODEL_PREFIX_GROQ = "groq/";
const MODEL_EXAMPLE_LMSTUDIO = "lmstudio/lfm2-8b-a1b";
const MODEL_EXAMPLE_GROQ = "groq/llama-3.3-70b-versatile";
const FIRST_RUN_DATABASE_URL = "file:./prisma/dev.db";
const FIRST_RUN_LMSTUDIO_URL = "http://127.0.0.1:1234";

function getModelGuidance(modelValue: string): string {
  const trimmedModel = modelValue.trim();
  if (!trimmedModel) return "Enter a model id. Example: groq/llama-3.3-70b-versatile";
  if (trimmedModel.startsWith(MODEL_PREFIX_LMSTUDIO)) {
    return "LMSTUDIO model detected. Ensure LMSTUDIO_BASE_URL is set and server is running.";
  }
  if (trimmedModel.startsWith(MODEL_PREFIX_GROQ)) {
    return "Groq model detected. Ensure GROQ_API_KEY is configured.";
  }
  return "Model prefix should be lmstudio/ or groq/.";
}

function isModelPrefixValid(modelValue: string): boolean {
  const trimmedModel = modelValue.trim();
  if (!trimmedModel) return false;
  if (trimmedModel.startsWith(MODEL_PREFIX_LMSTUDIO)) return true;
  if (trimmedModel.startsWith(MODEL_PREFIX_GROQ)) return true;
  return false;
}
export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiKeySaving, setApiKeySaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfigDTO | null>(null);
  const [groqApiKeyInput, setGroqApiKeyInput] = useState("");

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

  async function handleSaveGroqApiKey() {
    // Guard: config not loaded yet.
    if (!config) return;
    const trimmedApiKey = groqApiKeyInput.trim();
    // Guard: empty input.
    if (!trimmedApiKey) return;

    setApiKeySaving(true);
    setError(null);
    try {
      const updatedConfig = await updateGroqApiKey(trimmedApiKey);
      setConfig(updatedConfig);
      setGroqApiKeyInput("");
    } catch (caughtError) {
      setError(toSettingsErrorMessage(caughtError));
    } finally {
      setApiKeySaving(false);
    }
  }

  async function handleClearGroqApiKey() {
    // Guard: config not loaded yet.
    if (!config) return;
    setApiKeySaving(true);
    setError(null);
    try {
      const updatedConfig = await clearStoredGroqApiKey();
      setConfig(updatedConfig);
      setGroqApiKeyInput("");
    } catch (caughtError) {
      setError(toSettingsErrorMessage(caughtError));
    } finally {
      setApiKeySaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      {error ? (
        <div className="mb-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-zinc-600 dark:text-zinc-300">Loading…</div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Guard: render after config loads to keep inputs controlled. */}
          {!config ? (
            <div className="text-sm text-zinc-600 dark:text-zinc-300">
              Loading…
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
                <div className="font-medium">Setup checklist</div>
                <div className="mt-2 space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
                  <div>
                    Database:{" "}
                    <span className="font-medium">
                      {error ? "Failed to load" : "Loaded"}
                    </span>
                  </div>
                  <div>
                    <code>.env.local</code> should include{" "}
                    <code>DATABASE_URL=&quot;{FIRST_RUN_DATABASE_URL}&quot;</code>.
                  </div>
                  <div>
                    For LMSTUDIO set <code>LMSTUDIO_BASE_URL={FIRST_RUN_LMSTUDIO_URL}</code>.
                  </div>
                  <div>Run <code>npm run db:setup</code> after changing DB settings.</div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Groq API key</label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    value={groqApiKeyInput}
                    onChange={(changeEvent) => setGroqApiKeyInput(changeEvent.target.value)}
                    type="password"
                    autoComplete="new-password"
                    placeholder={config.hasGroqApiKey ? "Saved (enter to update)" : "Enter API key"}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-white/10 dark:bg-black/30 dark:focus:ring-white/20"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={apiKeySaving || !groqApiKeyInput.trim()}
                      onClick={handleSaveGroqApiKey}
                      className="rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                    >
                      {apiKeySaving ? "Saving…" : "Save key"}
                    </button>
                    <button
                      type="button"
                      disabled={apiKeySaving || !config.hasGroqApiKey}
                      onClick={handleClearGroqApiKey}
                      className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="text-xs text-zinc-500">
                  Status:{" "}
                  <span className="font-medium">
                    {config.hasGroqApiKey ? "Saved in DB (encrypted)" : "Not set"}
                  </span>
                  . Plaintext is never returned to the browser.
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Model</label>
                <input
                  value={config.model}
                  onChange={(changeEvent) =>
                    setConfig((previousConfig) => {
                      // Guard: state should exist here.
                      if (!previousConfig) return previousConfig;
                      return { ...previousConfig, model: changeEvent.target.value };
                    })
                  }
                  placeholder="groq/llama-3.3-70b-versatile"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-white/10 dark:bg-black/30 dark:focus:ring-white/20"
                />
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
                    onClick={() =>
                      setConfig((previousConfig) => {
                        // Guard: state should exist here.
                        if (!previousConfig) return previousConfig;
                        return { ...previousConfig, model: MODEL_EXAMPLE_LMSTUDIO };
                      })
                    }
                  >
                    Use LMSTUDIO default
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
                    onClick={() =>
                      setConfig((previousConfig) => {
                        // Guard: state should exist here.
                        if (!previousConfig) return previousConfig;
                        return { ...previousConfig, model: MODEL_EXAMPLE_GROQ };
                      })
                    }
                  >
                    Use Groq default
                  </button>
                </div>
                <div
                  className={`text-xs ${
                    isModelPrefixValid(config.model)
                      ? "text-zinc-500"
                      : "text-amber-700 dark:text-amber-300"
                  }`}
                >
                  {getModelGuidance(config.model)}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">System prompt</label>
                <textarea
                  value={config.systemPrompt}
                  onChange={(changeEvent) =>
                    setConfig((previousConfig) => {
                      // Guard: state should exist here.
                      if (!previousConfig) return previousConfig;
                      return {
                        ...previousConfig,
                        systemPrompt: changeEvent.target.value,
                      };
                    })
                  }
                  rows={10}
                  className="w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-white/10 dark:bg-black/30 dark:focus:ring-white/20"
                />
                <div className="text-xs text-zinc-500">
                  This is sent as the system message on each request.
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
            </div>
          )}
        </form>
      )}
    </section>
  );
}
