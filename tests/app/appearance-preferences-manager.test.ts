import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AppearancePreferencesManager,
  CONVERSATION_TEXT_SIZE_STORAGE_KEY,
  LEGACY_DIRECT_TEXT_SIZE_STORAGE_KEY,
  TERMINAL_TEXT_SIZE_STORAGE_KEY,
  UI_TEXT_SIZE_STORAGE_KEY,
  getAppearanceTextSizeStyle,
  getConversationTextSizeStyle,
  getTerminalTextSizeStyle,
  getUiTextSizeStyle,
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

  it("defaults UI and supervisor conversation fonts to readable values", () => {
    const manager = new AppearancePreferencesManager();

    expect(manager.getSnapshot()).toMatchObject({
      uiTextSize: "default",
      conversationTextSize: "default",
    });
    expect(getUiTextSizeStyle("default")).toMatchObject({
      "--omni-ui-font-size": "calc(14px + var(--omni-mobile-ui-font-boost, 0px))",
      "--omni-ui-sm-size": "calc(14px + var(--omni-mobile-ui-font-boost, 0px))",
      "--omni-ui-control-xs-size": "calc(26px + var(--omni-mobile-ui-control-boost, 0px))",
      "--omni-ui-icon-sm-size": "calc(15px + var(--omni-mobile-ui-icon-boost, 0px))",
    });
    expect(getConversationTextSizeStyle("default")).toMatchObject({
      "--omni-conversation-font-size": "calc(15px + var(--omni-mobile-conversation-font-boost, 0px))",
      "--omni-conversation-line-height": "calc(25px + var(--omni-mobile-conversation-line-boost, 0px))",
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
    storage.set(UI_TEXT_SIZE_STORAGE_KEY, "small");
    storage.set(CONVERSATION_TEXT_SIZE_STORAGE_KEY, "large");
    storage.set(TERMINAL_TEXT_SIZE_STORAGE_KEY, "huge");
    const manager = new AppearancePreferencesManager();

    manager.hydrateFromLocalStorage();

    expect(manager.getSnapshot()).toMatchObject({
      uiTextSize: "small",
      conversationTextSize: "large",
      terminalTextSize: "huge",
      hydrated: true,
    });

    manager.setUiTextSize("tiny");
    manager.setConversationTextSize("small");
    manager.setTerminalTextSize("large");

    expect(manager.getSnapshot()).toMatchObject({
      uiTextSize: "tiny",
      conversationTextSize: "small",
      terminalTextSize: "large",
    });
    expect(storage.get(UI_TEXT_SIZE_STORAGE_KEY)).toBe("small");
    expect(storage.get(CONVERSATION_TEXT_SIZE_STORAGE_KEY)).toBe("large");
    expect(storage.get(TERMINAL_TEXT_SIZE_STORAGE_KEY)).toBe("huge");
  });

  it("keeps browser-local preference edits as a saveable draft", () => {
    const storage = installLocalStorage();
    storage.set(UI_TEXT_SIZE_STORAGE_KEY, "small");
    storage.set(CONVERSATION_TEXT_SIZE_STORAGE_KEY, "large");
    storage.set(TERMINAL_TEXT_SIZE_STORAGE_KEY, "huge");
    const manager = new AppearancePreferencesManager();

    manager.hydrateFromLocalStorage();
    manager.setUiTextSize("tiny");
    manager.setConversationTextSize("small");
    manager.setTerminalTextSize("large");

    expect(manager.getSnapshot()).toMatchObject({
      uiTextSize: "tiny",
      conversationTextSize: "small",
      terminalTextSize: "large",
      savedUiTextSize: "small",
      savedConversationTextSize: "large",
      savedTerminalTextSize: "huge",
    });
    expect(manager.getSnapshot().dirtyKeys).toEqual(new Set(["uiTextSize", "conversationTextSize", "terminalTextSize"]));
    expect(storage.get(UI_TEXT_SIZE_STORAGE_KEY)).toBe("small");
    expect(storage.get(CONVERSATION_TEXT_SIZE_STORAGE_KEY)).toBe("large");
    expect(storage.get(TERMINAL_TEXT_SIZE_STORAGE_KEY)).toBe("huge");

    manager.saveDraft();

    expect(manager.getSnapshot().dirtyKeys).toEqual(new Set());
    expect(storage.get(UI_TEXT_SIZE_STORAGE_KEY)).toBe("tiny");
    expect(storage.get(CONVERSATION_TEXT_SIZE_STORAGE_KEY)).toBe("small");
    expect(storage.get(TERMINAL_TEXT_SIZE_STORAGE_KEY)).toBe("large");
  });

  it("discards browser-local appearance draft edits", () => {
    const storage = installLocalStorage();
    storage.set(CONVERSATION_TEXT_SIZE_STORAGE_KEY, "large");
    const manager = new AppearancePreferencesManager();

    manager.hydrateFromLocalStorage();
    manager.setConversationTextSize("small");
    manager.discardDraft();

    expect(manager.getSnapshot()).toMatchObject({
      conversationTextSize: "large",
      savedConversationTextSize: "large",
    });
    expect(manager.getSnapshot().dirtyKeys).toEqual(new Set());
    expect(storage.get(CONVERSATION_TEXT_SIZE_STORAGE_KEY)).toBe("large");
  });

  it("migrates the old direct-control text-size value into the conversation font", () => {
    const storage = installLocalStorage();
    storage.set(LEGACY_DIRECT_TEXT_SIZE_STORAGE_KEY, "compact");
    const manager = new AppearancePreferencesManager();

    manager.hydrateFromLocalStorage();

    expect(manager.getSnapshot().conversationTextSize).toBe("small");
  });

  it("excludes appearance preferences from server settings payloads", () => {
    const manager = new AppearancePreferencesManager();
    const settingsDraftManager = new SettingsDraftManager();

    manager.setUiTextSize("large");
    manager.setConversationTextSize("large");
    manager.setTerminalTextSize("large");
    settingsDraftManager.hydrate({ BUSY_MESSAGE_ACTION: "queue" });
    settingsDraftManager.setField("BUSY_MESSAGE_ACTION", "steer");

    expect(settingsDraftManager.getSavePayload()).toEqual({
      BUSY_MESSAGE_ACTION: "steer",
    });
    expect(settingsDraftManager.getSavePayload()).not.toHaveProperty(UI_TEXT_SIZE_STORAGE_KEY);
    expect(settingsDraftManager.getSavePayload()).not.toHaveProperty(CONVERSATION_TEXT_SIZE_STORAGE_KEY);
    expect(settingsDraftManager.getSavePayload()).not.toHaveProperty(TERMINAL_TEXT_SIZE_STORAGE_KEY);
  });

  it("combines app-shell and conversation CSS variables for the app root", () => {
    expect(getAppearanceTextSizeStyle("large", "huge")).toMatchObject({
      "--omni-ui-font-size": "calc(15px + var(--omni-mobile-ui-font-boost, 0px))",
      "--omni-conversation-font-size": "calc(19px + var(--omni-mobile-conversation-font-boost, 0px))",
    });
  });
});
