import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  truncateSync,
  utimesSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it } from "vitest";
import { RUNTIME_RESOURCE_SETTING_KEYS } from "@/lib/runtime-resource-settings";
import { AgentRuntimeManager } from "@/server/agent-runtime/manager";
import { __resetNamedEventsForTests } from "@/server/events/named-events";

const tempDirs: string[] = [];

function createSparseArchive(directory: string, name: string, bytes: number, modifiedAt: number) {
  const filePath = join(directory, name);
  writeFileSync(filePath, "");
  truncateSync(filePath, bytes);
  const timestamp = new Date(modifiedAt);
  utimesSync(filePath, timestamp, timestamp);
  return filePath;
}

afterEach(() => {
  __resetNamedEventsForTests();
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("AgentRuntimeManager output retention", () => {
  it("applies a saved output limit immediately", () => {
    const dataDir = mkdtempSync(join(tmpdir(), "omni-output-retention-manager-"));
    tempDirs.push(dataDir);
    const directory = join(dataDir, "agent-runtime-output");
    mkdirSync(directory);
    const oldest = createSparseArchive(directory, "old-worker.jsonl", 700 * 1024 * 1024, 1_000);
    const newest = createSparseArchive(directory, "new-worker.jsonl", 700 * 1024 * 1024, 2_000);
    const manager = new AgentRuntimeManager({
      env: {
        ...process.env,
        OMNIHARNESS_RESOURCE_PRESSURE: "0",
        OMNIHARNESS_RUNTIME_DATA_DIR: dataDir,
        OMNIHARNESS_RUNTIME_SWEEP_INTERVAL_MS: "600000",
      },
    });

    try {
      manager.applyRuntimeSettings({
        [RUNTIME_RESOURCE_SETTING_KEYS.outputLogMaxMb]: "1024",
      });

      expect(existsSync(oldest)).toBe(false);
      expect(existsSync(newest)).toBe(true);
    } finally {
      manager.shutdownPools();
    }
  });
});
