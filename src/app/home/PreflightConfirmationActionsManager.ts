import { StateManager } from "@/lib/state-manager";

export const PREFLIGHT_CONFIRMATION_ACTIONS_STORAGE_KEY = "omni.preflight-confirmation-actions.handled";

export type PreflightConfirmationActionsState = {
  handledMessageIds: Set<string>;
};

const initialState: PreflightConfirmationActionsState = {
  handledMessageIds: new Set(),
};

function getBrowserStorage() {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return null;
  }
  return window.localStorage;
}

function parseHandledMessageIds(value: string | null) {
  if (!value) {
    return new Set<string>();
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return new Set<string>();
    }
    return new Set(parsed.filter((item): item is string => typeof item === "string" && item.length > 0));
  } catch {
    return new Set<string>();
  }
}

export class PreflightConfirmationActionsManager extends StateManager<PreflightConfirmationActionsState> {
  constructor() {
    super(initialState);
  }

  hydrateFromBrowser() {
    const storage = getBrowserStorage();
    if (!storage) {
      return;
    }
    this.setKey("handledMessageIds", parseHandledMessageIds(storage.getItem(PREFLIGHT_CONFIRMATION_ACTIONS_STORAGE_KEY)));
  }

  rememberMessage(messageId: string) {
    this.setKey("handledMessageIds", (current) => {
      if (current.has(messageId)) {
        return current;
      }
      const next = new Set(current);
      next.add(messageId);
      this.persist(next);
      return next;
    });
  }

  private persist(messageIds: Set<string>) {
    const storage = getBrowserStorage();
    if (!storage) {
      return;
    }
    try {
      storage.setItem(PREFLIGHT_CONFIRMATION_ACTIONS_STORAGE_KEY, JSON.stringify(Array.from(messageIds)));
    } catch {
      // Browser storage can be unavailable or full; the in-memory state still hides the buttons.
    }
  }
}

export const preflightConfirmationActionsManager = new PreflightConfirmationActionsManager();
