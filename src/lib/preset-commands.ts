import { SUPPORTED_WORKER_TYPES, type SupportedWorkerType } from "@/shared/worker-types";
import { normalizeReasoningEffort } from "@/shared/reasoning-effort";

/**
 * Project preset commands: named prompts that run as a dedicated project-level
 * conversation on a fixed CLI / account / model / effort, independently of the
 * composer's latest selection. They are listed in the project's "..." menu.
 *
 * The whole list is persisted as one JSON settings value so it moves through
 * the settings draft (and its single Save) like every other setting.
 */
export const PRESET_COMMANDS_SETTING = "PROJECT_PRESET_COMMANDS";

/** Pre-preset settings for the single "project commit agent". Read only to seed the defaults. */
const LEGACY_COMMIT_WORKER_TYPE_SETTING = "GIT_COMMIT_WORKER_TYPE";
const LEGACY_COMMIT_WORKER_MODEL_SETTING = "GIT_COMMIT_WORKER_MODEL";
const LEGACY_COMMIT_WORKER_EFFORT_SETTING = "GIT_COMMIT_WORKER_EFFORT";

export const PRESET_COMMAND_EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type PresetCommandEffort = typeof PRESET_COMMAND_EFFORTS[number];

export const DEFAULT_PRESET_WORKER_TYPE: SupportedWorkerType = "codex";
export const DEFAULT_PRESET_EFFORT: PresetCommandEffort = "medium";
export const DEFAULT_PRESET_WORKER_MODELS: Record<SupportedWorkerType, string> = {
  codex: "gpt-5.6-sol",
  claude: "claude-sonnet-5",
  gemini: "gemini-3.5-flash",
  opencode: "openai/gpt-5.6-sol",
};

export type PresetCommand = {
  id: string;
  name: string;
  prompt: string;
  workerType: SupportedWorkerType;
  /** `null` lets the account pool pick, like "Auto" in the composer. */
  accountId: string | null;
  model: string;
  effort: PresetCommandEffort;
};

const COMMIT_PROJECT_PROMPT = "Group all currently modified files into logical git commits. Do not run tests. Do not modify files or do anything else. Only inspect the modified files as needed, create commits, and stop.";
const COMMIT_PUSH_PROJECT_PROMPT = "Group all currently modified files into logical git commits, then push the current branch. Do not run tests. Do not modify files or do anything else. Only inspect the modified files as needed, create commits, push, and stop.";

function settingString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isSupportedWorkerType(value: string): value is SupportedWorkerType {
  return SUPPORTED_WORKER_TYPES.includes(value as SupportedWorkerType);
}

export function normalizePresetEffort(value: unknown): PresetCommandEffort | null {
  const normalized = normalizeReasoningEffort(typeof value === "string" ? value : null);
  return normalized && (PRESET_COMMAND_EFFORTS as readonly string[]).includes(normalized)
    ? normalized as PresetCommandEffort
    : null;
}

/**
 * The seed list used until the user saves their own. Its worker comes from the
 * legacy project-commit-agent settings so an existing choice carries over.
 * Ids are fixed so the client and the server derive the same list.
 */
export function buildDefaultPresetCommands(values: Record<string, unknown> = {}): PresetCommand[] {
  const legacyWorkerType = settingString(values[LEGACY_COMMIT_WORKER_TYPE_SETTING]).toLowerCase();
  const workerType = isSupportedWorkerType(legacyWorkerType) ? legacyWorkerType : DEFAULT_PRESET_WORKER_TYPE;
  const model = settingString(values[LEGACY_COMMIT_WORKER_MODEL_SETTING]) || DEFAULT_PRESET_WORKER_MODELS[workerType];
  const effort = normalizePresetEffort(values[LEGACY_COMMIT_WORKER_EFFORT_SETTING]) ?? DEFAULT_PRESET_EFFORT;
  const worker = { workerType, accountId: null, model, effort };

  return [
    { id: "commit-project", name: "Commit project", prompt: COMMIT_PROJECT_PROMPT, ...worker },
    { id: "commit-push-project", name: "Commit and push project", prompt: COMMIT_PUSH_PROJECT_PROMPT, ...worker },
  ];
}

