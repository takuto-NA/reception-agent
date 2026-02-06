"use client";

/**
 * Responsibility:
 * - Render the Settings tab navigation with an active state.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

type SettingsTab = {
  href: string;
  label: string;
};

const SETTINGS_TABS: SettingsTab[] = [
  { href: "/settings", label: "General" },
  { href: "/settings/tools", label: "Tools" },
  { href: "/settings/voice", label: "Voice" },
  { href: "/settings/presence", label: "Presence" },
];

const TAB_BASE_CLASS_NAME =
  "rounded-lg px-3 py-2 text-sm transition hover:bg-zinc-100 dark:hover:bg-white/10";
const TAB_ACTIVE_CLASS_NAME =
  "bg-zinc-100 text-zinc-950 dark:bg-white/10 dark:text-zinc-50";
const TAB_INACTIVE_CLASS_NAME = "text-zinc-600 dark:text-zinc-300";

function isTabActive(currentPathname: string, tabHref: string): boolean {
  // Guard: pathname can be null in some test environments.
  if (!currentPathname) return false;
  if (tabHref === "/settings") return currentPathname === "/settings";
  return currentPathname.startsWith(tabHref);
}

export function SettingsTabs() {
  const pathname = usePathname() ?? "";

  return (
    <nav className="flex flex-wrap gap-2">
      {SETTINGS_TABS.map((tab) => {
        const active = isTabActive(pathname, tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`${TAB_BASE_CLASS_NAME} ${
              active ? TAB_ACTIVE_CLASS_NAME : TAB_INACTIVE_CLASS_NAME
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

