/**
 * Run-scoped artifact cleanup. Used by conversation-delete server
 * paths and the delete-conversations shell script to remove every
 * artifact stream file belonging to a run, in both the project-local
 * `<project>/.omniharness/run-data/<runId>/` tree and the legacy
 * global `<appData>/run-data/<runId>/` tree.
 *
 * The SQL `artifact_streams` rows are cascade-deleted by the FK to
 * runs; this module handles the filesystem side.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { runs } from "@/server/db/schema";
import { resolveArtifactRoot, legacyGlobalArtifactRoot } from "./project-root";

export interface CleanupReport {
  removedDirs: string[];
  removedFiles: string[];
  errors: Array<{ path: string; error: string }>;
}

/**
 * Remove every artifact file (plaintext, gzipped, lock, index) for a
 * run. Idempotent — missing files are ignored. Returns a report so
 * callers can log what was actually removed.
 *
 * The run row itself is NOT deleted by this helper. Callers that
 * delete the row should also call this; the order matters only for
 * tests that rely on the cascade — DB cascade only removes
 * `artifact_streams` rows, not the on-disk files.
 */
export async function cleanupRunArtifacts(runId: string): Promise<CleanupReport> {
  const report: CleanupReport = { removedDirs: [], removedFiles: [], errors: [] };

  const run = await db.select({ projectPath: runs.projectPath }).from(runs).where(eq(runs.id, runId)).get();
  const candidates = new Set<string>();

  // Project-local root (if any).
  if (run?.projectPath) {
    try {
      const root = await resolveArtifactRoot({ runId, projectPath: run.projectPath }, "read");
      candidates.add(root.absolutePath);
    } catch {
      // Project root may be unresolvable (project moved/deleted); fall
      // through and try the legacy global root.
    }
  }

  // Legacy global root.
  candidates.add(legacyGlobalArtifactRoot(runId).absolutePath);

  for (const dir of candidates) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      report.removedDirs.push(dir);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") continue;
      report.errors.push({
        path: dir,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Also remove the legacy archive zip if present.
  try {
    const zip = path.join(path.dirname(legacyGlobalArtifactRoot(runId).absolutePath), `${runId}.zip`);
    await fs.unlink(zip);
    report.removedFiles.push(zip);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      report.errors.push({
        path: `${runId}.zip`,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Remove the agent runtime's per-worker output archive (a separate
  // store from the worker conversation stream). Files are named
  // `<runId>-worker-*.jsonl` under `.omniharness/agent-runtime-output/`.
  // The directory is resolved relative to process.cwd() to match
  // `openAgentOutputArchive` in src/server/agent-runtime/output-store.ts.
  const runtimeOutputDir = path.join(process.cwd(), ".omniharness", "agent-runtime-output");
  try {
    const entries = await fs.readdir(runtimeOutputDir);
    const prefix = `${runId}-`;
    for (const entry of entries) {
      if (!entry.startsWith(prefix) || !entry.endsWith(".jsonl")) continue;
      const filePath = path.join(runtimeOutputDir, entry);
      try {
        await fs.unlink(filePath);
        report.removedFiles.push(filePath);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "ENOENT") {
          report.errors.push({
            path: filePath,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      report.errors.push({
        path: runtimeOutputDir,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return report;
}

/**
 * Bulk-cleanup helper: given a list of runIds, remove all artifact
 * data for each. Returns the per-runId report so the caller can log.
 */
export async function cleanupRunArtifactsBatch(runIds: string[]): Promise<Map<string, CleanupReport>> {
  const reports = new Map<string, CleanupReport>();
  for (const runId of runIds) {
    reports.set(runId, await cleanupRunArtifacts(runId));
  }
  return reports;
}