function readPresetCommand(value: unknown): PresetCommand | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = settingString(record.id);
  if (!id) return null;
  const configuredWorkerType = settingString(record.workerType).toLowerCase();
  const workerType = isSupportedWorkerType(configuredWorkerType) ? configuredWorkerType : DEFAULT_PRESET_WORKER_TYPE;
  return {
    id,
    // Name and prompt stay untrimmed: the settings editor re-reads this list on
    // every keystroke, and trimming here would eat a space as it is typed.
    name: typeof record.name === "string" ? record.name : "",
    prompt: typeof record.prompt === "string" ? record.prompt : "",
    workerType,
    accountId: settingString(record.accountId) || null,
    model: settingString(record.model) || DEFAULT_PRESET_WORKER_MODELS[workerType],
    effort: normalizePresetEffort(record.effort) ?? DEFAULT_PRESET_EFFORT,
  };
}

/** The preset list stored in settings, or the seed list when none has been saved. */
export function readPresetCommands(values: Record<string, unknown>): PresetCommand[] {
  const raw = values[PRESET_COMMANDS_SETTING];
  if (typeof raw !== "string" || !raw.trim()) {
    return buildDefaultPresetCommands(values);
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return buildDefaultPresetCommands(values);
    return parsed
      .map(readPresetCommand)
      .filter((preset): preset is PresetCommand => preset !== null);
  } catch {
    return buildDefaultPresetCommands(values);
  }
}

export function serializePresetCommands(presets: PresetCommand[]) {
  return JSON.stringify(presets);
}

export function findPresetCommand(values: Record<string, unknown>, presetId: string) {
  return readPresetCommands(values).find((preset) => preset.id === presetId) ?? null;
}

/** Presets that can actually run: the menu hides half-written ones. */
export function isRunnablePresetCommand(preset: PresetCommand) {
  return Boolean(preset.name.trim() && preset.prompt.trim());
}

export function validatePresetCommandsSetting(values: Record<string, unknown>) {
  if (!(PRESET_COMMANDS_SETTING in values)) return;
  const raw = values[PRESET_COMMANDS_SETTING];
  let parsed: unknown;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : null;
  } catch {
    throw new Error("Preset commands must be valid JSON.");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Preset commands must be a list.");
  }

  const ids = new Set<string>();
  parsed.forEach((entry, index) => {
    const record = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const label = settingString(record.name) || `#${index + 1}`;
    const id = settingString(record.id);
    if (!id) throw new Error(`Preset command ${label} is missing an id.`);
    if (ids.has(id)) throw new Error(`Preset command id ${id} is used more than once.`);
    ids.add(id);
    if (!settingString(record.name)) throw new Error(`Preset command #${index + 1} needs a name.`);
    if (!settingString(record.prompt)) throw new Error(`Preset command ${label} needs a prompt.`);
    const workerType = settingString(record.workerType).toLowerCase();
    if (!isSupportedWorkerType(workerType)) {
      throw new Error(`Preset command ${label} has an invalid CLI: ${workerType || "empty"}.`);
    }
    if (!settingString(record.model)) throw new Error(`Preset command ${label} needs a model.`);
    if (!normalizePresetEffort(record.effort)) {
      throw new Error(`Preset command ${label} has an invalid effort: ${settingString(record.effort) || "empty"}.`);
    }
  });
}

export function createPresetCommandId() {
  return `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function addPresetCommand(presets: PresetCommand[]): PresetCommand[] {
  const last = presets[presets.length - 1];
  const workerType = last?.workerType ?? DEFAULT_PRESET_WORKER_TYPE;
  return [...presets, {
    id: createPresetCommandId(),
    name: "",
    prompt: "",
    workerType,
    accountId: last?.accountId ?? null,
    model: last?.model ?? DEFAULT_PRESET_WORKER_MODELS[workerType],
    effort: last?.effort ?? DEFAULT_PRESET_EFFORT,
  }];
}

export function updatePresetCommand(presets: PresetCommand[], id: string, patch: Partial<Omit<PresetCommand, "id">>) {
  return presets.map((preset) => (preset.id === id ? { ...preset, ...patch } : preset));
}

/** Inserts the copy right after its source so it is easy to find and rename. */
export function duplicatePresetCommand(presets: PresetCommand[], id: string) {
  const index = presets.findIndex((preset) => preset.id === id);
  if (index < 0) return presets;
  const source = presets[index];
  const copy = { ...source, id: createPresetCommandId(), name: `${source.name.trim()} 2` };
  return [...presets.slice(0, index + 1), copy, ...presets.slice(index + 1)];
}

export function removePresetCommand(presets: PresetCommand[], id: string) {
  return presets.filter((preset) => preset.id !== id);
}
