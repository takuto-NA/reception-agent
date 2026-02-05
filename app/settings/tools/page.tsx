"use client";

/**
 * Responsibility:
 * - Render Settings > Tools page (enable/disable registered tools).
 */

import { useEffect, useState } from "react";
import {
  type AppConfigDTO,
  fetchSettings,
  fetchToolCatalog,
  type ToolCatalogItem,
  toSettingsErrorMessage,
  updateSettings,
} from "../settingsApi";

export default function ToolsSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfigDTO | null>(null);
  const [tools, setTools] = useState<ToolCatalogItem[]>([]);

  useEffect(() => {
    const abortController = new AbortController();
    (async () => {
      try {
        const [settingsConfig, toolCatalog] = await Promise.all([
          fetchSettings(abortController.signal),
          fetchToolCatalog(abortController.signal),
        ]);
        // Guard: request was aborted (unmounted).
        if (abortController.signal.aborted) return;
        setConfig(settingsConfig);
        setTools(toolCatalog);
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

  const content = loading || !config ? (
    <div className="text-sm text-zinc-600 dark:text-zinc-300">Loading…</div>
  ) : (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <div className="text-sm font-medium">Tools</div>
        <div className="space-y-2">
          {tools.map((toolItem) => {
            const isChecked = config.enabledTools.includes(toolItem.key);
            return (
              <label
                key={toolItem.key}
                className="flex items-start gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-white/10"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(changeEvent) => {
                    const nextEnabledTools = changeEvent.target.checked
                      ? Array.from(new Set([...config.enabledTools, toolItem.key]))
                      : config.enabledTools.filter(
                          (toolKey) => toolKey !== toolItem.key,
                        );
                    setConfig((previousConfig) => {
                      // Guard: should not happen; keep state safe.
                      if (!previousConfig) return previousConfig;
                      return {
                        ...previousConfig,
                        enabledTools: nextEnabledTools,
                      };
                    });
                  }}
                  className="mt-1"
                />
                <div className="min-w-0">
                  <div className="font-medium">{toolItem.key}</div>
                  <div className="text-xs text-zinc-500">
                    {toolItem.description || toolItem.id}
                  </div>
                </div>
              </label>
            );
          })}
          {tools.length === 0 ? (
            <div className="text-sm text-zinc-600 dark:text-zinc-300">
              No tools registered yet.
            </div>
          ) : null}
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
    </form>
  );

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      {error ? (
        <div className="mb-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}
      {content}
    </section>
  );
}

