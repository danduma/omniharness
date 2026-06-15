import { readFile, chmod, readdir, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const userAgent = process.env.npm_config_user_agent || "";
const npmExecPath = process.env.npm_execpath || "";
const args = new Set(process.argv.slice(2));
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const expectedPnpmVersion = String(packageJson.packageManager || "").match(/^pnpm@(.+)$/)?.[1];
const currentPnpmVersion = userAgent.match(/^pnpm\/([^\s]+)/)?.[1] ?? readPnpmExecVersion();
const isPnpm = userAgent ? userAgent.startsWith("pnpm/") : isPnpmExecPath(npmExecPath);
const isCorepackPnpm = /(?:^|[/\\])corepack(?:[/\\]|$)/.test(npmExecPath) || /[/\\]corepack[/\\]v\d+[/\\]pnpm[/\\]/.test(npmExecPath);
const minimumPnpmMajor = Number(process.env.OMNIHARNESS_MIN_PNPM_MAJOR || "9");
const minimumNodeVersion = process.env.OMNIHARNESS_MIN_NODE_VERSION || "22.13.0";
const maximumNodeVersionExclusive = process.env.OMNIHARNESS_MAX_NODE_VERSION_EXCLUSIVE || "26.0.0";

function isPnpmExecPath(execPath) {
  return /(?:^|[/\\])pnpm(?:\.cjs|\.js|\.mjs|\.cmd)?$/.test(execPath);
}

function readPnpmExecVersion() {
  if (!isPnpmExecPath(npmExecPath)) {
    return undefined;
  }

  const corepackPathVersion = npmExecPath.match(/[/\\]corepack[/\\]v\d+[/\\]pnpm[/\\]([^/\\]+)[/\\]/)?.[1];
  if (corepackPathVersion) {
    return corepackPathVersion;
  }

  try {
    const command = /\.(?:c|m)?js$/.test(npmExecPath) ? process.execPath : npmExecPath;
    const commandArgs = command === process.execPath ? [npmExecPath, "--version"] : ["--version"];
    return execFileSync(command, commandArgs, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
}

if (!isPnpm) {
  console.error("This repository is pnpm-only. Please use pnpm.");
  process.exit(1);
}

if (currentPnpmVersion && getMajor(currentPnpmVersion) < minimumPnpmMajor) {
  console.error(`OmniHarness requires pnpm ${minimumPnpmMajor} or newer.`);
  console.error(`Current pnpm: ${currentPnpmVersion}`);
  if (expectedPnpmVersion) {
    console.error(`The launcher can use ${packageJson.packageManager} as a known-good default when Corepack is available.`);
  }
  process.exit(1);
}

if (!currentPnpmVersion && !isCorepackPnpm) {
  console.warn(`OmniHarness could not determine the pnpm version. Continuing because the command is running through pnpm.`);
}

if (!isVersionAtLeast(process.versions.node, minimumNodeVersion) || !isVersionLessThan(process.versions.node, maximumNodeVersionExclusive)) {
  console.error(`OmniHarness requires Node.js >=${minimumNodeVersion} <${maximumNodeVersionExclusive}.`);
  console.error(`Current runtime: ${process.version} at ${process.execPath}`);
  console.error("This repo uses native dependencies, so unsupported Node versions can fail during install or runtime.");
  console.error("Switch to a supported Node version, then run `pnpm rebuild better-sqlite3 @node-rs/argon2 sharp` if node_modules already exists.");
  process.exit(1);
}

if (args.has("--verify-native")) {
  // node-pty ships prebuilt binaries, but pnpm extracts them without the
  // executable bit on the `spawn-helper` shim, so `pty.spawn` fails with
  // "posix_spawnp failed". Repair the perms before loading. See
  // src/server/terminal/terminal-manager.ts.
  await ensureNodePtySpawnHelperExecutable();

  for (const nativeModule of ["better-sqlite3", "node-pty"]) {
    try {
      await import(nativeModule);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to load ${nativeModule} with Node ${process.version} (${process.arch}).`);
      console.error(message);
      console.error(`Run \`pnpm rebuild ${nativeModule}\`, or reinstall dependencies under the current Node version, then retry.`);
      process.exit(1);
    }
  }
}

async function ensureNodePtySpawnHelperExecutable() {
  if (process.platform === "win32") {
    return;
  }
  let packageRoot;
  try {
    const require = createRequire(import.meta.url);
    // node-pty's entry is lib/index.js; walk up to the package root.
    packageRoot = path.dirname(path.dirname(require.resolve("node-pty")));
  } catch {
    return;
  }
  for (const subdir of ["prebuilds", "build/Release"]) {
    const dir = path.join(packageRoot, subdir);
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    // prebuilds nests one level deep (e.g. prebuilds/darwin-arm64/spawn-helper).
    const candidates = [path.join(dir, "spawn-helper")];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        candidates.push(path.join(dir, entry.name, "spawn-helper"));
      }
    }
    for (const helper of candidates) {
      try {
        await stat(helper);
        await chmod(helper, 0o755);
      } catch {
        // Helper absent for this platform/layout; ignore.
      }
    }
  }
}

function getMajor(version) {
  return Number(String(version).replace(/^v/, "").split(".")[0]);
}

function parseVersion(version) {
  return String(version).replace(/^v/, "").split(".").map((part) => Number(part) || 0);
}

function compareVersions(left, right) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] || 0;
    const rightPart = rightParts[index] || 0;
    if (leftPart !== rightPart) {
      return leftPart - rightPart;
    }
  }
  return 0;
}

function isVersionAtLeast(version, minimum) {
  return compareVersions(version, minimum) >= 0;
}

function isVersionLessThan(version, maximum) {
  return compareVersions(version, maximum) < 0;
}
