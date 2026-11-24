import { normalizeWorkerType, type SupportedWorkerType } from "@/shared/worker-types";

/**
 * Cross-CLI name for "never ask, never block". Each CLI calls it something
 * else (`bypassPermissions`, `agent-full-access`, `yolo`); OmniHarness stores
 * and requests this one name and translates it at the runtime boundary.
 */
export const FULL_ACCESS_PERMISSION_MODE = "full-access";

/**
 * Permission modes the composer offers per CLI, in menu order. Values are the
 * CLI's own ACP session mode ids, except `full-access`, which maps to the
 * CLI's bypass mode (or, for OpenCode, to OmniHarness auto-approving every
 * permission request because OpenCode has no bypass mode of its own).
 */
export const WORKER_PERMISSION_MODES: Record<SupportedWorkerType, readonly string[]> = {
  claude: [FULL_ACCESS_PERMISSION_MODE, "auto", "acceptEdits", "default", "plan"],
  codex: [FULL_ACCESS_PERMISSION_MODE, "agent", "workspace-write", "read-only"],
  gemini: [FULL_ACCESS_PERMISSION_MODE, "autoEdit", "default", "plan"],
  opencode: [FULL_ACCESS_PERMISSION_MODE, "build", "plan"],
};

const NATIVE_FULL_ACCESS_MODE: Record<SupportedWorkerType, string | null> = {
  claude: "bypassPermissions",
  codex: "agent-full-access",
  gemini: "yolo",
  opencode: null,
};

const FULL_ACCESS_ALIASES = new Set([
  FULL_ACCESS_PERMISSION_MODE,
  "danger-full-access",
  "bypassPermissions",
  "agent-full-access",
  "yolo",
]);

function asSupportedWorkerType(type: string | null | undefined): SupportedWorkerType | null {
  if (!type) return null;
  const normalized = normalizeWorkerType(type);
  return normalized in WORKER_PERMISSION_MODES ? normalized as SupportedWorkerType : null;
}

/** True for any CLI's spelling of the bypass mode. */
export function isFullAccessPermissionMode(mode: string | null | undefined) {
  return typeof mode === "string" && FULL_ACCESS_ALIASES.has(mode.trim());
}

/** The OmniHarness id for a mode a CLI reported, so the composer can show it. */
export function canonicalPermissionMode(mode: string | null | undefined) {
  const trimmed = mode?.trim();
  if (!trimmed) return null;
  return isFullAccessPermissionMode(trimmed) ? FULL_ACCESS_PERMISSION_MODE : trimmed;
}

export function permissionModesForWorker(type: string | null | undefined): readonly string[] {
  const supported = asSupportedWorkerType(type);
  return supported ? WORKER_PERMISSION_MODES[supported] : [];
}

export function isPermissionModeForWorker(type: string | null | undefined, mode: string | null | undefined) {
  const canonical = canonicalPermissionMode(mode);
  return canonical !== null && permissionModesForWorker(type).includes(canonical);
}

/**
 * The ACP session mode id to request from a CLI. Returns `null` when the CLI
 * has no native equivalent (OpenCode full-access), in which case the runtime
 * enforces the mode itself and must not call `session/set_mode`.
 */
export function resolveNativeSessionMode(type: string | null | undefined, mode: string | null | undefined) {
  const trimmed = mode?.trim();
  if (!trimmed) return null;
  const supported = asSupportedWorkerType(type);
  if (!supported || !isFullAccessPermissionMode(trimmed)) return trimmed;
  return NATIVE_FULL_ACCESS_MODE[supported];
}
