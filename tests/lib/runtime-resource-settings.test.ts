import { describe, expect, it } from "vitest";
import {
  DEFAULT_RUNTIME_RESOURCE_SETTINGS,
  resolveRuntimeResourceSettings,
  RUNTIME_RESOURCE_SETTING_KEYS,
  runtimeResourceSettingsToEnv,
} from "@/lib/runtime-resource-settings";

describe("runtime resource settings", () => {
  it("uses stable defaults for resource admission and idle cleanup", () => {
    expect(resolveRuntimeResourceSettings({})).toEqual(DEFAULT_RUNTIME_RESOURCE_SETTINGS);
  });

  it("normalizes persisted string values", () => {
    expect(resolveRuntimeResourceSettings({
      [RUNTIME_RESOURCE_SETTING_KEYS.minMemoryFreePercent]: "25",
      [RUNTIME_RESOURCE_SETTING_KEYS.minDiskFreeMb]: "16384",
      [RUNTIME_RESOURCE_SETTING_KEYS.estimatedWorkerMemoryMb]: "2048",
      [RUNTIME_RESOURCE_SETTING_KEYS.idleCleanupEnabled]: "false",
      [RUNTIME_RESOURCE_SETTING_KEYS.idleCleanupAfterMs]: "120000",
    })).toEqual({
      minMemoryFreePercent: 25,
      minDiskFreeMb: 16384,
      estimatedWorkerMemoryMb: 2048,
      idleCleanupEnabled: false,
      idleCleanupAfterMs: 120000,
    });
  });

  it("serializes settings for server persistence", () => {
    expect(runtimeResourceSettingsToEnv({
      minMemoryFreePercent: 18,
      minDiskFreeMb: 4096,
      estimatedWorkerMemoryMb: 1024,
      idleCleanupEnabled: true,
      idleCleanupAfterMs: 300000,
    })).toMatchObject({
      OMNIHARNESS_MIN_MEMORY_FREE_PERCENT: "18",
      OMNIHARNESS_MIN_DISK_FREE_MB: "4096",
      OMNIHARNESS_ESTIMATED_WORKER_MEMORY_MB: "1024",
      OMNIHARNESS_RUNTIME_IDLE_CLEANUP_ENABLED: "true",
      OMNIHARNESS_RUNTIME_IDLE_CLEANUP_AFTER_MS: "300000",
    });
  });
});
