export const RUNTIME_RESOURCE_SETTING_KEYS = {
  minMemoryFreePercent: "OMNIHARNESS_MIN_MEMORY_FREE_PERCENT",
  minDiskFreeMb: "OMNIHARNESS_MIN_DISK_FREE_MB",
  estimatedWorkerMemoryMb: "OMNIHARNESS_ESTIMATED_WORKER_MEMORY_MB",
  idleCleanupEnabled: "OMNIHARNESS_RUNTIME_IDLE_CLEANUP_ENABLED",
  idleCleanupAfterMs: "OMNIHARNESS_RUNTIME_IDLE_CLEANUP_AFTER_MS",
} as const;

export type RuntimeResourceSettings = {
  minMemoryFreePercent: number;
  minDiskFreeMb: number;
  estimatedWorkerMemoryMb: number;
  idleCleanupEnabled: boolean;
  idleCleanupAfterMs: number;
};

export const DEFAULT_RUNTIME_RESOURCE_SETTINGS: RuntimeResourceSettings = {
  minMemoryFreePercent: 12,
  minDiskFreeMb: 8192,
  estimatedWorkerMemoryMb: 1536,
  idleCleanupEnabled: true,
  idleCleanupAfterMs: 15 * 60_000,
};

type EnvLike = Record<string, string | undefined>;

function clampInteger(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function readInteger(env: EnvLike, key: string, fallback: number, min: number, max: number) {
  const raw = env[key];
  if (!raw?.trim()) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? clampInteger(parsed, min, max) : fallback;
}

function readBoolean(env: EnvLike, key: string, fallback: boolean) {
  const raw = env[key]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return fallback;
}

export function resolveRuntimeResourceSettings(env: EnvLike): RuntimeResourceSettings {
  return {
    minMemoryFreePercent: readInteger(
      env,
      RUNTIME_RESOURCE_SETTING_KEYS.minMemoryFreePercent,
      DEFAULT_RUNTIME_RESOURCE_SETTINGS.minMemoryFreePercent,
      0,
      80,
    ),
    minDiskFreeMb: readInteger(
      env,
      RUNTIME_RESOURCE_SETTING_KEYS.minDiskFreeMb,
      DEFAULT_RUNTIME_RESOURCE_SETTINGS.minDiskFreeMb,
      0,
      1_048_576,
    ),
    estimatedWorkerMemoryMb: readInteger(
      env,
      RUNTIME_RESOURCE_SETTING_KEYS.estimatedWorkerMemoryMb,
      DEFAULT_RUNTIME_RESOURCE_SETTINGS.estimatedWorkerMemoryMb,
      0,
      131_072,
    ),
    idleCleanupEnabled: readBoolean(
      env,
      RUNTIME_RESOURCE_SETTING_KEYS.idleCleanupEnabled,
      DEFAULT_RUNTIME_RESOURCE_SETTINGS.idleCleanupEnabled,
    ),
    idleCleanupAfterMs: readInteger(
      env,
      RUNTIME_RESOURCE_SETTING_KEYS.idleCleanupAfterMs,
      DEFAULT_RUNTIME_RESOURCE_SETTINGS.idleCleanupAfterMs,
      60_000,
      24 * 60 * 60_000,
    ),
  };
}

export function runtimeResourceSettingsToEnv(settings: RuntimeResourceSettings): Record<string, string> {
  return {
    [RUNTIME_RESOURCE_SETTING_KEYS.minMemoryFreePercent]: String(settings.minMemoryFreePercent),
    [RUNTIME_RESOURCE_SETTING_KEYS.minDiskFreeMb]: String(settings.minDiskFreeMb),
    [RUNTIME_RESOURCE_SETTING_KEYS.estimatedWorkerMemoryMb]: String(settings.estimatedWorkerMemoryMb),
    [RUNTIME_RESOURCE_SETTING_KEYS.idleCleanupEnabled]: String(settings.idleCleanupEnabled),
    [RUNTIME_RESOURCE_SETTING_KEYS.idleCleanupAfterMs]: String(settings.idleCleanupAfterMs),
  };
}
