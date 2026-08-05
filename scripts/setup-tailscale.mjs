#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const MANAGED_START = "# omniharness-tailscale-managed:start";
const MANAGED_END = "# omniharness-tailscale-managed:end";
const OWNED_KEYS = ["OMNIHARNESS_PUBLIC_ORIGIN", "OMNIHARNESS_RUNNER_HOST"];

function readArgs(argv) {
  if (argv[0] === "--") argv = argv.slice(1);
  const options = {
    root: process.cwd(),
    port: Number(process.env.OMNIHARNESS_RUNNER_PORT || process.env.PORT || "3050"),
    dryRun: false,
    force: false,
    reset: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root" || arg === "--port") {
      const value = argv[index + 1];
      if (!value) throw new TypeError(`${arg} requires a value.`);
      if (arg === "--root") options.root = path.resolve(value);
      else options.port = Number(value);
      index += 1;
      continue;
    }
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--reset") options.reset = true;
    else throw new TypeError(`Unknown Tailscale setup option: ${arg}`);
  }
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65_535) {
    throw new TypeError("--port must be an integer from 1 to 65535.");
  }
  return options;
}

function isExecutable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findTailscale() {
  const explicit = process.env.OMNIHARNESS_TAILSCALE_BIN?.trim();
  if (explicit) return isExecutable(explicit) ? explicit : null;
  for (const directory of (process.env.PATH || "").split(path.delimiter)) {
    if (!directory) continue;
    const candidate = path.join(directory, "tailscale");
    if (isExecutable(candidate)) return candidate;
  }
  for (const candidate of [
    "/Applications/Tailscale.app/Contents/MacOS/Tailscale",
    "/Applications/Tailscale.app/Contents/MacOS/tailscale",
  ]) {
    if (isExecutable(candidate)) return candidate;
  }
  return null;
}

function invoke(tailscale, args, options = {}) {
  const result = spawnSync(tailscale, args, { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    const detail = (result.stderr || result.stdout || `exit ${result.status}`).trim();
    throw new Error(`${detail}\nTailscale Serve may require an administrator, a configured operator, and HTTPS enabled for the tailnet.`);
  }
  return result;
}

function readTailnetStatus(tailscale) {
  const result = invoke(tailscale, ["status", "--json"]);
  let status;
  try {
    status = JSON.parse(result.stdout);
  } catch {
    throw new Error("Tailscale returned invalid status JSON.");
  }
  if (status.BackendState !== "Running") {
    throw new Error(`Tailscale is not connected (state: ${status.BackendState || "unknown"}). Run \`tailscale up\`, then retry.`);
  }
  const dnsName = String(status.Self?.DNSName || "").replace(/\.$/, "");
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.ts\.net$/.test(dnsName)) {
    throw new Error("Tailscale status did not provide a valid tailnet DNS name. Ensure MagicDNS and HTTPS are enabled for the tailnet.");
  }
  return { dnsName, origin: `https://${dnsName}` };
}

function removeManagedBlock(text) {
  const start = text.indexOf(MANAGED_START);
  if (start === -1) return text;
  const end = text.indexOf(MANAGED_END, start);
  if (end === -1) throw new Error("The OmniHarness Tailscale block in .env is incomplete; repair it before continuing.");
  let removeStart = start;
  if (removeStart > 0 && text[removeStart - 1] === "\n") removeStart -= 1;
  let removeEnd = end + MANAGED_END.length;
  if (text[removeEnd] === "\r") removeEnd += 1;
  if (text[removeEnd] === "\n") removeEnd += 1;
  return `${text.slice(0, removeStart)}${text.slice(removeEnd)}`;
}

function hasManagedBlock(text) {
  return text.includes(MANAGED_START) && text.includes(MANAGED_END);
}

