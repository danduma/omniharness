#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const BUILD_REQUIRED_EXIT = 10;

function defaultRun(command, args, root) {
  return spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
}

function packageManagerCommand() {
  if (process.platform === "win32") {
    return { command: "cmd.exe", args: ["/d", "/s", "/c", "pnpm", "build"] };
  }
  return { command: "pnpm", args: ["build"] };
}

export function ensureInterfaceBuild({
  root = process.cwd(),
  run = (command, args) => defaultRun(command, args, root),
} = {}) {
  const stateScript = path.join(root, "scripts", "interface-build-state.mjs");
  const check = run(process.execPath, [stateScript, "--check"]);

  if (check.status === 0) {
    return 0;
  }

  if (check.status !== BUILD_REQUIRED_EXIT) {
    process.stderr.write("[omniharness] Interface build inspection failed; rebuilding to recover.\n");
  }

  const buildCommand = packageManagerCommand();
  const build = run(buildCommand.command, buildCommand.args);
  if (build.status !== 0) {
    return build.status ?? 1;
  }

  const write = run(process.execPath, [stateScript, "--write"]);
  if (write.status !== 0) {
    process.stderr.write("[omniharness] Could not record interface build state; refusing to start without a freshness marker.\n");
    return write.status ?? 1;
  }

  return 0;
}

const entryPoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (entryPoint === import.meta.url) {
  process.exitCode = ensureInterfaceBuild();
}
