import { SUPPORTED_WORKER_TYPES, type SupportedWorkerType } from "@/shared/worker-types";

export const GIT_AUTO_COMMIT_MILESTONES_SETTING = "GIT_AUTO_COMMIT_MILESTONES";
export const GIT_PUSH_ON_COMMIT_SETTING = "GIT_PUSH_ON_COMMIT";
export const GIT_COMMIT_WORKER_TYPE_SETTING = "GIT_COMMIT_WORKER_TYPE";
export const GIT_COMMIT_WORKER_MODEL_SETTING = "GIT_COMMIT_WORKER_MODEL";
export const GIT_COMMIT_WORKER_EFFORT_SETTING = "GIT_COMMIT_WORKER_EFFORT";

export const DEFAULT_COMMIT_WORKER_TYPE: SupportedWorkerType = "codex";
export const DEFAULT_COMMIT_WORKER_MODEL = "gpt-5.6-sol";
export const DEFAULT_COMMIT_WORKER_EFFORT = "medium";
export const COMMIT_WORKER_EFFORTS = ["low", "medium", "high", "extra high", "max"] as const;

const DEFAULT_COMMIT_WORKER_MODELS: Record<SupportedWorkerType, string> = {
  codex: DEFAULT_COMMIT_WORKER_MODEL,
  claude: "claude-sonnet-5",
  gemini: "gemini-3.5-flash",
  opencode: "openai/gpt-5.6-sol",
};

export type CommitWorkerSettings = {
  workerType: SupportedWorkerType;
  model: string;
  effort: typeof COMMIT_WORKER_EFFORTS[number];
};

function settingString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isSupportedWorkerType(value: string): value is SupportedWorkerType {
  return SUPPORTED_WORKER_TYPES.includes(value as SupportedWorkerType);
}

function isSupportedEffort(value: string): value is CommitWorkerSettings["effort"] {
  return (COMMIT_WORKER_EFFORTS as readonly string[]).includes(value);
}

export function normalizeCommitWorkerSettings(values: Record<string, unknown>): CommitWorkerSettings {
  const configuredWorkerType = settingString(values[GIT_COMMIT_WORKER_TYPE_SETTING]).toLowerCase();
  const workerType = isSupportedWorkerType(configuredWorkerType)
    ? configuredWorkerType
    : DEFAULT_COMMIT_WORKER_TYPE;
  const configuredModel = settingString(values[GIT_COMMIT_WORKER_MODEL_SETTING]);
  const configuredEffort = settingString(values[GIT_COMMIT_WORKER_EFFORT_SETTING]).toLowerCase();

  return {
    workerType,
    model: configuredModel || DEFAULT_COMMIT_WORKER_MODELS[workerType],
    effort: isSupportedEffort(configuredEffort) ? configuredEffort : DEFAULT_COMMIT_WORKER_EFFORT,
  };
}

export function validateCommitWorkerSettings(values: Record<string, unknown>) {
  const workerType = settingString(values[GIT_COMMIT_WORKER_TYPE_SETTING]).toLowerCase();
  if (GIT_COMMIT_WORKER_TYPE_SETTING in values && !isSupportedWorkerType(workerType)) {
    throw new Error(`Invalid commit worker type: ${workerType || "empty"}.`);
  }

  const model = settingString(values[GIT_COMMIT_WORKER_MODEL_SETTING]);
  if (GIT_COMMIT_WORKER_MODEL_SETTING in values && !model) {
    throw new Error("Commit worker model must not be empty.");
  }

  const effort = settingString(values[GIT_COMMIT_WORKER_EFFORT_SETTING]).toLowerCase();
  if (GIT_COMMIT_WORKER_EFFORT_SETTING in values && !isSupportedEffort(effort)) {
    throw new Error(`Invalid commit worker effort: ${effort || "empty"}.`);
  }
}

export type ManualCommitAction = "commit" | "commit-push";

export const MANUAL_COMMIT_CHAT_PROMPT = "Commit ONLY the files you touched during this conversation/session. Do not stage or commit any other modified files in the working tree, even if they show up in `git status` — they may be unrelated work. Stage just the paths you changed in this session, group them into logical git commits, and stop. Do not run tests. Do not modify files or do anything else.";
export const MANUAL_COMMIT_CHAT_PUSH_PROMPT = "Commit ONLY the files you touched during this conversation/session, then push the current branch. Do not stage or commit any other modified files in the working tree, even if they show up in `git status` — they may be unrelated work. Stage just the paths you changed in this session, group them into logical git commits, push, and stop. Do not run tests. Do not modify files or do anything else.";

export const MANUAL_COMMIT_PROJECT_PROMPT = "Group all currently modified files into logical git commits. Do not run tests. Do not modify files or do anything else. Only inspect the modified files as needed, create commits, and stop.";
export const MANUAL_COMMIT_PROJECT_PUSH_PROMPT = "Group all currently modified files into logical git commits, then push the current branch. Do not run tests. Do not modify files or do anything else. Only inspect the modified files as needed, create commits, push, and stop.";

export function parseBooleanSetting(value: string | null | undefined, defaultValue = false) {
  if (typeof value !== "string") {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return defaultValue;
  }

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

export function serializeBooleanSetting(value: boolean) {
  return value ? "true" : "false";
}

export function getManualCommitPrompt(action: ManualCommitAction) {
  return action === "commit-push" ? MANUAL_COMMIT_CHAT_PUSH_PROMPT : MANUAL_COMMIT_CHAT_PROMPT;
}

export function getManualProjectCommitPrompt(action: ManualCommitAction) {
  return action === "commit-push" ? MANUAL_COMMIT_PROJECT_PUSH_PROMPT : MANUAL_COMMIT_PROJECT_PROMPT;
}