function activeOwnedSettings(text) {
  const values = new Map();
  for (const line of removeManagedBlock(text).split(/\r?\n/)) {
    if (/^\s*#/.test(line)) continue;
    const match = line.match(/^\s*(OMNIHARNESS_PUBLIC_ORIGIN|OMNIHARNESS_RUNNER_HOST)\s*=\s*(.*)\s*$/);
    if (match) values.set(match[1], match[2]);
  }
  return values;
}

function buildManagedEnv(text, settings, force) {
  const withoutManaged = removeManagedBlock(text);
  const existing = activeOwnedSettings(withoutManaged);
  const conflicts = OWNED_KEYS.filter((key) => {
    const current = existing.get(key);
    return current && current !== settings[key];
  });
  if (conflicts.length > 0 && !force) {
    const details = conflicts.map((key) => `${key}=${existing.get(key)}`).join(", ");
    throw new Error(`Existing remote-access settings would be replaced (${details}). Re-run with --force to preserve them as comments and continue.`);
  }

  const keptLines = [];
  const previousLines = [];
  for (const line of withoutManaged.split(/\r?\n/)) {
    const match = line.match(/^\s*(OMNIHARNESS_PUBLIC_ORIGIN|OMNIHARNESS_RUNNER_HOST)\s*=\s*(.*)\s*$/);
    if (!match) {
      keptLines.push(line);
      continue;
    }
    if (force && match[2] && match[2] !== settings[match[1]]) {
      previousLines.push(`# omniharness-tailscale-previous: ${match[1]}=${match[2]}`);
    }
  }
  while (keptLines.at(-1) === "") keptLines.pop();
  const base = [...keptLines, ...previousLines].join("\n");
  const block = [
    MANAGED_START,
    `OMNIHARNESS_PUBLIC_ORIGIN=${settings.OMNIHARNESS_PUBLIC_ORIGIN}`,
    `OMNIHARNESS_RUNNER_HOST=${settings.OMNIHARNESS_RUNNER_HOST}`,
    MANAGED_END,
  ].join("\n");
  return `${base ? `${base}\n\n` : ""}${block}\n`;
}

function resetManagedEnv(text) {
  return removeManagedBlock(text).replace(/\n{2,}$/g, "\n");
}

async function readEnv(envPath) {
  try {
    return await fsp.readFile(envPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

async function stageEnv(envPath, text) {
  await fsp.mkdir(path.dirname(envPath), { recursive: true });
  const temporaryPath = `${envPath}.omniharness-tailscale.tmp-${process.pid}`;
  await fsp.writeFile(temporaryPath, text, { encoding: "utf8", mode: 0o600 });
  await fsp.chmod(temporaryPath, 0o600);
  return temporaryPath;
}

function collectProxyTargets(value, targets = []) {
  if (!value || typeof value !== "object") return targets;
  for (const [key, child] of Object.entries(value)) {
    if (key === "Proxy" && typeof child === "string") targets.push(child);
    else collectProxyTargets(child, targets);
  }
  return targets;
}

function inspectServeState(tailscale, target) {
  const result = invoke(tailscale, ["serve", "status", "--json"], { allowFailure: true });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || `exit ${result.status}`).trim();
    throw new Error(`Could not inspect existing Tailscale Serve configuration; no settings were changed. ${detail}`);
  }
  if (!result.stdout.trim()) return { kind: "empty" };
  let status;
  try {
    status = JSON.parse(result.stdout);
  } catch {
    throw new Error("Tailscale returned invalid Serve status JSON; no Serve settings were changed.");
  }
  if (status === null || (typeof status === "object" && Object.keys(status).length === 0)) {
    return { kind: "empty" };
  }
  const targets = collectProxyTargets(status);
  if (targets.length === 1 && targets[0] === target) return { kind: "matching" };
  throw new Error("Tailscale already has Serve configuration on this device; OmniHarness will not replace it. Remove or relocate that Serve configuration, then retry.");
}

async function setup(options, tailscale) {
  const { origin } = readTailnetStatus(tailscale);
  const target = `http://127.0.0.1:${options.port}`;
  const envPath = path.join(options.root, ".env");
  const currentEnv = await readEnv(envPath);
  const serveState = inspectServeState(tailscale, target);
  if (serveState.kind === "matching" && !hasManagedBlock(currentEnv)) {
    throw new Error("Tailscale already serves the OmniHarness target, but this repository does not own that listener. Remove it manually before running setup so reset cannot disable someone else's configuration.");
  }
  const nextEnv = buildManagedEnv(currentEnv, {
    OMNIHARNESS_PUBLIC_ORIGIN: origin,
    OMNIHARNESS_RUNNER_HOST: "127.0.0.1",
  }, options.force);

  if (options.dryRun) {
    if (serveState.kind === "matching") {
      process.stdout.write(`[omniharness] Existing managed Serve listener already targets ${target}.\n`);
    } else {
      process.stdout.write(`[omniharness] Would run: tailscale serve --bg ${target}\n`);
    }
    process.stdout.write(`[omniharness] Would configure private origin: ${origin}\n`);
    return;
  }

  const stagedPath = await stageEnv(envPath, nextEnv);
  let configuredServe = false;
  if (serveState.kind === "empty") {
    try {
      invoke(tailscale, ["serve", "--bg", target]);
      configuredServe = true;
    } catch (error) {
      await fsp.rm(stagedPath, { force: true });
      throw error;
    }
  }
  try {
    await fsp.rename(stagedPath, envPath);
  } catch (error) {
    const rollback = configuredServe
      ? invoke(tailscale, ["serve", "--https=443", "off"], { allowFailure: true })
      : { status: 0, stderr: "", stdout: "" };
    await fsp.rm(stagedPath, { force: true });
    const rollbackDetail = rollback.status === 0
      ? (configuredServe ? "The new Serve listener was disabled." : "The existing managed listener was left unchanged.")
      : `Serve rollback also failed: ${(rollback.stderr || rollback.stdout).trim()}`;
    throw new Error(`Tailscale Serve was configured, but .env could not be published. ${rollbackDetail}\n${error instanceof Error ? error.message : String(error)}`);
  }
  process.stdout.write(`[omniharness] Private OmniHarness URL: ${origin}\n`);
  process.stdout.write("[omniharness] Restart ./omniharness so the runner binds to loopback and uses this origin.\n");
}

async function reset(options, tailscale) {
  const envPath = path.join(options.root, ".env");
  const currentEnv = await readEnv(envPath);
  if (!hasManagedBlock(currentEnv)) {
    process.stdout.write("[omniharness] No managed OmniHarness Tailscale setup was found; Serve was left unchanged.\n");
    return;
  }
  const target = `http://127.0.0.1:${options.port}`;
  const serveState = inspectServeState(tailscale, target);
  const nextEnv = resetManagedEnv(currentEnv);
  if (options.dryRun) {
    if (serveState.kind === "matching") {
      process.stdout.write("[omniharness] Would run: tailscale serve --https=443 off\n");
    } else {
      process.stdout.write("[omniharness] No active managed Serve listener needs to be disabled.\n");
    }
    process.stdout.write("[omniharness] Would remove the managed OmniHarness Tailscale settings from .env.\n");
    return;
  }
  const stagedPath = await stageEnv(envPath, nextEnv);
  let disabledServe = false;
  try {
    if (serveState.kind === "matching") {
      invoke(tailscale, ["serve", "--https=443", "off"]);
      disabledServe = true;
    }
    await fsp.rename(stagedPath, envPath);
  } catch (error) {
    await fsp.rm(stagedPath, { force: true });
    if (!disabledServe) throw error;
    const rollback = invoke(tailscale, ["serve", "--bg", target], { allowFailure: true });
    const detail = rollback.status === 0
      ? "The listener was restored."
      : `Listener restore also failed: ${(rollback.stderr || rollback.stdout).trim()}`;
    throw new Error(`The managed .env block could not be removed after disabling Serve. ${detail}\n${error instanceof Error ? error.message : String(error)}`);
  }
  process.stdout.write(`[omniharness] ${disabledServe ? "Disabled the OmniHarness HTTPS Serve listener and removed" : "Removed"} its managed .env settings.\n`);
}

async function main() {
  const options = readArgs(process.argv.slice(2));
  const tailscale = findTailscale();
  if (!tailscale) {
    throw new Error("Tailscale is not installed or its CLI is unavailable. Install the recommended standalone Mac app: https://tailscale.com/download/mac");
  }
  if (options.reset) await reset(options, tailscale);
  else await setup(options, tailscale);
}

main().catch((error) => {
  process.stderr.write(`[omniharness] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
