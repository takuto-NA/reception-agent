/**
 * Responsibility:
 * - Provide the Settings page shell and tab navigation.
 *
 * Notes:
 * - Child pages own data fetching and saving UX.
 */

import { SettingsTabs } from "./SettingsTabs";

export default function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Configure the app behavior and integrations.
        </p>
        <SettingsTabs />
      </section>

      {children}
    </div>
  );
}

