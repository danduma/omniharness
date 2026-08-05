#!/usr/bin/env node
import fs from "node:fs";
import { resolveRunnerConfig } from "../src/server/runner/config";

const RUNNER_HELP = `Usage: pnpm runner -- [options]

Options:
  --host <address>               API and interface bind address (default: 0.0.0.0)
  --port <0-65535>               API and interface port (default: 3050)
  --bridge-url <url>             Loopback ACP bridge URL (default: http://127.0.0.1:7800)
  --static-dir <directory>       Serve an explicit built interface directory
  --no-static                    Start the API without a production interface
  --interface-dev-url <url>      Proxy interface requests to a Vite development server
  -h, --help                     Show this help
`;

async function main() {
  const rawArgv = process.argv.slice(2);
  const argv = rawArgv[0] === "--" ? rawArgv.slice(1) : rawArgv;
  if (argv.some((arg) => ["--help", "-h"].includes(arg))) {
    process.stdout.write(RUNNER_HELP);
    return;
  }
  const config = resolveRunnerConfig({
    argv,
    cwd: process.cwd(),
    env: process.env,
  });
  if (
    config.staticDirExplicit
    && (!config.staticDir || !fs.existsSync(config.staticDir))
  ) {
    throw new Error(
      `The explicitly configured static directory does not exist: ${config.staticDir}`,
    );
  }

  process.env.OMNIHARNESS_ROOT = config.instanceRoot;
  process.env.OMNIHARNESS_BRIDGE_URL = config.bridgeUrl;
  fs.mkdirSync(config.instanceRoot, { recursive: true });
  const { startRunnerProcess } = await import("../src/server/runner/run");
  const runner = await startRunnerProcess(config);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    event: "runner.ready",
    origin: runner.origin,
    readiness: runner.readiness.getSnapshot(),
  })}\n`);

  let shutdownPromise: Promise<void> | null = null;
  const shutdown = () => {
    if (!shutdownPromise) {
      shutdownPromise = runner.stop();
    }
    return shutdownPromise;
  };
  process.once("SIGINT", () => {
    void shutdown().then(() => process.exit(0));
  });
  process.once("SIGTERM", () => {
    void shutdown().then(() => process.exit(0));
  });
}

main().catch((error) => {
  process.stderr.write(
    `[runner] ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  process.exit(1);
});
