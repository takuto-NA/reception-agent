"use client";

import { useEffect, useState } from "react";
import {
  type AppConfigDTO,
  fetchSettings,
  toSettingsErrorMessage,
  updateSettings,
} from "./settingsApi";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfigDTO | null>(null);

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
                <div className="text-xs text-zinc-500">
                  Example: <code>groq/llama-3.3-70b-versatile</code>
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
