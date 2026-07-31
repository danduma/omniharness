import { describe, expect, it } from "vitest";
import path from "node:path";
import { resolveRunnerConfig } from "@/server/runner/config";

describe("resolveRunnerConfig", () => {
  it("derives isolated database, data, and lock paths from the instance root", () => {
    const config = resolveRunnerConfig({
      argv: ["--port", "0", "--bridge-url", "http://127.0.0.1:17800"],
      cwd: "/repo",
      env: {
        OMNIHARNESS_ROOT: "/tmp/omni-root",
        OMNIHARNESS_INSTANCE: "runner-b",
      },
    });

    expect(config.port).toBe(0);
    expect(config.bridgeUrl).toBe("http://127.0.0.1:17800");
    expect(config.instanceRoot).toBe(
      path.join("/tmp/omni-root", "instances", "runner-b"),
    );
    expect(config.bridgeLockPath).toBe(
      path.join(config.instanceRoot, "bridge.lock.json"),
    );
    expect(config.runnerLockPath).toBe(
      path.join(config.instanceRoot, "runner.lock.json"),
    );
    expect(config.databasePath).toBe(
      path.join(config.instanceRoot, "sqlite.db"),
    );
  });

  it("keeps the existing root layout when no instance name is supplied", () => {
    const config = resolveRunnerConfig({
      argv: [],
      cwd: "/repo",
      env: { OMNIHARNESS_ROOT: "/tmp/omni-root" },
    });

    expect(config.port).toBe(3050);
    expect(config.bridgeUrl).toBe("http://127.0.0.1:7800");
    expect(config.instanceRoot).toBe("/tmp/omni-root");
    expect(config.manageBridge).toBe(true);
    expect(config.staticDir).toBe(path.join("/repo", "dist", "interface"));
    expect(config.staticDirExplicit).toBe(false);
    expect(config.staticDisabled).toBe(false);
  });

  it("rejects unsafe instance names and invalid ports", () => {
    expect(() => resolveRunnerConfig({
      argv: [],
      cwd: "/repo",
      env: { OMNIHARNESS_INSTANCE: "../other" },
    })).toThrow("OMNIHARNESS_INSTANCE");

    expect(() => resolveRunnerConfig({
      argv: ["--port", "70000"],
      cwd: "/repo",
      env: {},
    })).toThrow("--port");
  });

  it("supports explicit static and API-only modes without ambiguous configuration", () => {
    const explicit = resolveRunnerConfig({
      argv: ["--static-dir", "/tmp/interface"],
      cwd: "/repo",
      env: {},
    });
    expect(explicit.staticDir).toBe("/tmp/interface");
    expect(explicit.staticDirExplicit).toBe(true);

    const disabled = resolveRunnerConfig({
      argv: ["--no-static"],
      cwd: "/repo",
      env: {},
    });
    expect(disabled.staticDir).toBeNull();
    expect(disabled.staticDisabled).toBe(true);

    expect(() => resolveRunnerConfig({
      argv: ["--no-static", "--static-dir", "/tmp/interface"],
      cwd: "/repo",
      env: {},
    })).toThrow(/cannot be combined/i);
  });
});
