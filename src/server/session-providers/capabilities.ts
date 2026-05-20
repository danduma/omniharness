import type { ProviderSessionRecord, SessionCapability, SessionType } from "./types";

export const OMNI_CAPABILITIES = [
  "send_input",
  "stop",
  "retry_from_message",
  "edit_message",
  "fork_session",
  "fork_message",
  "queue_input",
  "approve_permission",
  "open_project_file",
  "use_git_workspace",
] as const satisfies readonly SessionCapability[];

export const PROCESS_RUNNING_CAPABILITIES = [
  "send_input",
  "stop",
  "open_project_file",
] as const satisfies readonly SessionCapability[];

export const PROCESS_TERMINAL_CAPABILITIES = [
  "open_project_file",
] as const satisfies readonly SessionCapability[];

export function normalizeSessionType(value: unknown): SessionType {
  return value === "process" ? "process" : "omni";
}

export function isTerminalProcessStatus(status: string | null | undefined) {
  const normalized = (status ?? "").trim().toLowerCase();
  return normalized === "exited"
    || normalized === "done"
    || normalized === "cancelled"
    || normalized === "failed"
    || normalized === "orphaned";
}

export function getDefaultCapabilities(session: ProviderSessionRecord): SessionCapability[] {
  if (session.sessionType === "process") {
    return isTerminalProcessStatus(session.status)
      ? [...PROCESS_TERMINAL_CAPABILITIES]
      : [...PROCESS_RUNNING_CAPABILITIES];
  }
  return [...OMNI_CAPABILITIES];
}

export function hasCapability(capabilities: readonly SessionCapability[], capability: SessionCapability) {
  return capabilities.includes(capability);
}

export function canSendInput(session: ProviderSessionRecord) {
  return hasCapability(getDefaultCapabilities(session), "send_input");
}

export function canStop(session: ProviderSessionRecord) {
  return hasCapability(getDefaultCapabilities(session), "stop");
}

export function canFork(session: ProviderSessionRecord) {
  return hasCapability(getDefaultCapabilities(session), "fork_session")
    || hasCapability(getDefaultCapabilities(session), "fork_message");
}

export function canEditInput(session: ProviderSessionRecord) {
  return hasCapability(getDefaultCapabilities(session), "edit_message");
}

export function supportsQueuedInput(session: ProviderSessionRecord) {
  return hasCapability(getDefaultCapabilities(session), "queue_input");
}
