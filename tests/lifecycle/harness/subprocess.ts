/**
 * Real-restart variant of the lifecycle harness.
 *
 * Spawns `subprocess-runner.ts` as a child process. The child hosts the
 * same in-process HTTP harness, but lives in its own Node runtime, so a
 * SIGTERM truly resets module-level state (named-event ring buffer,
 * in-flight SSE connections, prepared SQL statements). The sqlite file
 * under OMNIHARNESS_ROOT persists across the kill, mirroring real
 * production restart behaviour.
 *
 * Use this for scenarios that need to verify "after the server *really*
 * restarted, what does the client observe?" — the in-process harness
 * can only approximate that with `simulateRestart()`.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export interface SubprocessHandle {
  baseUrl: string;
  port: number;
  omniRoot: string;
  /** Kill the subprocess (SIGTERM by default; SIGKILL when force=true). */
  stop(opts?: { force?: boolean }): Promise<void>;
  /** Kill then respawn against the same OMNIHARNESS_ROOT. */
  restart(opts?: { force?: boolean }): Promise<void>;
}

const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");
const RUNNER_PATH = path.resolve(PROJECT_ROOT, "tests/lifecycle/harness/subprocess-runner.ts");
const TSX_PATH = path.resolve(PROJECT_ROOT, "node_modules/.bin/tsx");

async function spawnRunner(omniRoot: string): Promise<{ child: ChildProcess; port: number }> {
  const child = spawn(TSX_PATH, [RUNNER_PATH], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      OMNIHARNESS_ROOT: omniRoot,
      OMNIHARNESS_TEST_BYPASS_AUTH: "true",
      OMNIHARNESS_E2E_BYPASS_AUTH: "true",
      OMNIHARNESS_LIFECYCLE_SUBPROCESS: "1",
      NODE_ENV: "test",
      MOCK_LLM: "true",
      PORT: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const port = await new Promise<number>((resolve, reject) => {
    let stderrBuf = "";
    const onStdout = (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      const match = text.match(/SUBPROCESS_READY (\d+)/);
      if (match) {
        child.stdout?.off("data", onStdout);
        resolve(Number(match[1]));
      } else if (process.env.OMNI_LIFECYCLE_VERBOSE) {
        process.stdout.write(`[subprocess] ${text}`);
      }
    };
    child.stdout?.on("data", onStdout);
    child.stderr?.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString("utf8");
      if (process.env.OMNI_LIFECYCLE_VERBOSE) {
        process.stderr.write(`[subprocess] ${chunk}`);
      }
    });
    child.once("exit", (code) => {
      reject(new Error(`subprocess exited before ready (code=${code}): ${stderrBuf}`));
    });
    setTimeout(() => reject(new Error(`subprocess did not signal ready in time: ${stderrBuf}`)), 30_000);
  });

  return { child, port };
}

async function killProcess(child: ChildProcess, force: boolean): Promise<void> {
  if (child.exitCode != null) return;
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    child.once("exit", finish);
    child.kill(force ? "SIGKILL" : "SIGTERM");
    setTimeout(() => {
      if (!settled && child.exitCode == null) {
        try {
          child.kill("SIGKILL");
        } catch {
          // already gone
        }
      }
    }, 3_000);
  });
}

export async function startSubprocessHarness(opts: { omniRoot?: string } = {}): Promise<SubprocessHandle> {
  const omniRoot = opts.omniRoot ?? mkdtempSync(path.join(tmpdir(), "omni-lifecycle-sub-"));
  let { child, port } = await spawnRunner(omniRoot);
  let baseUrl = `http://127.0.0.1:${port}`;

  return {
    get baseUrl() {
      return baseUrl;
    },
    get port() {
      return port;
    },
    omniRoot,
    async stop(stopOpts = {}) {
      await killProcess(child, stopOpts.force === true);
      try {
        rmSync(omniRoot, { recursive: true, force: true });
      } catch {
        // best-effort
      }
    },
    async restart(restartOpts = {}) {
      await killProcess(child, restartOpts.force === true);
      const next = await spawnRunner(omniRoot);
      child = next.child;
      port = next.port;
      baseUrl = `http://127.0.0.1:${port}`;
    },
  };
}
