import { describe, expect, it } from "vitest";
import {
  PRESET_COMMANDS_SETTING,
  addPresetCommand,
  buildDefaultPresetCommands,
  duplicatePresetCommand,
  findPresetCommand,
  isRunnablePresetCommand,
  readPresetCommands,
  removePresetCommand,
  serializePresetCommands,
  updatePresetCommand,
  validatePresetCommandsSetting,
  type PresetCommand,
} from "@/lib/preset-commands";

const custom: PresetCommand = {
  id: "release-notes",
  name: "Release notes",
  prompt: "Draft release notes from the commits since the last tag.",
  workerType: "claude",
  accountId: "acct-1",
  model: "custom-model-id",
  effort: "xhigh",
};

describe("preset commands", () => {
  it("seeds commit and commit-and-push presets with stable ids when nothing is saved", () => {
    const presets = readPresetCommands({});
    expect(presets.map((preset) => preset.id)).toEqual(["commit-project", "commit-push-project"]);
    expect(presets.map((preset) => preset.name)).toEqual(["Commit project", "Commit and push project"]);
    expect(presets[0]).toMatchObject({ workerType: "codex", model: "gpt-5.6-sol", effort: "medium", accountId: null });
    expect(presets[1].prompt).toMatch(/push the current branch/);
  });

  it("carries the legacy project commit agent over into the seed presets", () => {
    const presets = buildDefaultPresetCommands({
      GIT_COMMIT_WORKER_TYPE: "claude",
      GIT_COMMIT_WORKER_MODEL: "custom-commit-model",
      GIT_COMMIT_WORKER_EFFORT: "extra high",
    });
    for (const preset of presets) {
      expect(preset).toMatchObject({ workerType: "claude", model: "custom-commit-model", effort: "xhigh" });
    }
  });

  it("round-trips a saved list, including an empty one", () => {
    const values = { [PRESET_COMMANDS_SETTING]: serializePresetCommands([custom]) };
    expect(readPresetCommands(values)).toEqual([custom]);
    expect(findPresetCommand(values, "release-notes")).toEqual(custom);
    expect(findPresetCommand(values, "commit-project")).toBeNull();
    expect(readPresetCommands({ [PRESET_COMMANDS_SETTING]: "[]" })).toEqual([]);
  });

  it("keeps names and prompts untrimmed so typing a space is not swallowed", () => {
    const values = { [PRESET_COMMANDS_SETTING]: serializePresetCommands([{ ...custom, name: "Release " }]) };
    expect(readPresetCommands(values)[0].name).toBe("Release ");
  });

  it("adds, updates, copies after the source, and removes presets", () => {
    const added = addPresetCommand([custom]);
    expect(added).toHaveLength(2);
    expect(added[1]).toMatchObject({ name: "", prompt: "", workerType: "claude", model: "custom-model-id" });
    expect(added[1].id).not.toBe(custom.id);
    expect(isRunnablePresetCommand(added[1])).toBe(false);

    const updated = updatePresetCommand(added, added[1].id, { name: "Lint", prompt: "Run the linter." });
    expect(isRunnablePresetCommand(updated[1])).toBe(true);

    const copied = duplicatePresetCommand(updated, custom.id);
    expect(copied.map((preset) => preset.name)).toEqual(["Release notes", "Release notes 2", "Lint"]);
    expect(new Set(copied.map((preset) => preset.id)).size).toBe(3);

    expect(removePresetCommand(copied, custom.id).map((preset) => preset.name)).toEqual(["Release notes 2", "Lint"]);
  });

  it("validates saved preset lists", () => {
    expect(() => validatePresetCommandsSetting({})).not.toThrow();
    expect(() => validatePresetCommandsSetting({ [PRESET_COMMANDS_SETTING]: serializePresetCommands([custom]) })).not.toThrow();
    expect(() => validatePresetCommandsSetting({ [PRESET_COMMANDS_SETTING]: "{" })).toThrow(/JSON/);
    expect(() => validatePresetCommandsSetting({
      [PRESET_COMMANDS_SETTING]: serializePresetCommands([{ ...custom, name: " " }]),
    })).toThrow(/name/);
    expect(() => validatePresetCommandsSetting({
      [PRESET_COMMANDS_SETTING]: serializePresetCommands([{ ...custom, prompt: "" }]),
    })).toThrow(/prompt/);
    expect(() => validatePresetCommandsSetting({
      [PRESET_COMMANDS_SETTING]: JSON.stringify([{ ...custom, workerType: "not-a-worker" }]),
    })).toThrow(/CLI/);
    expect(() => validatePresetCommandsSetting({
      [PRESET_COMMANDS_SETTING]: JSON.stringify([{ ...custom, effort: "not-an-effort" }]),
    })).toThrow(/effort/);
    expect(() => validatePresetCommandsSetting({
      [PRESET_COMMANDS_SETTING]: serializePresetCommands([custom, custom]),
    })).toThrow(/more than once/);
  });
});
