import os from "node:os";
import path from "node:path";

function isPathInside(candidate: string, parent: string) {
  const relative = path.relative(parent, candidate);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function isTestProcess() {
  return process.env.VITEST === "true"
    || process.env.VITEST_WORKER_ID !== undefined
    || process.env.TEST_WORKER_INDEX !== undefined;
}

function assertSafeTestRoot(root: string) {
  if (!isTestProcess()) {
    return;
  }

  const resolvedRoot = path.resolve(root);
  const resolvedCwd = path.resolve(process.cwd());
  const temporaryParents = [os.tmpdir(), "/tmp", "/var/tmp"].map((entry) => path.resolve(entry));
  const isTemporary = temporaryParents.some((parent) => isPathInside(resolvedRoot, parent));

  if (resolvedRoot === resolvedCwd || !isTemporary) {
    throw new Error(
      `[database-safety] Refusing to use non-temporary app data root in a test process: ${resolvedRoot}`,
    );
  }
}

export function getAppRoot() {
  const configuredRoot = process.env.OMNIHARNESS_ROOT?.trim();
  const root = configuredRoot ? path.resolve(configuredRoot) : process.cwd();
  assertSafeTestRoot(root);
  return root;
}

export function getAppDataPath(...segments: string[]) {
  return path.join(getAppRoot(), ...segments);
}
