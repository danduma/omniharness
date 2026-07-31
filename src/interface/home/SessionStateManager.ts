"use client";

import { StateManager } from "@/lib/state-manager";
import type { EventStreamState, SessionCapability, SessionRecord } from "./types";

export type SessionState = {
  selectedRunId: string | null;
  sessionsByRunId: Record<string, SessionRecord>;
};

const initialState: SessionState = {
  selectedRunId: null,
  sessionsByRunId: {},
};

export class SessionStateManager extends StateManager<SessionState> {
  constructor() {
    super(initialState);
  }

  ingestSnapshot(state: EventStreamState, selectedRunId: string | null) {
    const sessionsByRunId = Object.fromEntries((state.sessions ?? []).map((session) => [session.runId, session]));
    this.update((current) => {
      if (current.selectedRunId === selectedRunId && shallowSessionMapEqual(current.sessionsByRunId, sessionsByRunId)) {
        return current;
      }
      return { selectedRunId, sessionsByRunId };
    });
  }

  getSelectedSession() {
    const snapshot = this.getSnapshot();
    return snapshot.selectedRunId ? snapshot.sessionsByRunId[snapshot.selectedRunId] ?? null : null;
  }

  hasCapability(capability: SessionCapability) {
    return this.getSelectedSession()?.capabilities.includes(capability) ?? false;
  }
}

function shallowSessionMapEqual(left: Record<string, SessionRecord>, right: Record<string, SessionRecord>) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((key) => left[key] === right[key]);
}

export const sessionStateManager = new SessionStateManager();
