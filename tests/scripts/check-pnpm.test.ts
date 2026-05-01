import { spawnSync } from "child_process";
import { describe, expect, it } from "vitest";

function runCheck(extraEnv: Partial<NodeJS.ProcessEnv> = {}, args: string[] = []) {
  return spawnSync(process.execPath, ["scripts/check-pnpm.mjs", ...args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      npm_config_user_agent: "pnpm/9.6.0 npm/? node/? darwin arm64",
      OMNIHARNESS_EXPECTED_NODE_MAJOR: process.versions.node.split(".")[0],
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

  it("rejects the wrong Node.js major before native bindings can be rebuilt", () => {
    const currentMajor = Number(process.versions.node.split(".")[0]);
    const result = runCheck({ OMNIHARNESS_EXPECTED_NODE_MAJOR: String(currentMajor + 1) });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("must be installed and run with Node.js");
    expect(result.stderr).toContain("mixing Node major versions corrupts the local install");
  });

  it("loads better-sqlite3 during native verification", () => {
    const result = runCheck({}, ["--verify-native"]);

    expect(result.status).toBe(0);
  });
});
