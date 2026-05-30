import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

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
  try {
    await import("better-sqlite3");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to load better-sqlite3 with Node ${process.version} (${process.arch}).`);
    console.error(message);
    console.error("Run `pnpm rebuild better-sqlite3`, or reinstall dependencies under the current Node version, then retry.");
    process.exit(1);
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
