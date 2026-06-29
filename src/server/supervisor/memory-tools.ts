import fs from "fs";
import path from "path";
import { SupervisorProtocolError } from "@/server/supervisor/protocol";
import { ensureMemoryRoot, getMemoryRoot, normalizeMemoryRelativePath, resolveMemoryPath } from "@/server/supervisor/memory-paths";

export const MEMORY_READ_LIMIT = 60_000;
export const MEMORY_WRITE_LIMIT = 60_000;

export interface MemoryFileEntry {
  path: string;
  size: number;
  updatedAt: string;
}

export interface MemoryReadResult {
  path: string;
  absolutePath: string;
  content: string;
  truncated: boolean;
  size: number;
  updatedAt: string;
}

export interface MemoryWriteResult {
  path: string;
  absolutePath: string;
  operation: "write" | "append";
  bytesWritten: number;
  newSize: number;
  updatedAt: string;
}

function listMemoryFilesRecursive(root: string, currentDir: string, results: MemoryFileEntry[]) {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      listMemoryFilesRecursive(root, absolutePath, results);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const stat = fs.statSync(absolutePath);
    results.push({
      path: normalizeMemoryRelativePath(path.relative(root, absolutePath)),
      size: stat.size,
      updatedAt: stat.mtime.toISOString(),
    });
  }
}

function legacyNestedMemoryPath(root: string, relativePath: string) {
  return path.join(root, ".omniharness", "memory", relativePath);
}

export function listMemory(projectPath: string | null | undefined): MemoryFileEntry[] {
  if (!projectPath) {
    return [];
  }
  const root = getMemoryRoot(projectPath);
  if (!fs.existsSync(root)) {
    return [];
  }
  const results: MemoryFileEntry[] = [];
  listMemoryFilesRecursive(root, root, results);
  const deduped = new Map<string, MemoryFileEntry>();
  for (const entry of results) {
    const existing = deduped.get(entry.path);
    if (!existing || entry.updatedAt > existing.updatedAt) {
      deduped.set(entry.path, entry);
    }
  }
  return [...deduped.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function readMemory(projectPath: string | null | undefined, requestedPath: string, options?: {
  maxBytes?: number;
}): MemoryReadResult {
  const { absolutePath, relativePath } = resolveMemoryPath(projectPath ?? null, requestedPath);
  const root = getMemoryRoot(projectPath!);
  const readPath = fs.existsSync(absolutePath)
    ? absolutePath
    : legacyNestedMemoryPath(root, relativePath);
  if (!fs.existsSync(readPath)) {
    throw new SupervisorProtocolError(`Memory file "${requestedPath}" does not exist.`);
  }

  const stat = fs.statSync(readPath);
  if (!stat.isFile()) {
    throw new SupervisorProtocolError(`Memory path "${requestedPath}" is not a regular file.`);
  }

  const maxBytes = options?.maxBytes ?? MEMORY_READ_LIMIT;
  const raw = fs.readFileSync(readPath, "utf8");
  const truncated = raw.length > maxBytes;
  return {
    path: relativePath,
    absolutePath: readPath,
    content: truncated ? raw.slice(0, maxBytes) : raw,
    truncated,
    size: stat.size,
    updatedAt: stat.mtime.toISOString(),
  };
}

function ensureParentDir(absolutePath: string) {
  const parent = path.dirname(absolutePath);
  if (!fs.existsSync(parent)) {
    fs.mkdirSync(parent, { recursive: true });
  }
}

export function writeMemory(projectPath: string | null | undefined, requestedPath: string, content: string): MemoryWriteResult {
  const { absolutePath, relativePath } = resolveMemoryPath(projectPath ?? null, requestedPath);
  if (typeof content !== "string") {
    throw new SupervisorProtocolError("Memory content must be a string.");
  }
  if (content.length > MEMORY_WRITE_LIMIT) {
    throw new SupervisorProtocolError(
      `Memory content is ${content.length} characters; limit is ${MEMORY_WRITE_LIMIT}.`,
    );
  }
  ensureMemoryRoot(projectPath!);
  ensureParentDir(absolutePath);
  fs.writeFileSync(absolutePath, content, "utf8");
  const stat = fs.statSync(absolutePath);
  return {
    path: relativePath,
    absolutePath,
    operation: "write",
    bytesWritten: Buffer.byteLength(content, "utf8"),
    newSize: stat.size,
    updatedAt: stat.mtime.toISOString(),
  };
}

export function appendMemory(projectPath: string | null | undefined, requestedPath: string, content: string): MemoryWriteResult {
  const { absolutePath, relativePath } = resolveMemoryPath(projectPath ?? null, requestedPath);
  if (typeof content !== "string") {
    throw new SupervisorProtocolError("Memory content must be a string.");
  }
  if (content.length > MEMORY_WRITE_LIMIT) {
    throw new SupervisorProtocolError(
      `Memory content is ${content.length} characters; limit is ${MEMORY_WRITE_LIMIT}.`,
    );
  }
  ensureMemoryRoot(projectPath!);
  ensureParentDir(absolutePath);
  const existing = fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : "";
  const separator = existing && !existing.endsWith("\n") ? "\n" : "";
  const next = `${existing}${separator}${content}`;
  if (next.length > MEMORY_WRITE_LIMIT * 4) {
    throw new SupervisorProtocolError(
      `Memory file "${requestedPath}" would exceed ${MEMORY_WRITE_LIMIT * 4} characters after append; trim or rewrite it instead.`,
    );
  }
  fs.writeFileSync(absolutePath, next, "utf8");
  const stat = fs.statSync(absolutePath);
  return {
    path: relativePath,
    absolutePath,
    operation: "append",
    bytesWritten: Buffer.byteLength(content, "utf8"),
    newSize: stat.size,
    updatedAt: stat.mtime.toISOString(),
  };
}

export function deleteMemoryRootIfEmpty(projectPath: string | null | undefined) {
  if (!projectPath) {
    return;
  }
  const root = getMemoryRoot(projectPath);
  if (!fs.existsSync(root)) {
    return;
  }
  const entries = fs.readdirSync(root);
  if (entries.length === 0) {
    fs.rmdirSync(root);
  }
}
