import { spawnSync } from "child_process";
import { describe, expect, it } from "vitest";

function runCheck(extraEnv: Partial<NodeJS.ProcessEnv> = {}, args: string[] = []) {
  return spawnSync(process.execPath, ["scripts/check-pnpm.mjs", ...args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      npm_config_user_agent: "pnpm/9.6.0 npm/? node/? darwin arm64",
      OMNIHARNESS_MIN_NODE_VERSION: "20.0.0",
      OMNIHARNESS_MAX_NODE_VERSION_EXCLUSIVE: "99.0.0",
      ...extraEnv,
    },
    encoding: "utf8",
  });
}

describe("check-pnpm.mjs", () => {
  it("accepts pnpm under the current Node.js architecture", () => {
    const result = runCheck();

    expect(result.status).toBe(0);
  });

  it("rejects non-pnpm installs", () => {
    const result = runCheck({ npm_config_user_agent: "npm/10.0.0 node/v22 darwin arm64" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("This repository is pnpm-only.");
  });

  it("rejects unsupported pnpm versions", () => {
    const result = runCheck({ npm_config_user_agent: "pnpm/8.15.9 npm/? node/? darwin arm64" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("requires pnpm 9 or newer");
  });

  it("rejects unsupported Node.js versions before native bindings can be rebuilt", () => {
    const currentMajor = Number(process.versions.node.split(".")[0]);
    const result = runCheck({
      OMNIHARNESS_MIN_NODE_VERSION: `${currentMajor + 1}.0.0`,
      OMNIHARNESS_MAX_NODE_VERSION_EXCLUSIVE: `${currentMajor + 2}.0.0`,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("requires Node.js >=");
    expect(result.stderr).toContain("uses native dependencies");
  });

  it("loads better-sqlite3 during native verification", () => {
    const result = runCheck({}, ["--verify-native"]);

    expect(result.status).toBe(0);
  });
});
