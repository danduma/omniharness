export const GIT_AUTO_COMMIT_MILESTONES_SETTING = "GIT_AUTO_COMMIT_MILESTONES";
export const GIT_PUSH_ON_COMMIT_SETTING = "GIT_PUSH_ON_COMMIT";

export type ManualCommitAction = "commit" | "commit-push";

export const MANUAL_COMMIT_CHAT_PROMPT = "Group the modified files from this conversation into logical git commits. Do not run tests. Do not modify files or do anything else. Only inspect the modified files as needed, create commits, and stop.";
export const MANUAL_COMMIT_CHAT_PUSH_PROMPT = "Group the modified files from this conversation into logical git commits, then push the current branch. Do not run tests. Do not modify files or do anything else. Only inspect the modified files as needed, create commits, push, and stop.";

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
