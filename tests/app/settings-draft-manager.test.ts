import { describe, expect, it } from "vitest";
import { SettingsDraftManager } from "@/interface/home/SettingsDraftManager";

describe("SettingsDraftManager", () => {
  it("hydrates loaded server values into both baseline and draft", () => {
    const manager = new SettingsDraftManager();

    manager.hydrate({
      SUPERVISOR_LLM_MODEL: "gemini-custom",
      WORKER_DEFAULT_TYPE: "claude",
    });

    const snapshot = manager.getSnapshot();
    expect(snapshot.baseline.SUPERVISOR_LLM_MODEL).toBe("gemini-custom");
    expect(snapshot.draft.SUPERVISOR_LLM_MODEL).toBe("gemini-custom");
    expect(snapshot.baseline.WORKER_DEFAULT_TYPE).toBe("claude");
    expect(snapshot.dirtyKeys.size).toBe(0);
    expect(snapshot.hydrated).toBe(true);
  });

  it("marks edited fields dirty and emits only server-backed changed fields", () => {
    const manager = new SettingsDraftManager();
    manager.hydrate({
      SUPERVISOR_LLM_MODEL: "gemini-custom",
      BUSY_MESSAGE_ACTION: "queue",
    });

    manager.setField("SUPERVISOR_LLM_MODEL", "gemini-next");
    manager.setField("BUSY_MESSAGE_ACTION", "steer");

    expect(manager.getSnapshot().dirtyKeys).toEqual(new Set(["SUPERVISOR_LLM_MODEL", "BUSY_MESSAGE_ACTION"]));
    expect(manager.getSavePayload()).toEqual({
      SUPERVISOR_LLM_MODEL: "gemini-next",
      BUSY_MESSAGE_ACTION: "steer",
    });
  });

  it("removes dirty state when a field returns to baseline", () => {
    const manager = new SettingsDraftManager();
    manager.hydrate({ CREDIT_STRATEGY: "swap_account" });

    manager.setField("CREDIT_STRATEGY", "fallback_api");
    manager.setField("CREDIT_STRATEGY", "swap_account");

    expect(manager.getSnapshot().dirtyKeys.size).toBe(0);
    expect(manager.getSavePayload()).toEqual({});
  });

  it("discards draft changes back to the loaded baseline", () => {
    const manager = new SettingsDraftManager();
    manager.hydrate({
      WORKER_DEFAULT_TYPE: "codex",
      WORKER_YOLO_MODE: "true",
    });

    manager.setField("WORKER_DEFAULT_TYPE", "gemini");
    manager.setField("WORKER_YOLO_MODE", "false");
    manager.discardDraft();

    expect(manager.getSnapshot().draft.WORKER_DEFAULT_TYPE).toBe("codex");
    expect(manager.getSnapshot().draft.WORKER_YOLO_MODE).toBe("true");
    expect(manager.getSnapshot().dirtyKeys.size).toBe(0);
  });

  it("excludes local language and appearance preferences because they never enter the draft", () => {
    const manager = new SettingsDraftManager();
    manager.hydrate({ SUPERVISOR_LLM_MODEL: "gemini-custom" });

    manager.setField("SUPERVISOR_LLM_MODEL", "gemini-next");

    expect(manager.getSavePayload()).toEqual({
      SUPERVISOR_LLM_MODEL: "gemini-next",
    });
    expect(manager.getSavePayload()).not.toHaveProperty("OMNI_LANGUAGE");
    expect(manager.getSavePayload()).not.toHaveProperty("UI_TEXT_SIZE_STORAGE_KEY");
    expect(manager.getSavePayload()).not.toHaveProperty("CONVERSATION_TEXT_SIZE_STORAGE_KEY");
    expect(manager.getSavePayload()).not.toHaveProperty("TERMINAL_TEXT_SIZE_STORAGE_KEY");
  });

  it("refreshes the baseline without erasing dirty fields", () => {
    const manager = new SettingsDraftManager();
    manager.hydrate({ SUPERVISOR_LLM_MODEL: "saved", WORKER_DEFAULT_TYPE: "codex" });
    manager.setField("SUPERVISOR_LLM_MODEL", "typing");

    manager.hydrate({ SUPERVISOR_LLM_MODEL: "saved", WORKER_DEFAULT_TYPE: "claude" });

    expect(manager.getSnapshot().draft).toMatchObject({
      SUPERVISOR_LLM_MODEL: "typing",
      WORKER_DEFAULT_TYPE: "claude",
    });
    expect(manager.getSnapshot().dirtyKeys).toContain("SUPERVISOR_LLM_MODEL");
  });

  it("acknowledges only the values and revisions captured by a save", () => {
    const manager = new SettingsDraftManager();
    manager.hydrate({ SUPERVISOR_LLM_MODEL: "saved" });
    manager.setField("SUPERVISOR_LLM_MODEL", "submitted");
    const operation = manager.beginSave();
    manager.setField("SUPERVISOR_LLM_MODEL", "typed while saving");

    manager.acknowledgeSave(operation);

    expect(manager.getSnapshot().baseline.SUPERVISOR_LLM_MODEL).toBe("submitted");
    expect(manager.getSnapshot().draft.SUPERVISOR_LLM_MODEL).toBe("typed while saving");
    expect(manager.getSnapshot().dirtyKeys).toContain("SUPERVISOR_LLM_MODEL");
  });

  it("clears dirtiness when a later edit equals the value an older save acknowledges", () => {
    const manager = new SettingsDraftManager({ VALUE: "one" });
    manager.hydrate({ VALUE: "one" });
    manager.setField("VALUE", "two");
    const operation = manager.beginSave();
    manager.setField("VALUE", "three");
    manager.setField("VALUE", "two");

    manager.acknowledgeSave(operation);

    expect(manager.getSnapshot().baseline.VALUE).toBe("two");
    expect(manager.getSnapshot().draft.VALUE).toBe("two");
    expect(manager.getSnapshot().dirtyKeys.has("VALUE")).toBe(false);
  });
});
