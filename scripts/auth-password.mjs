#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { hash, verify } from "@node-rs/argon2";
import { escapeEnvValueForDotenv } from "./setup-auth.mjs";

const AUTH_HASH_KEY = "OMNIHARNESS_AUTH_PASSWORD_HASH";
const AUTH_PASSWORD_KEY = "OMNIHARNESS_AUTH_PASSWORD";
const ARGON_OPTIONS = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

function normalizeEnvValue(value) {
  let normalized = String(value ?? "").trim();
  if (
    (normalized.startsWith("\"") && normalized.endsWith("\""))
    || (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }
  return normalized.replace(/\\\$/g, "$").replace(/\\\\/g, "\\") || null;
}

function parseAuthLines(envText) {
  const parsed = {
    hash: null,
    password: null,
  };

  for (const line of envText.split(/\r?\n/g)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^(?:export\s+)?(OMNIHARNESS_AUTH_PASSWORD(?:_HASH)?)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    const value = normalizeEnvValue(match[2]);
    if (!value) {
      continue;
    }

    if (match[1] === AUTH_HASH_KEY) {
      parsed.hash = value;
    } else {
      parsed.password = value;
    }
  }

  return parsed;
}

function isActiveAuthLine(line) {
  const trimmed = line.trim();
  return /^(?:export\s+)?OMNIHARNESS_AUTH_PASSWORD(?:_HASH)?\s*=/.test(trimmed) && !trimmed.startsWith("#");
}

export function inspectAuthConfig(envText, env = {}) {
  const envFile = parseAuthLines(envText);
  const processEnv = {
    hash: normalizeEnvValue(env[AUTH_HASH_KEY]),
    password: normalizeEnvValue(env[AUTH_PASSWORD_KEY]),
  };
  const effectiveSource = processEnv.hash || envFile.hash
    ? "hash"
    : processEnv.password || envFile.password
      ? "password"
      : "none";
  const revealablePassword = effectiveSource === "password"
    ? processEnv.password ?? envFile.password
    : null;

  return {
    configured: effectiveSource !== "none",
    effectiveSource,
    revealablePassword,
    envFile,
    processEnv,
  };
}

export function formatAuthStatus(summary) {
  if (!summary.configured) {
    return "OmniHarness auth is not configured. Run `pnpm auth:password set` to create a password.\n";
  }

  if (summary.effectiveSource === "hash") {
    return [
      "OmniHarness auth is configured.",
      "Effective source: OMNIHARNESS_AUTH_PASSWORD_HASH (hash-only; original password cannot be shown).",
      "Run `pnpm auth:password verify` to test a password, or `pnpm auth:password set` to replace it.",
      "",
    ].join("\n");
  }

  return [
    "OmniHarness auth is configured.",
    "Effective source: OMNIHARNESS_AUTH_PASSWORD.",
    `Current password: ${summary.revealablePassword}`,
    "Run `pnpm auth:password set` to replace it with a stored hash.",
    "",
  ].join("\n");
}

export async function updateEnvTextWithPassword(envText, password) {
  if (!String(password ?? "")) {
    throw new Error("Password must not be empty.");
  }

  const passwordHash = await hash(String(password), ARGON_OPTIONS);
  const escapedHash = escapeEnvValueForDotenv(passwordHash);
  const keptText = envText
    .split(/\r?\n/g)
    .filter((line) => !isActiveAuthLine(line))
    .join("\n")
    .replace(/\n+$/g, "");
  const prefix = keptText ? `${keptText}\n\n` : "";

  return {
    envText: `${prefix}# OmniHarness web login password. Managed by pnpm auth:password.\n${AUTH_HASH_KEY}=${escapedHash}\n`,
    passwordHash,
  };
}

export async function verifyPasswordAgainstEnvText(envText, password, env = {}) {
  const summary = inspectAuthConfig(envText, env);
  const configuredHash = summary.processEnv.hash ?? summary.envFile.hash;
  if (configuredHash) {
    return verify(configuredHash, String(password), ARGON_OPTIONS);
  }

  const configuredPassword = summary.processEnv.password ?? summary.envFile.password;
  if (!configuredPassword) {
    return false;
  }

  const left = Buffer.from(configuredPassword, "utf8");
  const right = Buffer.from(String(password), "utf8");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function usage() {
  return [
    "Usage:",
    "  pnpm auth:password status [--env-file .env]",
    "  pnpm auth:password verify [password] [--env-file .env]",
    "  pnpm auth:password set [password] [--env-file .env]",
    "",
    "If password is omitted for `set` or `verify`, the command prompts in a TTY.",
    "",
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    command: "status",
    envFile: path.resolve(".env"),
    password: null,
  };
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--env-file") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("--env-file requires a path.");
      }
      options.envFile = path.resolve(next);
      index += 1;
      continue;
    }
    if (arg === "-h" || arg === "--help") {
      options.command = "help";
      continue;
    }
    positional.push(arg);
  }

  if (positional[0]) {
    options.command = positional[0];
  }
  if (positional[1]) {
    options.password = positional[1];
  }
  if (positional.length > 2) {
    throw new Error("Too many positional arguments.");
  }

  if (options.command === "show") {
    options.command = "status";
  }

  return options;
}

async function promptHidden(message) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Password argument is required when stdin is not a TTY.");
  }

  return new Promise((resolve, reject) => {
    const wasRaw = process.stdin.isRaw;
    let value = "";

    function restoreInput() {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(wasRaw);
      process.stdin.pause();
      process.stdout.write("\n");
    }

    function onData(chunk) {
      const text = String(chunk);
      for (const char of text) {
        if (char === "\u0003") {
          restoreInput();
          reject(new Error("Cancelled."));
          return;
        }
        if (char === "\r" || char === "\n") {
          restoreInput();
          resolve(value);
          return;
        }
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        if (char >= " ") {
          value += char;
        }
      }
    }

    process.stdout.write(message);
    process.stdin.setEncoding("utf8");
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}

function readEnvFile(envFile) {
  try {
    return fs.readFileSync(envFile, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.command === "help") {
    process.stdout.write(usage());
    return;
  }

  const envText = readEnvFile(options.envFile);
  if (options.command === "status") {
    process.stdout.write(formatAuthStatus(inspectAuthConfig(envText, process.env)));
    return;
  }

  if (options.command === "verify") {
    const password = options.password ?? await promptHidden("OmniHarness password to verify: ");
    const valid = await verifyPasswordAgainstEnvText(envText, password, process.env);
    process.stdout.write(valid ? "Password matches OmniHarness auth configuration.\n" : "Password does not match OmniHarness auth configuration.\n");
    process.exitCode = valid ? 0 : 1;
    return;
  }

  if (options.command === "set") {
    const password = options.password ?? await promptHidden("New OmniHarness password: ");
    const result = await updateEnvTextWithPassword(envText, password);
    fs.mkdirSync(path.dirname(options.envFile), { recursive: true });
    fs.writeFileSync(options.envFile, result.envText, { mode: 0o600 });
    fs.chmodSync(options.envFile, 0o600);
    process.stdout.write(`Updated ${options.envFile} with ${AUTH_HASH_KEY}.\n`);
    process.stdout.write("Restart OmniHarness for the new password to take effect.\n");
    return;
  }

  throw new Error(`Unknown command: ${options.command}\n\n${usage()}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`[omniharness] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
