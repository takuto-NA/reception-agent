"use client";

/**
 * Responsibility:
 * - Convert stable track counts into debounced presence transitions and greet triggers.
 *
 * States:
 * - noPresence: no stable tracks
 * - present: stable tracks exist (visit ongoing)
 *
 * Notes:
 * - Greets at most once per visit, with a cooldown across visits.
 */

export type PresenceEvent =
  | {
      type: "enter";
      detectedAtMs: number;
      stableCount: number;
    }
  | {
      type: "exit";
      detectedAtMs: number;
      stableCount: number;
    }
  | {
      type: "greet";
      detectedAtMs: number;
      stableCount: number;
      visitDurationMs: number;
    }
  | {
      type: "greet-suppressed";
      detectedAtMs: number;
      stableCount: number;
      suppressionReason: "cooldown";
      visitDurationMs: number;
    };

export type PresenceState = {
  state: "noPresence" | "present";
  visitStartedAtMs: number | null;
  hasGreetedThisVisit: boolean;
  hasEmittedCooldownSuppressionThisVisit: boolean;
  lastGreetedAtMs: number | null;
};

export type PresenceStateMachineSettings = {
  dwellMsToGreet: number;
  greetCooldownMs: number;
};

const INITIAL_STATE: PresenceState = {
  state: "noPresence",
  visitStartedAtMs: null,
  hasGreetedThisVisit: false,
  hasEmittedCooldownSuppressionThisVisit: false,
  lastGreetedAtMs: null,
};

export class PresenceStateMachine {
  private state: PresenceState = INITIAL_STATE;
  private readonly settings: PresenceStateMachineSettings;

  constructor(settings: PresenceStateMachineSettings) {
    this.settings = settings;
  }

  getState(): PresenceState {
    return this.state;
  }

  reset(): void {
    this.state = INITIAL_STATE;
  }

  update(params: { stableCount: number; detectedAtMs: number }): PresenceEvent[] {
    const events: PresenceEvent[] = [];
    const stableCount = params.stableCount;
    const detectedAtMs = params.detectedAtMs;

    if (stableCount <= 0) {
      if (this.state.state === "present") {
        events.push({ type: "exit", detectedAtMs, stableCount: 0 });
      }
      this.state = {
        ...this.state,
        state: "noPresence",
        visitStartedAtMs: null,
        hasGreetedThisVisit: false,
        hasEmittedCooldownSuppressionThisVisit: false,
      };
      return events;
    }

    if (this.state.state === "noPresence") {
      this.state = {
        ...this.state,
        state: "present",
        visitStartedAtMs: detectedAtMs,
        hasGreetedThisVisit: false,
        hasEmittedCooldownSuppressionThisVisit: false,
      };
      events.push({ type: "enter", detectedAtMs, stableCount });
      return events;
    }

    // Guard: visit should exist in present state.
    const visitStartedAtMs = this.state.visitStartedAtMs ?? detectedAtMs;
    const visitDurationMs = Math.max(0, detectedAtMs - visitStartedAtMs);

    if (this.state.hasGreetedThisVisit) {
      return events;
    }

    const isDwellReached = visitDurationMs >= this.settings.dwellMsToGreet;
    // Guard: dwell not reached yet -> no event (avoid spamming the debug log).
    if (!isDwellReached) {
      return events;
    }

    const lastGreetedAtMs = this.state.lastGreetedAtMs ?? -Infinity;
    const isInCooldown = detectedAtMs - lastGreetedAtMs < this.settings.greetCooldownMs;
    if (isInCooldown) {
      // Guard: emit suppression at most once per visit (avoid spamming the debug log).
      if (!this.state.hasEmittedCooldownSuppressionThisVisit) {
        this.state = {
          ...this.state,
          hasEmittedCooldownSuppressionThisVisit: true,
        };
        events.push({
          type: "greet-suppressed",
          detectedAtMs,
          stableCount,
          suppressionReason: "cooldown",
          visitDurationMs,
        });
      }
      return events;
    }

    this.state = {
      ...this.state,
      hasGreetedThisVisit: true,
      lastGreetedAtMs: detectedAtMs,
    };
    events.push({ type: "greet", detectedAtMs, stableCount, visitDurationMs });
    return events;
  }
}

