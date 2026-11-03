import type { SpawnSyncReturns } from "node:child_process";
import { describe, expect, it } from "vitest";
import { buildStartupCommands, runStartupChecks } from "../../scripts/ensure-startup.mjs";

describe("startup checks", () => {
  it.each([
    ["darwin", "/repo", "/repo/scripts/ensure-interface-build.mjs"],
    ["win32", "C:\\repo", "C:\\repo\\scripts\\ensure-interface-build.mjs"],
  ])("never installs or refreshes agents during %s startup", (platform, root, script) => {
    expect(buildStartupCommands({ root, platform })).toEqual([
      { command: process.execPath, args: [script, "--prefer-existing"] },
    ]);
  });

  it("reaches the local interface check without any package registry operation", () => {
    const calls: string[] = [];
    const status = runStartupChecks({
      root: "/repo",
      platform: "darwin",
      env: {},
      run: (command, args) => {
        calls.push([command, ...args].join(" "));
        return { status: 0 } as SpawnSyncReturns<string>;
      },
    });
    expect(status).toBe(0);
    expect(calls).toEqual([`${process.execPath} /repo/scripts/ensure-interface-build.mjs --prefer-existing`]);
  });

  it("propagates a failed local interface check", () => {
    expect(runStartupChecks({
      root: "/repo",
      run: () => ({ status: 17 }) as SpawnSyncReturns<string>,
    })).toBe(17);
  });
});
