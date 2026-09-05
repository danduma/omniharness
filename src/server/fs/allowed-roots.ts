import fs from "fs";
import path from "path";
import { isPathInside } from "@/server/fs/files";

export type AllowedRootDescriptor = {
  path: string;
  available: boolean;
};

function parseConfiguredRoots(): string[] {
  const override = process.env.OMNIHARNESS_FS_ROOTS?.trim();
  const candidates = override
    ? override.split(path.delimiter).map((root) => root.trim()).filter(Boolean)
    : [path.join(process.cwd(), "..")];
  const resolved = candidates.map((root) => path.resolve(root));
  return resolved.filter((root, index) => resolved.indexOf(root) === index);
}

/**
 * Every directory tree the filesystem routes may browse, read, or create in.
 * Read from the environment on each call so tests and restarts pick up changes
 * without a module reload. Roots are kept even when the path does not resolve
 * right now — an unmounted volume should come back as itself rather than
 * quietly dropping out of the allowlist and rerouting the caller elsewhere.
 */
export function getAllowedRoots(): string[] {
  return parseConfiguredRoots();
}

export function describeAllowedRoots(): AllowedRootDescriptor[] {
  return getAllowedRoots().map((root) => ({
    path: root,
    available: isReadableDirectory(root),
  }));
}

function isReadableDirectory(candidate: string) {
  try {
    return fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

/**
 * The allowed root that contains `candidate`, or null when it escapes all of
 * them. Nested roots resolve to the outermost match so that browsing up out of
 * `/a/b` into an also-allowed `/a` is not treated as an escape.
 */
export function findAllowedRootFor(candidate: string): string | null {
  const resolved = path.resolve(candidate);
  return getAllowedRoots()
    .filter((root) => isPathInside(root, resolved))
    .sort((a, b) => a.length - b.length)[0] ?? null;
}

/** Where browsing starts, and where an out-of-root request is clamped back to. */
export function getDefaultAllowedRoot(): string {
  const roots = getAllowedRoots();
  return roots.find((root) => isReadableDirectory(root)) ?? roots[0];
}
