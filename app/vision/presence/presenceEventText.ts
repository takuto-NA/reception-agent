"use client";

/**
 * Responsibility:
 * - Convert presence events into a deterministic text message for the chat agent.
 *
 * Notes:
 * - Keep the format stable so the agent can learn to react consistently.
 * - This intentionally does NOT include any personal identification.
 */

import type { PresenceEvent } from "./PresenceStateMachine";

export function toPresenceEventText(params: {
  event: PresenceEvent;
  template: string;
}): string | null {
  const event = params.event;

  if (event.type !== "greet") return null;

  const stableCountText = String(event.stableCount);
  return params.template.replaceAll("{count}", stableCountText);
}

