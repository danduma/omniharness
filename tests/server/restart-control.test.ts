import { describe, expect, it } from "vitest";
import {
  authorizeRestartRequest,
  authorizeSessionCookie,
  createRestartController,
  createRestartSupervisor,
  createSessionCookie,
  passwordsMatch,
  resolveRestartControlConfig,
  restartCurrentWithEarlyAck,
  verifyRestartControlPassword,
} from "@/server/restart-control";
import { hashPasswordForTests } from "@/server/auth/password";

describe("restart control config", () => {
  it("uses remote-safe defaults and lets env override ports", () => {
    const config = resolveRestartControlConfig("/repo", {
      OMNIHARNESS_REMOTE_RESTART_TOKEN: "secret-token",
      OMNIHARNESS_REMOTE_RESTART_PORTS: "3050, 5173,7800",
    });

    expect(config.host).toBe("0.0.0.0");
    expect(config.port).toBe(3099);
    expect(config.token).toBe("secret-token");
    expect(config.managedPorts).toEqual([3050, 5173, 7800]);
    expect(config.pidFile).toBe("/repo/.omniharness/remote-restart.pid.json");
    expect(config.logFile).toBe("/repo/.omniharness/remote-restart.log");
    expect(config.restoreOnStartup).toBe(false);
    expect(config.commands.dev).toEqual({ command: "pnpm", args: ["run", "dev"] });
    expect(config.commands.prod).toEqual({ command: "pnpm", args: ["run", "start"] });
  });

  it("enables startup restoration only when explicitly configured", () => {
    expect(resolveRestartControlConfig("/repo", {
      OMNIHARNESS_REMOTE_RESTART_RESTORE_ON_STARTUP: "1",
    }).restoreOnStartup).toBe(true);
    expect(resolveRestartControlConfig("/repo", {
      OMNIHARNESS_REMOTE_RESTART_RESTORE_ON_STARTUP: "false",
    }).restoreOnStartup).toBe(false);
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
      "find:3050,5173,7800",
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

    expect(result).toMatchObject({ pid: 999, mode: "prod", command: ["pnpm", "run", "start"] });
    expect(actions).toContain("spawn:pnpm run start");
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
    expect(actions).toContain("spawn:pnpm run start");
    expect(actions).toContain("write:prod:999");
  });

  it("restores the recorded production mode when its old process is gone", async () => {
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
        isProcessAlive: async () => false,
        readPidFile: async () => ({ pid: 777, startedAt: 1, command: ["pnpm", "run", "start"], mode: "prod" }),
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

    await expect(controller.restorePreviousOnStartup()).resolves.toMatchObject({
      status: "restored",
      entry: { pid: 999, mode: "prod" },
    });
    expect(actions).toContain("spawn:pnpm run start");
    expect(actions).toContain("write:prod:999");
    expect(actions).toContain("log:prod startup restore completed: spawned pid 999");
  });

  it("does not duplicate a recorded runner that is still alive", async () => {
    const actions: string[] = [];
    const controller = createRestartController({
      config: resolveRestartControlConfig("/repo", {}),
      system: {
        appendLog: (message) => {
          actions.push(`log:${message}`);
        },
        ensureDir: () => undefined,
        findListenerPids: async () => [],
        isProcessAlive: async (pid) => pid === 777,
        readPidFile: async () => ({ pid: 777, startedAt: 1, command: ["pnpm", "run", "start"], mode: "prod" }),
        readRecentLog: async () => "",
        removePidFile: async () => undefined,
        signalProcess: async () => undefined,
        spawnDetached: async () => {
          actions.push("spawn");
          return 999;
        },
        waitForExit: async () => undefined,
        writePidFile: async () => undefined,
      },
    });

    await expect(controller.restorePreviousOnStartup()).resolves.toEqual({
      status: "skipped",
      reason: "already_running",
    });
    expect(actions).not.toContain("spawn");
    expect(actions).toContain("log:prod startup restore skipped: recorded process 777 is still alive");
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

describe("restart current with early acknowledgement", () => {
  function buildController(actions: string[], options: { failOnSignal?: boolean } = {}) {
    return createRestartController({
      config: resolveRestartControlConfig("/repo", {
        OMNIHARNESS_REMOTE_RESTART_TOKEN: "secret-token",
      }),
      system: {
        appendLog: () => undefined,
        ensureDir: () => undefined,
        findListenerPids: async () => [],
        isProcessAlive: async () => true,
        readPidFile: async () => ({ pid: 777, startedAt: 1, command: ["pnpm", "run", "start"], mode: "prod" }),
        readRecentLog: async () => "",
        removePidFile: async () => undefined,
        signalProcess: async (pid, signal) => {
          if (options.failOnSignal) {
            throw new Error("could not signal the runner");
          }
          actions.push(`signal:${pid}:${signal}`);
        },
        spawnDetached: async () => 888,
        waitForExit: async () => undefined,
        writePidFile: async () => undefined,
      },
    });
  }

  it("acknowledges before stopping the runner that asked for the restart", async () => {
    const actions: string[] = [];
    const controller = buildController(actions);

    const entry = await restartCurrentWithEarlyAck({
      controller,
      reason: "remote request",
      acknowledge: () => actions.push("ack"),
    });

    // The acknowledgement has to come first: once the signal lands, the process
    // that asked for the restart is gone and can no longer be told anything.
    expect(actions[0]).toBe("ack");
    expect(actions).toContain("signal:-777:SIGTERM");
    expect(entry?.pid).toBe(888);
  });

  it("routes a post-acknowledgement failure to onFailure instead of throwing", async () => {
    const actions: string[] = [];
    const failures: unknown[] = [];
    const controller = buildController(actions, { failOnSignal: true });

    const entry = await restartCurrentWithEarlyAck({
      controller,
      acknowledge: () => actions.push("ack"),
      onFailure: (error) => failures.push(error),
    });

    // The caller was already told the job was accepted, so the failure cannot be
    // returned to it — it has to surface somewhere the operator can still see.
    expect(entry).toBeNull();
    expect(actions).toEqual(["ack"]);
    expect(failures).toHaveLength(1);
    expect((failures[0] as Error).message).toBe("could not signal the runner");
  });
});

describe("restart supervision", () => {
  it("recovers a recorded production runner after its detached process disappears", async () => {
    const actions: string[] = [];
    const supervisor = createRestartSupervisor({
      controller: {
        getStatus: async () => ({ running: false, mode: "prod" }),
        restart: async (reason, mode) => {
          actions.push(`restart:${reason}:${mode}`);
          return {
            pid: 888,
            startedAt: 1_000,
            command: ["pnpm", "run", "start"],
            mode,
          };
        },
      },
      appendLog: (message: string) => {
        actions.push(`log:${message}`);
      },
      now: () => 1_000,
    });

    await expect(supervisor.check()).resolves.toMatchObject({
      status: "recovered",
      attempt: 1,
      pid: 888,
      mode: "prod",
    });
    expect(actions).toEqual([
      "log:runner.supervision.restart_attempt mode=prod attempt=1",
      "restart:automatic supervision:prod",
      "log:runner.supervision.restart_succeeded mode=prod attempt=1 pid=888",
    ]);
  });

  it("gives up after bounded consecutive failures instead of restarting forever", async () => {
    const actions: string[] = [];
    const supervisor = createRestartSupervisor({
      controller: {
        getStatus: async () => ({ running: false, mode: "prod" }),
        restart: async () => {
          actions.push("restart");
          throw new Error("spawn failed");
        },
      },
      appendLog: (message: string) => {
        actions.push(`log:${message}`);
      },
      now: () => 1_000,
      maxAttempts: 2,
    });

    await expect(supervisor.check()).resolves.toMatchObject({ status: "failed", attempt: 1 });
    await expect(supervisor.check()).resolves.toMatchObject({ status: "failed", attempt: 2 });
    await expect(supervisor.check()).resolves.toMatchObject({ status: "gave_up", attempts: 2 });
    await expect(supervisor.check()).resolves.toMatchObject({ status: "gave_up", attempts: 2 });

    expect(actions.filter((action) => action === "restart")).toHaveLength(2);
    expect(actions.filter((action) => action.includes("runner.supervision.gave_up"))).toEqual([
      "log:runner.supervision.gave_up mode=prod attempts=2",
    ]);
  });
});
