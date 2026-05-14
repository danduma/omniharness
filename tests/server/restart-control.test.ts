import { describe, expect, it } from "vitest";
import {
  authorizeRestartRequest,
  authorizeSessionCookie,
  createRestartController,
  createSessionCookie,
  passwordsMatch,
  resolveRestartControlConfig,
  verifyRestartControlPassword,
} from "@/server/restart-control";
import { hashPasswordForTests } from "@/server/auth/password";

describe("restart control config", () => {
  it("uses remote-safe defaults and lets env override ports", () => {
    const config = resolveRestartControlConfig("/repo", {
      OMNIHARNESS_REMOTE_RESTART_TOKEN: "secret-token",
      OMNIHARNESS_REMOTE_RESTART_PORTS: "3035, 3050,7800",
    });

    expect(config.host).toBe("0.0.0.0");
    expect(config.port).toBe(3099);
    expect(config.token).toBe("secret-token");
    expect(config.managedPorts).toEqual([3035, 3050, 7800]);
    expect(config.pidFile).toBe("/repo/.omniharness/remote-restart.pid.json");
    expect(config.logFile).toBe("/repo/.omniharness/remote-restart.log");
    expect(config.commands.dev).toEqual({ command: "pnpm", args: ["run", "dev"] });
    expect(config.commands.prod).toEqual({ command: "./omniharness", args: [] });
  });
});

describe("restart control auth", () => {
  it("accepts bearer tokens and explicit restart token headers", () => {
    expect(authorizeRestartRequest({ authorization: "Bearer secret" }, "secret")).toBe(true);
    expect(authorizeRestartRequest({ "x-omniharness-restart-token": "secret" }, "secret")).toBe(true);
    expect(authorizeRestartRequest({ authorization: "Bearer wrong" }, "secret")).toBe(false);
  });

  it("checks passwords without accepting empty credentials", () => {
    expect(passwordsMatch("restart-password", "restart-password")).toBe(true);
    expect(passwordsMatch("restart-password", "wrong")).toBe(false);
    expect(passwordsMatch("", "")).toBe(false);
  });

  it("reuses the OmniHarness plaintext password before restart-specific fallback passwords", async () => {
    await expect(verifyRestartControlPassword({
      OMNIHARNESS_AUTH_PASSWORD: "oh-password",
      OMNIHARNESS_REMOTE_RESTART_PASSWORD: "restart-password",
    }, "token-password", "oh-password")).resolves.toBe(true);
    await expect(verifyRestartControlPassword({
      OMNIHARNESS_AUTH_PASSWORD: "oh-password",
      OMNIHARNESS_REMOTE_RESTART_PASSWORD: "restart-password",
    }, "token-password", "restart-password")).resolves.toBe(false);
  });

  it("reuses the OmniHarness hashed password when configured", async () => {
    const hash = await hashPasswordForTests("hashed-oh-password");

    await expect(verifyRestartControlPassword({
      OMNIHARNESS_AUTH_PASSWORD_HASH: hash,
      OMNIHARNESS_AUTH_PASSWORD: "plain-oh-password",
    }, "token-password", "hashed-oh-password")).resolves.toBe(true);
    await expect(verifyRestartControlPassword({
      OMNIHARNESS_AUTH_PASSWORD_HASH: hash,
      OMNIHARNESS_AUTH_PASSWORD: "plain-oh-password",
    }, "token-password", "plain-oh-password")).resolves.toBe(false);
  });

  it("creates signed session cookies for the web interface", () => {
    const cookie = createSessionCookie("session-secret", 1000);

    expect(authorizeSessionCookie(`omniharness_restart=${cookie}`, "session-secret", 1000)).toBe(true);
    expect(authorizeSessionCookie(`omniharness_restart=${cookie}`, "wrong-secret", 1000)).toBe(false);
    expect(authorizeSessionCookie(`omniharness_restart=${cookie}`, "session-secret", 1000 + 24 * 60 * 60 * 1000 + 1)).toBe(false);
  });
});

