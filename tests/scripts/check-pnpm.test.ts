import { spawnSync } from "child_process";
import { describe, expect, it } from "vitest";

function runCheck(extraEnv: NodeJS.ProcessEnv = {}, args: string[] = []) {
  return spawnSync(process.execPath, ["scripts/check-pnpm.mjs", ...args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      npm_config_user_agent: "pnpm/9.6.0 npm/? node/? darwin arm64",
      ...extraEnv,
    },
    encoding: "utf8",
  });
}

describe("check-pnpm.mjs", () => {
  it("accepts pnpm under arm64 Node.js", () => {
    const result = runCheck();

    expect(result.status).toBe(0);
  });

  it("rejects non-pnpm installs", () => {
    const result = runCheck({ npm_config_user_agent: "npm/10.0.0 node/v22 darwin arm64" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("This repository is pnpm-only.");
  });

  it("rejects non-arm64 Node.js runtimes", () => {
    const result = runCheck({ OMNIHARNESS_TEST_PROCESS_ARCH: "x64" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("must run with an arm64 Node.js runtime");
  });

  it("loads better-sqlite3 during native verification", () => {
    const result = runCheck({}, ["--verify-native"]);

    expect(result.status).toBe(0);
  });
});
