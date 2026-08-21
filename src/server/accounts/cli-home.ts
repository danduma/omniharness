import { mkdir, lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { getAppRoot } from "@/server/app-root";

const ACCOUNT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export function assertManagedAccountId(accountId: string) {
  if (!ACCOUNT_ID_PATTERN.test(accountId) || accountId === "." || accountId === "..") {
    throw new TypeError("Account id is not valid for a managed CLI home.");
  }
  return accountId;
}

export function accountCliHomesRoot(instanceRoot = getAppRoot()) {
  return path.resolve(instanceRoot, "account-cli-homes");
}

export function resolveAccountCliHome(cliType: string, accountId: string, instanceRoot = getAppRoot()) {
  const normalizedCliType = cliType.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_-]{0,31}$/.test(normalizedCliType)) {
    throw new TypeError("CLI type is not valid for a managed account home.");
  }
  assertManagedAccountId(accountId);
  return validateManagedAccountPath(
    path.resolve(accountCliHomesRoot(instanceRoot), normalizedCliType, accountId),
    instanceRoot,
  );
}

export function resolveClaudeConfigDir(accountId: string, instanceRoot = getAppRoot()) {
  return path.join(resolveAccountCliHome("claude", accountId, instanceRoot), "config");
}

export function validateManagedAccountPath(candidate: string, instanceRoot = getAppRoot()) {
  const root = accountCliHomesRoot(instanceRoot);
  const resolved = path.resolve(candidate);
  const relative = path.relative(root, resolved);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("Path is outside the managed account CLI-home root.");
  }
  return resolved;
}

export async function ensurePrivateClaudeConfigDir(accountId: string, instanceRoot = getAppRoot()) {
  const accountHome = resolveAccountCliHome("claude", accountId, instanceRoot);
  const configDir = resolveClaudeConfigDir(accountId, instanceRoot);
  await mkdir(configDir, { recursive: true, mode: 0o700 });
  const accountStat = await lstat(accountHome);
  const configStat = await lstat(configDir);
  if (accountStat.isSymbolicLink() || configStat.isSymbolicLink()) {
    throw new Error("Managed account CLI-home paths cannot be symbolic links.");
  }
  if (process.platform !== "win32") {
    await Promise.all([
      import("node:fs/promises").then(({ chmod }) => chmod(accountHome, 0o700)),
      import("node:fs/promises").then(({ chmod }) => chmod(configDir, 0o700)),
    ]);
  }
  const canonicalRoot = await realpath(accountCliHomesRoot(instanceRoot));
  const canonicalHome = await realpath(accountHome);
  const relative = path.relative(canonicalRoot, canonicalHome);
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("Managed account CLI-home resolved outside its root.");
  }
  return { accountHome, configDir };
}

export async function assertSafePurgeTarget(accountId: string, instanceRoot = getAppRoot()) {
  const target = resolveAccountCliHome("claude", accountId, instanceRoot);
  const info = await lstat(target);
  if (info.isSymbolicLink() || !info.isDirectory()) {
    throw new Error("Managed account purge target is unsafe.");
  }
  const canonicalRoot = await realpath(accountCliHomesRoot(instanceRoot));
  const canonicalTarget = await realpath(target);
  const relative = path.relative(canonicalRoot, canonicalTarget);
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("Managed account purge target is unsafe.");
  }
  if (path.dirname(canonicalTarget) !== path.join(canonicalRoot, "claude")) {
    throw new Error("Managed account purge target is unsafe.");
  }
  return canonicalTarget;
}