describe("restart controller", () => {
  it("terminates managed pids before spawning a fresh OmniHarness dev process", async () => {
    const actions: string[] = [];
    const controller = createRestartController({
      config: resolveRestartControlConfig("/repo", {
        OMNIHARNESS_REMOTE_RESTART_TOKEN: "secret-token",
      }),
      system: {
        appendLog: (message) => {
          actions.push(`log:${message}`);
        },
        ensureDir: (dir) => {
          actions.push(`mkdir:${dir}`);
        },
        findListenerPids: async (ports) => {
          actions.push(`find:${ports.join(",")}`);
          return [101, 202];
        },
        isProcessAlive: async (pid) => pid === 777,
        readPidFile: async () => ({ pid: 777, startedAt: 1, command: ["pnpm", "run", "dev"], mode: "dev" }),
        readRecentLog: async () => "",
        removePidFile: async () => {
          actions.push("rm-pid");
        },
        signalProcess: async (pid, signal) => {
          actions.push(`signal:${pid}:${signal}`);
        },
        spawnDetached: async (command, args) => {
          actions.push(`spawn:${command} ${args.join(" ")}`);
          return 888;
        },
        waitForExit: async (pids) => {
          actions.push(`wait:${pids.join(",")}`);
        },
        writePidFile: async (entry) => {
          actions.push(`write:${entry.pid}`);
        },
      },
    });

    const result = await controller.restart("test", "dev");

    expect(result.pid).toBe(888);
    expect(result.mode).toBe("dev");
    expect(actions).toEqual([
      "log:dev restart requested: test",
      "signal:-777:SIGTERM",
      "wait:777",
      "rm-pid",
      "find:3035,3050,7800",
      "signal:101:SIGTERM",
      "signal:202:SIGTERM",
      "wait:101,202",
      "mkdir:/repo/.omniharness",
      "spawn:pnpm run dev",
      "write:888",
      "log:dev start completed: spawned pid 888 (test)",
      "log:dev restart completed: spawned pid 888",
    ]);
  });

  it("can start OmniHarness in production mode", async () => {
    const actions: string[] = [];
    const controller = createRestartController({
      config: resolveRestartControlConfig("/repo", {
        OMNIHARNESS_REMOTE_RESTART_TOKEN: "secret-token",
      }),
      system: {
        appendLog: (message) => {
          actions.push(`log:${message}`);
        },
        ensureDir: (dir) => {
          actions.push(`mkdir:${dir}`);
        },
        findListenerPids: async () => [],
        isProcessAlive: async () => false,
        readPidFile: async () => null,
        readRecentLog: async () => "",
        removePidFile: async () => undefined,
        signalProcess: async () => undefined,
        spawnDetached: async (command, args) => {
          actions.push(`spawn:${command} ${args.join(" ")}`);
          return 999;
        },
        waitForExit: async () => undefined,
        writePidFile: async (entry) => {
          actions.push(`write:${entry.mode}:${entry.pid}`);
        },
      },
    });

    const result = await controller.start("prod", "test");

    expect(result).toMatchObject({ pid: 999, mode: "prod", command: ["./omniharness"] });
    expect(actions).toContain("spawn:./omniharness ");
    expect(actions).toContain("write:prod:999");
  });

  it("can stop the current OmniHarness server without spawning a replacement", async () => {
    const actions: string[] = [];
    const controller = createRestartController({
      config: resolveRestartControlConfig("/repo", {
        OMNIHARNESS_REMOTE_RESTART_TOKEN: "secret-token",
      }),
      system: {
        appendLog: (message) => {
          actions.push(`log:${message}`);
        },
        ensureDir: () => undefined,
        findListenerPids: async () => [202],
        isProcessAlive: async (pid) => pid === 777,
        readPidFile: async () => ({ pid: 777, startedAt: 1, command: ["./omniharness"], mode: "prod" }),
        readRecentLog: async () => "",
        removePidFile: async () => {
          actions.push("rm-pid");
        },
        signalProcess: async (pid, signal) => {
          actions.push(`signal:${pid}:${signal}`);
        },
        spawnDetached: async () => {
          actions.push("spawn");
          return 999;
        },
        waitForExit: async (pids) => {
          actions.push(`wait:${pids.join(",")}`);
        },
        writePidFile: async () => undefined,
      },
    });

    await controller.stop("test");

    expect(actions).toEqual([
      "log:stop requested: test",
      "signal:-777:SIGTERM",
      "wait:777",
      "rm-pid",
      "signal:202:SIGTERM",
      "wait:202",
      "log:stop completed",
    ]);
  });

  it("can restart the current recorded mode", async () => {
    const actions: string[] = [];
    const controller = createRestartController({
      config: resolveRestartControlConfig("/repo", {
        OMNIHARNESS_REMOTE_RESTART_TOKEN: "secret-token",
      }),
      system: {
        appendLog: (message) => {
          actions.push(`log:${message}`);
        },
        ensureDir: () => undefined,
        findListenerPids: async () => [],
        isProcessAlive: async (pid) => pid === 777,
        readPidFile: async () => ({ pid: 777, startedAt: 1, command: ["./omniharness"], mode: "prod" }),
        readRecentLog: async () => "",
        removePidFile: async () => {
          actions.push("rm-pid");
        },
        signalProcess: async (pid, signal) => {
          actions.push(`signal:${pid}:${signal}`);
        },
        spawnDetached: async (command, args) => {
          actions.push(`spawn:${command} ${args.join(" ")}`);
          return 999;
        },
        waitForExit: async () => undefined,
        writePidFile: async (entry) => {
          actions.push(`write:${entry.mode}:${entry.pid}`);
        },
      },
    });

    const result = await controller.restartCurrent("test");

    expect(result.mode).toBe("prod");
    expect(actions).toContain("spawn:./omniharness ");
    expect(actions).toContain("write:prod:999");
  });

  it("reports running status, listener pids, and recent logs", async () => {
    const controller = createRestartController({
      config: resolveRestartControlConfig("/repo", {
        OMNIHARNESS_REMOTE_RESTART_TOKEN: "secret-token",
      }),
      system: {
        appendLog: () => undefined,
        ensureDir: () => undefined,
        findListenerPids: async () => [303, 404],
        isProcessAlive: async (pid) => pid === 888,
        readPidFile: async () => ({ pid: 888, startedAt: 123, command: ["./omniharness"], mode: "prod" }),
        readRecentLog: async () => "line one\nline two",
        removePidFile: async () => undefined,
        signalProcess: async () => undefined,
        spawnDetached: async () => 0,
        waitForExit: async () => undefined,
        writePidFile: async () => undefined,
      },
    });

    await expect(controller.getStatus()).resolves.toMatchObject({
      running: true,
      pid: 888,
      mode: "prod",
      listenerPids: [303, 404],
      recentLog: "line one\nline two",
    });
  });
});
