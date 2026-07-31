import { spawn, type ChildProcess } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";

const repositoryRoot = path.resolve(__dirname, "../..");
const staticDir = path.join(repositoryRoot, "dist", "interface");

function base64Url(value: Buffer) {
  return value.toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function cookieFrom(response: Response) {
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

async function availablePort() {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  const port = address && typeof address === "object" ? address.port : 0;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

export type RunnerHarnessOptions = {
  name: string;
  password: string;
  bypassAuth?: boolean;
};

export class RealRunnerHarness {
  readonly root = fs.mkdtempSync(path.join(os.tmpdir(), "omniharness-multi-runner-"));
  readonly logs: string[] = [];
  readonly errors: string[] = [];
  origin = "";
  identity = "";
  private child: ChildProcess | null = null;
  private port = 0;

  constructor(readonly options: RunnerHarnessOptions) {
    if (!fs.existsSync(path.join(staticDir, "index.html"))) {
      throw new Error("Build dist/interface before starting the multi-runner harness.");
    }
  }

  async start(port = 0) {
    if (this.child) throw new Error("Runner is already started.");
    const bridgePort = await availablePort();
    const child = spawn(process.execPath, [
      "--import",
      "tsx",
      path.join(repositoryRoot, "scripts", "runner.ts"),
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--bridge-url",
      `http://127.0.0.1:${bridgePort}`,
      "--static-dir",
      staticDir,
    ], {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        MOCK_LLM: "true",
        OMNIHARNESS_ROOT: this.root,
        OMNIHARNESS_INSTANCE: this.options.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-"),
        OMNIHARNESS_MANAGE_BRIDGE: "true",
        OMNIHARNESS_AUTH_PASSWORD: this.options.password,
        OMNIHARNESS_TEST_BYPASS_AUTH: this.options.bypassAuth ? "true" : "false",
        OMNIHARNESS_E2E_BYPASS_AUTH: this.options.bypassAuth ? "true" : "false",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    this.child = child;
    child.stderr?.on("data", (chunk: Buffer) => {
      this.errors.push(chunk.toString());
    });
    const ready = await new Promise<{ origin: string }>((resolve, reject) => {
      let pending = "";
      const onData = (chunk: Buffer) => {
        pending += chunk.toString();
        const lines = pending.split(/\r?\n/);
        pending = lines.pop() ?? "";
        for (const line of lines) {
          this.logs.push(line);
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
            // Startup includes human-readable database timing.
          }
        }
      };
      const onExit = (code: number | null) => {
        cleanup();
        reject(new Error(
          `Runner ${this.options.name} exited with ${code}: ${this.errors.join("")}`,
        ));
      };
      const cleanup = () => {
        child.stdout?.off("data", onData);
        child.off("exit", onExit);
      };
      child.stdout?.on("data", onData);
      child.once("exit", onExit);
    });
    this.origin = ready.origin;
    this.port = Number(new URL(this.origin).port);
    const bootstrap = await this.bootstrap();
    this.identity = bootstrap.runner.runnerInstanceId;
    await this.rename(this.options.name);
    return this;
  }

  async bootstrap() {
    const response = await fetch(`${this.origin}/api/runtime/bootstrap`);
    if (!response.ok) {
      throw new Error(`Bootstrap failed with ${response.status}.`);
    }
    return response.json() as Promise<{
      runner: {
        runnerInstanceId: string;
        name: string;
        apiRevision: { minimum: number; current: number };
      };
    }>;
  }

  async loginCookie() {
    const response = await fetch(`${this.origin}/api/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: this.origin,
      },
      body: JSON.stringify({ password: this.options.password }),
    });
    if (!response.ok) {
      throw new Error(`Login failed with ${response.status}.`);
    }
    return cookieFrom(response);
  }

  async rename(name: string) {
    const cookie = await this.loginCookie();
    const response = await fetch(`${this.origin}/api/runner`, {
      method: "PATCH",
      headers: {
        cookie,
        "content-type": "application/json",
        origin: this.origin,
      },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      throw new Error(`Rename failed with ${response.status}.`);
    }
  }

  async issueBrowserToken(interfaceOrigin: string) {
    const verifier = base64Url(randomBytes(32));
    const challenge = base64Url(createHash("sha256").update(verifier).digest());
    const state = base64Url(randomBytes(32));
    const approval = await fetch(
      `${this.origin}/api/auth/browser-authorization/approve`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: this.origin,
        },
        body: JSON.stringify({
          approved: true,
          password: this.options.password,
          origin: interfaceOrigin,
          state,
          challenge,
          method: "S256",
        }),
      },
    );
    if (!approval.ok) {
      throw new Error(`Browser approval failed with ${approval.status}.`);
    }
    const { code } = await approval.json() as { code: string };
    const exchange = await fetch(
      `${this.origin}/api/auth/browser-authorization/exchange`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: interfaceOrigin,
        },
        body: JSON.stringify({
          code,
          verifier,
          state,
          origin: interfaceOrigin,
          clientLabel: "Multi-runner acceptance",
        }),
      },
    );
    if (!exchange.ok) {
      throw new Error(`Browser exchange failed with ${exchange.status}.`);
    }
    return exchange.json() as Promise<{
      token: string;
      sessionId: string;
      expiresAt: string;
    }>;
  }

  async revokeSession(sessionId: string) {
    const cookie = await this.loginCookie();
    const response = await fetch(`${this.origin}/api/auth/session`, {
      method: "DELETE",
      headers: {
        cookie,
        "content-type": "application/json",
        origin: this.origin,
      },
      body: JSON.stringify({ sessionId }),
    });
    if (!response.ok) {
      throw new Error(`Session revoke failed with ${response.status}.`);
    }
  }

  async rekey() {
    const cookie = await this.loginCookie();
    const response = await fetch(`${this.origin}/api/runner/rekey`, {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/json",
        origin: this.origin,
      },
      body: "{}",
    });
    if (!response.ok) {
      throw new Error(`Runner rekey failed with ${response.status}.`);
    }
    return response.json() as Promise<{
      runner: { runnerInstanceId: string };
    }>;
  }

  async stop() {
    const child = this.child;
    if (!child) return;
    this.child = null;
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      await new Promise<void>((resolve) => child.once("exit", () => resolve()));
    }
  }

  async restart() {
    const port = this.port;
    await this.stop();
    await this.start(port);
  }

  async dispose() {
    await this.stop();
    fs.rmSync(this.root, { recursive: true, force: true });
  }

  assertNoSecretLogs() {
    const output = [...this.logs, ...this.errors].join("\n");
    if (output.includes(this.options.password)) {
      throw new Error(`Runner ${this.options.name} leaked its password to logs.`);
    }
  }
}

export async function startRunnerSet(
  names: string[],
  options: { bypassAuth?: boolean } = {},
) {
  const runners: RealRunnerHarness[] = [];
  try {
    for (const [index, name] of names.entries()) {
      const runner = new RealRunnerHarness({
        name,
        password: `runner-${index + 1}-acceptance-password`,
        bypassAuth: options.bypassAuth,
      });
      runners.push(runner);
      await runner.start();
    }
    return runners;
  } catch (error) {
    await Promise.all(runners.map((runner) => runner.dispose()));
    throw error;
  }
}

export async function disposeRunnerSet(runners: RealRunnerHarness[]) {
  for (const runner of runners) {
    runner.assertNoSecretLogs();
  }
  await Promise.all(runners.map((runner) => runner.dispose()));
}
