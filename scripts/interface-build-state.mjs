#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const MARKER_VERSION = 1;
const BUILD_REQUIRED_EXIT = 10;
const INPUT_PATHS = [
  "package.json",
  "pnpm-lock.yaml",
  "tsconfig.json",
  "tsconfig.interface.json",
  "tsconfig.shared.json",
  "apps/interface",
  "shared/locales",
  "src/components",
  "src/interface",
  "src/lib",
  "src/runtime-api",
  "src/shared",
  "src/ui",
];
const IGNORED_DIRECTORY_NAMES = new Set([".git", ".vite", "dist", "node_modules"]);

function readArgs(argv) {
  let mode = null;
  let root = process.cwd();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check" || arg === "--write") {
      if (mode) throw new TypeError("Use exactly one of --check or --write.");
      mode = arg;
      continue;
    }
    if (arg === "--root") {
      const value = argv[index + 1];
      if (!value) throw new TypeError("--root requires a directory.");
      root = path.resolve(value);
      index += 1;
      continue;
    }
    throw new TypeError(`Unknown interface build-state option: ${arg}`);
  }
  if (!mode) throw new TypeError("Use --check or --write.");
  return { mode, root };
}

async function collectFiles(root, relativePath) {
  const absolutePath = path.join(root, relativePath);
  let stat;
  try {
    stat = await fs.lstat(absolutePath);
  } catch (error) {
    if (error && error.code === "ENOENT") return [];
    throw error;
  }
  if (stat.isSymbolicLink()) return [{ relativePath, kind: "symlink" }];
  if (stat.isFile()) return [{ relativePath, kind: "file" }];
  if (!stat.isDirectory()) return [];

  const entries = await fs.readdir(absolutePath, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name === ".DS_Store" || IGNORED_DIRECTORY_NAMES.has(entry.name)) continue;
    files.push(...await collectFiles(root, path.join(relativePath, entry.name)));
  }
  return files;
}

async function fingerprintInputs(root) {
  const hash = createHash("sha256");
  const files = [];
  for (const inputPath of INPUT_PATHS) {
    files.push(...await collectFiles(root, inputPath));
  }
  files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  if (files.length === 0) throw new Error("No interface build inputs were found.");
  for (const { relativePath, kind } of files) {
    hash.update(relativePath.split(path.sep).join("/"));
    hash.update("\0");
    if (kind === "symlink") {
      hash.update("symlink\0");
      hash.update(await fs.readlink(path.join(root, relativePath)));
    } else {
      hash.update(await fs.readFile(path.join(root, relativePath)));
    }
    hash.update("\0");
  }
  return hash.digest("hex");
}

async function validateOutput(root) {
  const outputDir = path.join(root, "dist", "interface");
  const indexPath = path.join(outputDir, "index.html");
  let html;
  try {
    html = await fs.readFile(indexPath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { ok: false, reason: "production interface is missing" };
    }
    throw error;
  }

  const references = [...html.matchAll(/(?:src|href)=["']\/?(assets\/[^"'#?]+)["']/g)]
    .map((match) => match[1]);
  if (references.length === 0) {
    return { ok: false, reason: "production interface has no referenced assets" };
  }
  for (const reference of references) {
    try {
      const stat = await fs.stat(path.join(outputDir, reference));
      if (!stat.isFile()) throw new Error("not a file");
    } catch {
      return { ok: false, reason: `referenced asset is missing: ${reference}` };
    }
  }
  return { ok: true, outputDir };
}

async function readMarker(outputDir) {
  try {
    return JSON.parse(await fs.readFile(path.join(outputDir, ".build-state.json"), "utf8"));
  } catch {
    return null;
  }
}

async function check(root) {
  const output = await validateOutput(root);
  if (!output.ok) return output.reason;
  const marker = await readMarker(output.outputDir);
  if (marker?.version !== MARKER_VERSION || typeof marker.fingerprint !== "string") {
    return "build marker is missing or invalid";
  }
  const fingerprint = await fingerprintInputs(root);
  if (marker.fingerprint !== fingerprint) return "source fingerprint changed";
  return null;
}

async function write(root) {
  const output = await validateOutput(root);
  if (!output.ok) throw new Error(output.reason);
  const markerPath = path.join(output.outputDir, ".build-state.json");
  const temporaryPath = `${markerPath}.tmp-${process.pid}`;
  const marker = {
    version: MARKER_VERSION,
    fingerprint: await fingerprintInputs(root),
  };
  await fs.writeFile(temporaryPath, `${JSON.stringify(marker, null, 2)}\n`, "utf8");
  await fs.rename(temporaryPath, markerPath);
  process.stdout.write(`[omniharness] Recorded interface build ${marker.fingerprint.slice(0, 12)}.\n`);
}

async function main() {
  const { mode, root } = readArgs(process.argv.slice(2));
  if (mode === "--write") {
    await write(root);
    return;
  }
  const reason = await check(root);
  if (reason) {
    process.stdout.write(`[omniharness] Interface build required: ${reason}.\n`);
    process.exit(BUILD_REQUIRED_EXIT);
  }
  process.stdout.write("[omniharness] Production interface is current.\n");
}

main().catch((error) => {
  process.stderr.write(`[omniharness] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
