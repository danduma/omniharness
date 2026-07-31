#!/usr/bin/env node
import fs from "node:fs";
import { resolveRunnerConfig } from "../src/server/runner/config";

async function main() {
  const config = resolveRunnerConfig({
    argv: process.argv.slice(2),
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
