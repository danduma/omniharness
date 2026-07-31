import { afterEach, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const repositoryRoot = path.resolve(__dirname, "../../..");
const processes: ChildProcess[] = [];
const tempRoots: string[] = [];

function createRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omni-runner-process-"));
  tempRoots.push(root);
  return root;
}

function spawnRunner(root: string, args: string[]) {
  const child = spawn(process.execPath, [
    "--import",
    "tsx",
    path.join(repositoryRoot, "scripts", "runner.ts"),
    ...args,
  ], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      OMNIHARNESS_ROOT: root,
      OMNIHARNESS_INSTANCE: "test",
      OMNIHARNESS_MANAGE_BRIDGE: "false",
      OMNIHARNESS_AUTH_PASSWORD: "runner-process-test-password",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  processes.push(child);
  return child;
}

function waitForReady(child: ChildProcess) {
  return new Promise<{ origin: string }>((resolve, reject) => {
    let output = "";
    const onData = (chunk: Buffer) => {
      output += chunk.toString();
      for (const line of output.split(/\r?\n/)) {
        try {
          const parsed = JSON.parse(line) as {
            event?: string;
            origin?: string;
          };
          if (parsed.event === "runner.ready" && parsed.origin) {
            cleanup();
            resolve({ origin: parsed.origin });
          }
        } catch {
          // Startup also prints the database timing line.
        }
      }
    };
    const onExit = (code: number | null) => {
      cleanup();
      reject(new Error(`Runner exited before ready with code ${code}: ${output}`));
    };
    const cleanup = () => {
      child.stdout?.off("data", onData);
      child.off("exit", onExit);
    };
    child.stdout?.on("data", onData);
    child.once("exit", onExit);
  });
}

function waitForExit(child: ChildProcess) {
  return new Promise<{ code: number | null; stderr: string }>((resolve) => {
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.once("exit", (code) => resolve({ code, stderr }));
  });
}

afterEach(async () => {
  await Promise.all(processes.splice(0).map(async (child) => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("exit", resolve));
    }
  }));
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("runner process", () => {
  it("serves API and bootstrap while the bridge is unavailable", async () => {
    const root = createRoot();
    const child = spawnRunner(root, [
      "--port",
      "0",
      "--host",
      "127.0.0.1",
      "--bridge-url",
      "http://127.0.0.1:9",
    ]);
    const { origin } = await waitForReady(child);

    const session = await fetch(`${origin}/api/auth/session`);
    const bootstrap = await fetch(`${origin}/api/runtime/bootstrap`);
    const interfaceResponse = await fetch(`${origin}/session/abcdef123456`);

    expect(session.status).toBe(200);
    expect(bootstrap.status).toBe(200);
    const firstBootstrap = await bootstrap.json() as {
      initialLastEventId: string;
      runner: {
        runnerInstanceId: string;
        bridgeState: string;
        readinessState: string;
      };
    };
    expect(firstBootstrap.initialLastEventId).toMatch(/^[^:]+:\d+$/);
    expect(firstBootstrap.runner).toMatchObject({
      bridgeState: "degraded",
      readinessState: "degraded",
    });
    expect(interfaceResponse.status).toBe(200);
    expect(interfaceResponse.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    const interfaceHtml = await interfaceResponse.text();
    expect(interfaceHtml).toContain('id="root"');
    expect(interfaceHtml).toContain('id="omni-bootstrap"');
    expect(interfaceHtml).toContain('"selectedRunId":"abcdef123456"');

    child.kill("SIGTERM");
    await waitForExit(child);
    expect(
      fs.existsSync(path.join(root, "instances", "test", "runner.lock.json")),
    ).toBe(false);

    const restarted = spawnRunner(root, [
      "--port",
      "0",
      "--host",
      "127.0.0.1",
      "--bridge-url",
      "http://127.0.0.1:9",
    ]);
    const restartedReady = await waitForReady(restarted);
    const restartedBootstrap = await fetch(
      `${restartedReady.origin}/api/runtime/bootstrap`,
    );
    const secondBootstrap = await restartedBootstrap.json() as {
      runner: { runnerInstanceId: string };
    };
    expect(secondBootstrap.runner.runnerInstanceId).toBe(
      firstBootstrap.runner.runnerInstanceId,
    );
  });

  it("fails fast on a bind conflict and removes its runner lock", async () => {
    const root = createRoot();
    const blocker = http.createServer();
    await new Promise<void>((resolve) => {
      blocker.listen(0, "127.0.0.1", resolve);
    });
    const address = blocker.address();
    const port = address && typeof address === "object" ? address.port : 0;
    const child = spawnRunner(root, [
      "--port",
      String(port),
      "--host",
      "127.0.0.1",
      "--bridge-url",
      "http://127.0.0.1:9",
    ]);

    const result = await waitForExit(child);
    blocker.closeAllConnections();
    await new Promise<void>((resolve) => blocker.close(() => resolve()));

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("EADDRINUSE");
    expect(
      fs.existsSync(path.join(root, "instances", "test", "runner.lock.json")),
    ).toBe(false);
  });

  it("fails before boot when an explicit static directory is missing", async () => {
    const root = createRoot();
    const child = spawnRunner(root, [
      "--port",
      "0",
      "--static-dir",
      path.join(root, "missing"),
    ]);

    const result = await waitForExit(child);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("static directory does not exist");
  });
});
