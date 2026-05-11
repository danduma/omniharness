import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { normalizeExplicitProjectPaths, isSameOrDescendantPath, resolveStaleProjectFallback, resolveStoredProjectRoot } from "@/lib/project-paths";
import { db } from "@/server/db";
import { runs, workers } from "@/server/db/schema";

function parseProjectSetting(value: string | null | undefined) {
  if (!value?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

function rebasePath(pathValue: string, oldRoot: string, newRoot: string) {
  if (!isSameOrDescendantPath(pathValue, oldRoot)) {
    return pathValue;
  }

  const relativePath = path.relative(oldRoot, pathValue);
  if (!relativePath) {
    return newRoot;
  }

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return pathValue;
  }

  return path.join(newRoot, relativePath);
}

export async function canonicalizePersistedProjectRoots(projectSettingValue: string | null | undefined) {
  const explicitProjects = normalizeExplicitProjectPaths(parseProjectSetting(projectSettingValue));
  if (explicitProjects.length === 0) {
    return;
  }

  const allRuns = await db.select().from(runs);
  const allWorkers = await db.select().from(workers);
  const staleFallbackProject = resolveStaleProjectFallback(
    explicitProjects,
    allRuns.map((run) => run.projectPath),
  );

  for (const run of allRuns) {
    const storedProjectPath = run.projectPath?.trim();
    const resolvedProjectRoot = resolveStoredProjectRoot(storedProjectPath, explicitProjects, { staleFallbackProject });
    if (!storedProjectPath || !resolvedProjectRoot) {
      continue;
    }

    const projectRoot = path.resolve(resolvedProjectRoot);
    if (isSameOrDescendantPath(storedProjectPath, projectRoot)) {
      continue;
    }

    const oldRoot = path.resolve(storedProjectPath);
    if (fs.existsSync(oldRoot)) {
      continue;
    }

    await db.update(runs).set({
      projectPath: projectRoot,
      updatedAt: new Date(),
    }).where(eq(runs.id, run.id));

    for (const worker of allWorkers.filter((candidate) => candidate.runId === run.id)) {
      const nextCwd = rebasePath(path.resolve(worker.cwd), oldRoot, projectRoot);
      if (nextCwd === worker.cwd) {
        continue;
      }

      await db.update(workers).set({
        cwd: nextCwd,
        updatedAt: new Date(),
      }).where(eq(workers.id, worker.id));
    }
  }
}
