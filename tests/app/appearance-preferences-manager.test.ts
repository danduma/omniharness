import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AppearancePreferencesManager,
  DIRECT_TEXT_SIZE_STORAGE_KEY,
  TERMINAL_TEXT_SIZE_STORAGE_KEY,
  getDirectTextSizeStyle,
  getTerminalTextSizeStyle,
} from "@/app/home/AppearancePreferencesManager";
import { SettingsDraftManager } from "@/app/home/SettingsDraftManager";

function installLocalStorage() {
  const values = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
  return values;
}

describe("AppearancePreferencesManager", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults direct-control text size to the current visual size", () => {
    const manager = new AppearancePreferencesManager();

    expect(manager.getSnapshot().directTextSize).toBe("default");
    expect(getDirectTextSizeStyle("default")).toMatchObject({
      "--direct-control-message-size": "14px",
      "--direct-control-message-line-height": "24px",
    });
  });

  it("defaults terminal text size to the current terminal zoom default", () => {
    const manager = new AppearancePreferencesManager();

    expect(manager.getSnapshot().terminalTextSize).toBe("default");
    expect(getTerminalTextSizeStyle("default")).toMatchObject({
      "--terminal-message-size": "13px",
      "--terminal-pane-size": "10px",
    });
  });

  it("hydrates and previews browser-local preference changes", () => {
    const storage = installLocalStorage();
    storage.set(DIRECT_TEXT_SIZE_STORAGE_KEY, "large");
    storage.set(TERMINAL_TEXT_SIZE_STORAGE_KEY, "larger");
    const manager = new AppearancePreferencesManager();

    manager.hydrateFromLocalStorage();

    expect(manager.getSnapshot()).toMatchObject({
      directTextSize: "large",
      terminalTextSize: "larger",
      hydrated: true,
    });

    manager.setDirectTextSize("compact");
    manager.setTerminalTextSize("largest");

    expect(manager.getSnapshot()).toMatchObject({
      directTextSize: "compact",
      terminalTextSize: "largest",
    });
    expect(storage.get(DIRECT_TEXT_SIZE_STORAGE_KEY)).toBe("large");
    expect(storage.get(TERMINAL_TEXT_SIZE_STORAGE_KEY)).toBe("larger");
  });

  it("keeps browser-local preference edits as a saveable draft", () => {
    const storage = installLocalStorage();
    storage.set(DIRECT_TEXT_SIZE_STORAGE_KEY, "large");
    storage.set(TERMINAL_TEXT_SIZE_STORAGE_KEY, "larger");
    const manager = new AppearancePreferencesManager();

    manager.hydrateFromLocalStorage();
    manager.setDirectTextSize("compact");
    manager.setTerminalTextSize("largest");

    expect(manager.getSnapshot()).toMatchObject({
      directTextSize: "compact",
      terminalTextSize: "largest",
      savedDirectTextSize: "large",
      savedTerminalTextSize: "larger",
    });
    expect(manager.getSnapshot().dirtyKeys).toEqual(new Set(["directTextSize", "terminalTextSize"]));
    expect(storage.get(DIRECT_TEXT_SIZE_STORAGE_KEY)).toBe("large");
    expect(storage.get(TERMINAL_TEXT_SIZE_STORAGE_KEY)).toBe("larger");

    manager.saveDraft();

    expect(manager.getSnapshot().dirtyKeys).toEqual(new Set());
    expect(storage.get(DIRECT_TEXT_SIZE_STORAGE_KEY)).toBe("compact");
    expect(storage.get(TERMINAL_TEXT_SIZE_STORAGE_KEY)).toBe("largest");
  });

  it("discards browser-local appearance draft edits", () => {
    const storage = installLocalStorage();
    storage.set(DIRECT_TEXT_SIZE_STORAGE_KEY, "large");
    const manager = new AppearancePreferencesManager();

    manager.hydrateFromLocalStorage();
    manager.setDirectTextSize("compact");
    manager.discardDraft();

    expect(manager.getSnapshot()).toMatchObject({
      directTextSize: "large",
      savedDirectTextSize: "large",
    });
    expect(manager.getSnapshot().dirtyKeys).toEqual(new Set());
    expect(storage.get(DIRECT_TEXT_SIZE_STORAGE_KEY)).toBe("large");
  });

  it("excludes appearance preferences from server settings payloads", () => {
    const manager = new AppearancePreferencesManager();
    const settingsDraftManager = new SettingsDraftManager();

    manager.setDirectTextSize("large");
    manager.setTerminalTextSize("large");
    settingsDraftManager.hydrate({ BUSY_MESSAGE_ACTION: "queue" });
    settingsDraftManager.setField("BUSY_MESSAGE_ACTION", "steer");

    expect(settingsDraftManager.getSavePayload()).toEqual({
      BUSY_MESSAGE_ACTION: "steer",
    });
    expect(settingsDraftManager.getSavePayload()).not.toHaveProperty(DIRECT_TEXT_SIZE_STORAGE_KEY);
    expect(settingsDraftManager.getSavePayload()).not.toHaveProperty(TERMINAL_TEXT_SIZE_STORAGE_KEY);
  });
});
