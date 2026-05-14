import { describe, expect, it, vi } from "vitest";
import {
  PREFLIGHT_CONFIRMATION_ACTIONS_STORAGE_KEY,
  PreflightConfirmationActionsManager,
} from "@/app/home/PreflightConfirmationActionsManager";

function installLocalStorage(initialValue?: string) {
  const values = new Map<string, string>();
  if (initialValue !== undefined) {
    values.set(PREFLIGHT_CONFIRMATION_ACTIONS_STORAGE_KEY, initialValue);
  }
  const localStorage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  };
  vi.stubGlobal("window", { localStorage });
  return localStorage;
}

describe("PreflightConfirmationActionsManager", () => {
  it("hydrates remembered confirmation message choices from browser storage", () => {
    installLocalStorage(JSON.stringify(["message-1"]));
    const manager = new PreflightConfirmationActionsManager();

    manager.hydrateFromBrowser();

    expect(manager.getSnapshot().handledMessageIds.has("message-1")).toBe(true);
  });

  it("remembers handled confirmation messages in browser storage", () => {
    const localStorage = installLocalStorage();
    const manager = new PreflightConfirmationActionsManager();

    manager.rememberMessage("message-2");

    expect(manager.getSnapshot().handledMessageIds.has("message-2")).toBe(true);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      PREFLIGHT_CONFIRMATION_ACTIONS_STORAGE_KEY,
      JSON.stringify(["message-2"]),
    );
  });
});
