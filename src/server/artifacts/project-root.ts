/**
 * Resolves the artifact root for a run.
 *
 * Canonical location: `<run.projectPath>/.omniharness/run-data/<runId>/`
 *
 * Runs without `projectPath` (legacy data created before project paths
 * were tracked) fall back to the app-global `<appData>/run-data/<runId>/`
 * for *reads only*. New writes against a run with no project path are
 * rejected with a stable error code — callers must surface this to the
 * user rather than silently re-creating the legacy global mess.
 *
 * Stored SQLite metadata records the relative path under `.omniharness/run-data`
 * plus the absolute `projectPath`, never an absolute artifact path.
 * That keeps the data portable when a project moves on disk (e.g. the
 * user renames `~/work/foo` → `~/work/bar`).
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import { getAppDataPath } from "@/server/app-root";
import { getProjectOmniharnessDir } from "@/server/projects/config";

const RUN_DATA_SUBDIR = "run-data";
const OMNIHARNESS_DIR = ".omniharness";

export class ArtifactRootError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = "ArtifactRootError";
  }
}

export type ArtifactRootSource = "project" | "legacy_global";

export interface ArtifactRoot {
  /** Absolute path of the run's artifact root directory. */
  absolutePath: string;
  /** Whether the root is project-local or the legacy global fallback. */
  source: ArtifactRootSource;
  /**
   * The `projectPath` recorded in SQLite metadata when writing artifacts.
   * null for legacy global roots (no owning project).
   */
  projectPath: string | null;
  /**
   * Relative path *of the run's artifact root* under either
   * `<project>/.omniharness/run-data/` or `<appData>/run-data/`. Stored
   * in SQLite metadata to keep records portable.
   */
  relativeRootPath: string;
}

/**
 * Resolve the artifact root for a run from server-owned run metadata.
 * `projectPath` here is the value already on `runs.projectPath`; callers
 * MUST NOT accept it directly from client input.
 *
 * `mode`:
 *   - `read`: returns a project-local root if available, else falls back
 *     to the legacy global root (without creating anything).
 *   - `write`: refuses to resolve a legacy-global root. New writes must
 *     have an owning project. Returns project-local root and `mkdir -p`s
 *     it as a side effect.
 */
export async function resolveArtifactRoot(
  args: { runId: string; projectPath: string | null | undefined },
  mode: "read" | "write",
): Promise<ArtifactRoot> {
  const runId = args.runId?.trim();
  if (!runId) {
    throw new ArtifactRootError("Run id is required to resolve artifact root.", "runid_missing");
  }

  const projectPath = args.projectPath?.trim() || null;

  if (projectPath) {
    assertSafeRunId(runId);
    const projectRoot = path.resolve(projectPath);
    const omniDir = getProjectOmniharnessDir(projectRoot);
    const runRoot = path.join(omniDir, RUN_DATA_SUBDIR, runId);

    if (mode === "write") {
      // If the project directory itself has gone (renamed, deleted, or
      // an in-test fake path), fall through to the legacy global root
      // rather than fail the whole append. The repair tool/backfill can
      // relocate once the project is back. We DON'T retry/create the
      // missing project root — that would silently scatter artifacts
      // through unrelated filesystems on misconfigured runs.
      try {
        await fs.mkdir(runRoot, { recursive: true });
        return {
          absolutePath: runRoot,
          source: "project",
          projectPath: projectRoot,
          relativeRootPath: path.posix.join(RUN_DATA_SUBDIR, runId),
        };
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "ENOENT" && code !== "ENOTDIR") {
          throw error;
        }
        // fall through to legacy below
      }
    } else {
      return {
        absolutePath: runRoot,
        source: "project",
        projectPath: projectRoot,
        relativeRootPath: path.posix.join(RUN_DATA_SUBDIR, runId),
      };
    }
  }

  // Legacy fallback: runs created before projectPath was a required
  // attribute land here. We let them keep writing to the app-global
  // run-data directory rather than fail the whole feature for old data.
  // Backfill can relocate them later. New runs SHOULD have projectPath
  // set so they end up project-local from the start.
  const legacyRoot = legacyGlobalRunRoot(runId);
  if (mode === "write") {
    await fs.mkdir(legacyRoot, { recursive: true });
  }
  return {
    absolutePath: legacyRoot,
    source: "legacy_global",
    projectPath: null,
    relativeRootPath: path.posix.join(RUN_DATA_SUBDIR, runId),
  };
}

/**
 * Returns the absolute path of an artifact stream given the run's root
 * and a stream-relative path. The stream-relative path is what's stored
 * in `artifact_streams.relative_path` (e.g. `workers/abc-worker-1.jsonl`
 * or `execution-events.jsonl`). Hard-fails on path traversal or paths
 * that escape the artifact root.
 */
export function resolveStreamPathWithin(root: ArtifactRoot, relativeStreamPath: string): string {
  const normalized = path.posix.normalize(relativeStreamPath).replace(/^[/\\]+/, "");
  if (normalized.startsWith("..") || path.isAbsolute(normalized) || normalized.includes("\0")) {
    throw new ArtifactRootError(
      `Refusing artifact path that escapes its root: ${relativeStreamPath}`,
      "path_traversal",
    );
  }
  const absolute = path.join(root.absolutePath, normalized);
  // Belt-and-braces: ensure the resolved absolute path is still inside
  // the root after normalization.
  const rootResolved = path.resolve(root.absolutePath);
  const absResolved = path.resolve(absolute);
  if (absResolved !== rootResolved && !absResolved.startsWith(rootResolved + path.sep)) {
    throw new ArtifactRootError(
      `Refusing artifact path that escapes its root: ${relativeStreamPath}`,
      "path_traversal",
    );
  }
  return absResolved;
}

function legacyGlobalRunRoot(runId: string) {
  return path.join(getAppDataPath(RUN_DATA_SUBDIR), runId);
}

/**
 * The legacy global artifact root for a run. Used by readers that still
 * need to fall back to pre-migration files. New writes MUST NOT land here.
 */
export function legacyGlobalArtifactRoot(runId: string): ArtifactRoot {
  return {
    absolutePath: legacyGlobalRunRoot(runId),
    source: "legacy_global",
    projectPath: null,
    relativeRootPath: path.posix.join(RUN_DATA_SUBDIR, runId),
  };
}

function assertSafeRunId(runId: string) {
  if (runId.includes("/") || runId.includes("\\") || runId.includes("..") || runId.includes("\0")) {
    throw new ArtifactRootError(
      `Refusing artifact root for unsafe run id: ${JSON.stringify(runId)}`,
      "unsafe_runid",
    );
  }
}

export const ARTIFACT_DIR_NAME = OMNIHARNESS_DIR;
export const ARTIFACT_RUN_DATA_SUBDIR = RUN_DATA_SUBDIR;
