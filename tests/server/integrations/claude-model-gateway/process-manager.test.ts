import { closeSync } from "node:fs";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { load } from "js-yaml";
import {
  createClaudeModelGatewayProcessManager,
  openGatewayLogFile,
  waitForChildProcessSpawn,
  type ClaudeGatewayProcessSystem,
} from "@/server/integrations/claude-model-gateway/process-manager";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function temporaryHome() {
  const root = await mkdtemp(join(tmpdir(), "omni-gateway-process-"));
  roots.push(root);
  return root;
}

function fakeSystem(actions: string[], overrides: Partial<ClaudeGatewayProcessSystem> = {}): ClaudeGatewayProcessSystem {
  return {
    spawn: async (executable, args, options) => {
      actions.push(`spawn:${executable}:${args.join("|")}:shell=${String(options.shell)}`);
      return { pid: 321 };
    },
    isAlive: async (pid) => pid === 321,
    readCommand: async () => "/managed/cli-proxy-api --config managed-config.yaml",
    readStartedAt: async () => 1_000,
    signal: async (pid, signal) => { actions.push(`signal:${pid}:${signal}`); },
    waitForExit: async (pid) => { actions.push(`wait:${pid}`); },
    ...overrides,
  };
}

describe("managed Claude gateway process", () => {
  test("turns an asynchronous child spawn error into a rejected promise", async () => {
    const child = new EventEmitter();
    const waiting = waitForChildProcessSpawn(child);
    child.emit("error", new Error("executable missing"));
    await expect(waiting).rejects.toThrow(/executable missing/i);
    expect(child.listenerCount("error")).toBe(0);
    expect(child.listenerCount("spawn")).toBe(0);
  });

  test("refuses symlink log targets and truncates oversized owned logs before launch", async () => {
    const homeDir = await temporaryHome();
    const target = join(homeDir, "target.log");
    const link = join(homeDir, "linked.log");
    await writeFile(target, "secret");
    await symlink(target, link);
    expect(() => openGatewayLogFile(link)).toThrow();

    const oversized = join(homeDir, "oversized.log");
    await writeFile(oversized, Buffer.alloc(2 * 1024 * 1024 + 1));
    const descriptor = openGatewayLogFile(oversized);
    closeSync(descriptor);
    expect((await readFile(oversized)).byteLength).toBe(0);
  });

  test("writes a loopback-only config, starts without a shell, and deduplicates concurrent starts", async () => {
    const homeDir = await temporaryHome();
    const actions: string[] = [];
    let readinessChecks = 0;
    const manager = createClaudeModelGatewayProcessManager({
      homeDir,
      system: fakeSystem(actions),
      checkReady: async () => { readinessChecks += 1; },
    });
    const input = {
      executable: "/managed/cli-proxy-api",
      baseUrl: "http://127.0.0.1:8317",
      apiToken: "api-token",
      managementToken: "management-token",
    };

    const [first, second] = await Promise.all([manager.start(input), manager.start(input)]);
    expect(first).toEqual(second);
    expect(actions.filter((action) => action.startsWith("spawn:"))).toHaveLength(1);
    expect(actions[0]).toContain("shell=false");
    expect(readinessChecks).toBe(1);

    const configPath = first.configPath;
    const configText = await readFile(configPath, "utf8");
    const config = load(configText.replace(/^# omniharness-managed: config\n/, "")) as Record<string, unknown>;
    expect(config.host).toBe("127.0.0.1");
    expect(config.port).toBe(8317);
    expect(config["auth-dir"]).toBe(join(homeDir, ".omniharness", "cliproxyapi", "auth"));
    expect(config["api-keys"]).toEqual(["api-token"]);
    expect(config["remote-management"]).toMatchObject({ "allow-remote": false, "secret-key": "management-token" });
    expect(actions[0]).not.toContain("unrelated-secret");
  });

  test("launches the gateway with a minimal environment and cleans up when post-spawn ownership recording fails", async () => {
    const homeDir = await temporaryHome();
    const actions: string[] = [];
    let childEnvironment: Record<string, string | undefined> | null = null;
    const manager = createClaudeModelGatewayProcessManager({
      homeDir,
      system: fakeSystem(actions, {
        spawn: async (_executable, _args, options) => {
          childEnvironment = options.env;
          return { pid: 321 };
        },
        readStartedAt: async () => { throw new Error("start time unavailable"); },
      }),
      checkReady: async () => undefined,
      parentEnv: {
        PATH: "/usr/bin",
        HOME: homeDir,
        TMPDIR: "/tmp",
        LANG: "en_US.UTF-8",
        OPENAI_API_KEY: "unrelated-secret",
        CLAUDE_MODEL_GATEWAY_MANAGEMENT_TOKEN: "management-secret",
      },
    });
    await expect(manager.start({
      executable: "/managed/cli-proxy-api",
      baseUrl: "http://127.0.0.1:8317",
      apiToken: "api-token",
      managementToken: "management-token",
    })).rejects.toThrow(/start time unavailable/i);
    expect(childEnvironment).toEqual({ PATH: "/usr/bin", HOME: homeDir, TMPDIR: "/tmp", LANG: "en_US.UTF-8" });
    expect(actions).toContain("signal:321:SIGTERM");
    expect(actions).toContain("wait:321");
  });

  test("stops only a process whose live command still matches the ownership record", async () => {
    const homeDir = await temporaryHome();
    const actions: string[] = [];
    let recordedCommand = "";
    const system = fakeSystem(actions, {
      spawn: async (executable, args) => {
        recordedCommand = [executable, ...args].join(" ");
        return { pid: 321 };
      },
      readCommand: async () => recordedCommand,
    });
    const manager = createClaudeModelGatewayProcessManager({ homeDir, system, checkReady: async () => undefined });
    await manager.start({
      executable: "/managed/cli-proxy-api",
      baseUrl: "http://127.0.0.1:8317",
      apiToken: "api-token",
      managementToken: "management-token",
    });
    await manager.stop();
    expect(actions).toContain("signal:321:SIGTERM");
    expect(actions).toContain("wait:321");

    const unsafeHome = await temporaryHome();
    const unsafeActions: string[] = [];
    const unsafeManager = createClaudeModelGatewayProcessManager({
      homeDir: unsafeHome,
      system: fakeSystem(unsafeActions, { readCommand: async () => "/tmp/unrelated --config other.yaml" }),
      checkReady: async () => undefined,
    });
    await unsafeManager.start({
      executable: "/managed/cli-proxy-api",
      baseUrl: "http://127.0.0.1:8317",
      apiToken: "api-token",
      managementToken: "management-token",
    });
    await expect(unsafeManager.stop()).rejects.toThrow(/ownership/i);
    expect(unsafeActions.some((action) => action.startsWith("signal:"))).toBe(false);
  });

  test("refuses to own a reused pid or a lookalike config argument", async () => {
    const reusedActions: string[] = [];
    let processStartedAt = 1_000;
    const reusedManager = createClaudeModelGatewayProcessManager({
      homeDir: await temporaryHome(),
      system: fakeSystem(reusedActions, {
        readStartedAt: async () => processStartedAt,
      }),
      checkReady: async () => undefined,
    });
    await reusedManager.start({
      executable: "/managed/cli-proxy-api",
      executableArgs: [],
      baseUrl: "http://127.0.0.1:8317",
      apiToken: "api-token",
      managementToken: "management-token",
    });
    processStartedAt = 9_000;
    await expect(reusedManager.stop()).rejects.toThrow(/ownership/i);
    expect(reusedActions.some((action) => action.startsWith("signal:"))).toBe(false);

    const lookalikeActions: string[] = [];
    const lookalikeManager = createClaudeModelGatewayProcessManager({
      homeDir: await temporaryHome(),
      system: fakeSystem(lookalikeActions, {
        readCommand: async () => "/managed/cli-proxy-api --config managed-config.yaml.backup",
      }),
      checkReady: async () => undefined,
    });
    await lookalikeManager.start({
      executable: "/managed/cli-proxy-api",
      baseUrl: "http://127.0.0.1:8317",
      apiToken: "api-token",
      managementToken: "management-token",
    });
    await expect(lookalikeManager.stop()).rejects.toThrow(/ownership/i);
    expect(lookalikeActions.some((action) => action.startsWith("signal:"))).toBe(false);
  });

  test("external mode never owns or signals a process", async () => {
    const actions: string[] = [];
    const manager = createClaudeModelGatewayProcessManager({
      homeDir: await temporaryHome(),
      system: fakeSystem(actions),
      checkReady: async () => undefined,
      mode: "external",
    });
    await expect(manager.start({
      executable: "/managed/cli-proxy-api",
      baseUrl: "http://127.0.0.1:8317",
      apiToken: "api-token",
      managementToken: "management-token",
    })).rejects.toThrow(/external/i);
    await expect(manager.stop()).resolves.toMatchObject({ stopped: false });
    expect(actions).toEqual([]);
  });
});
