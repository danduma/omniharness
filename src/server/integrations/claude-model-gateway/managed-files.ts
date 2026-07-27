import { randomUUID } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, posix, win32 } from "node:path";

const OWNED_TEXT_PREFIX = "# omniharness-managed:";

export type ClaudeGatewayManagedPaths = ReturnType<typeof resolveClaudeGatewayManagedPaths>;

export function resolveClaudeGatewayManagedPaths(homeDir: string) {
  const root = join(homeDir, ".omniharness", "cliproxyapi");
  return {
    root,
    versions: join(root, "versions"),
    config: join(root, "managed-config.yaml"),
    auth: join(root, "auth"),
    process: join(root, "process.json"),
    logs: join(root, "logs"),
    current: join(root, "current.json"),
  };
}

export async function ensureManagedDirectory(directory: string) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
}

async function readIfPresent(filePath: string) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    const code = error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : null;
    if (code === "ENOENT") return null;
    throw error;
  }
}

async function atomicWrite(filePath: string, content: string) {
  await ensureManagedDirectory(dirname(filePath));
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, content, { encoding: "utf8", mode: 0o600, flag: "wx" });
  await chmod(temporaryPath, 0o600);
  await rename(temporaryPath, filePath);
  await chmod(filePath, 0o600);
}

export async function writeOwnedTextFile(filePath: string, content: string, kind: string) {
  const existing = await readIfPresent(filePath);
  const expectedPrefix = `${OWNED_TEXT_PREFIX} ${kind}\n`;
  if (existing !== null && !existing.startsWith(expectedPrefix)) {
    throw new Error(`Refusing to replace ${filePath}: the file is not owned by OmniHarness.`);
  }
  await atomicWrite(filePath, `${expectedPrefix}${content}`);
}

export async function writeOwnedJsonFile(filePath: string, kind: string, value: Record<string, unknown>) {
  await assertOwnedJsonFileWritable(filePath, kind);
  await atomicWrite(filePath, `${JSON.stringify({ owner: "omniharness", kind, ...value }, null, 2)}\n`);
}

export async function assertOwnedJsonFileWritable(filePath: string, kind: string) {
  const existing = await readIfPresent(filePath);
  if (existing !== null) {
    try {
      const parsed = JSON.parse(existing) as { owner?: unknown; kind?: unknown };
      if (parsed.owner !== "omniharness" || parsed.kind !== kind) throw new Error("owner mismatch");
    } catch {
      throw new Error(`Refusing to replace ${filePath}: the file is not owned by OmniHarness.`);
    }
  }
}

export async function readOwnedJsonFile<T extends Record<string, unknown>>(filePath: string, kind: string): Promise<T | null> {
  const content = await readIfPresent(filePath);
  if (content === null) return null;
  try {
    const parsed = JSON.parse(content) as T & { owner?: unknown; kind?: unknown };
    return parsed.owner === "omniharness" && parsed.kind === kind ? parsed : null;
  } catch {
    return null;
  }
}

export function assertSafeArchiveEntries(entries: string[]) {
  for (const rawEntry of entries) {
    const entry = rawEntry.trim().replaceAll("\\", "/");
    if (!entry) continue;
    const normalized = posix.normalize(entry);
    const segments = entry.split("/");
    if (
      isAbsolute(rawEntry)
      || win32.isAbsolute(rawEntry)
      || entry.startsWith("/")
      || normalized === ".."
      || normalized.startsWith("../")
      || segments.includes("..")
    ) {
      throw new Error(`Unsafe archive entry: ${rawEntry}`);
    }
  }
}

export async function assertNoSymlinks(root: string, relativeEntries: string[]) {
  for (const relativeEntry of relativeEntries) {
    const normalized = relativeEntry.trim().replaceAll("\\", "/").replace(/\/$/, "");
    if (!normalized) continue;
    const entryPath = join(root, ...normalized.split("/"));
    const entryStat = await lstat(entryPath);
    if (entryStat.isSymbolicLink()) {
      throw new Error(`Unsafe archive symlink: ${relativeEntry}`);
    }
  }
}
