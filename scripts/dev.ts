import { spawn, type ChildProcess } from "node:child_process";
import process from "node:process";
import { resolvePnpmArgs, resolvePnpmCommand } from "./package-manager-command";

const pnpmCommand = resolvePnpmCommand();
const pnpmArgs = (args: readonly string[]) => resolvePnpmArgs(args);
const children = new Set<ChildProcess>();
let stopping = false;

function prefixOutput(child: ChildProcess, label: string) {
  for (const stream of [child.stdout, child.stderr]) {
    stream?.on("data", (chunk) => {
      const lines = String(chunk).split(/\r?\n/);
      for (const line of lines) {
        if (line) {
          process.stdout.write(`[${label}] ${line}\n`);
        }
      }
    });
  }
}

function start(label: string, args: readonly string[]) {
  const child = spawn(pnpmCommand, pnpmArgs(args), {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
  });
  children.add(child);
  prefixOutput(child, label);
  child.once("error", (error) => {
    process.stderr.write(`[${label}] ${error.message}\n`);
    void stopAll(1);
  });
  child.once("exit", (code, signal) => {
    children.delete(child);
    if (!stopping) {
      process.stderr.write(
        `[${label}] exited with ${signal ? `signal ${signal}` : `code ${code ?? "unknown"}`}\n`,
      );
      void stopAll(code && code > 0 ? code : 1);
    }
  });
  return child;
}

async function stopChild(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
      }
    }, 5_000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

async function stopAll(exitCode: number) {
  if (stopping) {
    return;
  }
  stopping = true;
  await Promise.all([...children].map(stopChild));
  process.exit(exitCode);
}

process.once("SIGINT", () => {
  void stopAll(0);
});
process.once("SIGTERM", () => {
  void stopAll(0);
});

start("runner", [
  "run",
  "runner",
  "--no-static",
  "--interface-dev-url",
  "http://127.0.0.1:5173",
]);
start("interface", ["run", "dev:interface"]);
