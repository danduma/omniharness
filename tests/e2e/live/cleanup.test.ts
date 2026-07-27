import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanupLiveAgentJourney } from "../../../scripts/cleanup-live-agent-journey";
import { createLiveJourneyProject } from "./project-fixture";
import { recordOwnedRunDurably } from "./safety";

const cleanupPaths: string[] = [];

afterEach(() => {
  for (const cleanupPath of cleanupPaths.splice(0)) {
    fs.rmSync(cleanupPath, { recursive: true, force: true });
  }
});

function createFixture(journeyId: string) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "omni-cleanup-root-"));
  const manifestRoot = fs.mkdtempSync(path.join(os.tmpdir(), "omni-cleanup-manifests-"));
  cleanupPaths.push(tempRoot, manifestRoot);
  const fixture = createLiveJourneyProject({ journeyId, manifestRoot, tempRoot });
  recordOwnedRunDurably(fixture.manifestPath, {
    id: `${journeyId}-run-a`,
    label: "A",
    createdAt: "2026-07-21T12:00:00.000Z",
  });
  recordOwnedRunDurably(fixture.manifestPath, {
    id: `${journeyId}-run-b`,
    label: "B",
    createdAt: "2026-07-21T12:00:01.000Z",
  });
  return { fixture, tempRoot };
}

describe("targeted live journey cleanup", () => {
  it("deletes only manifest-owned runs, removes registration, then removes the marked project", async () => {
    const { fixture, tempRoot } = createFixture("cleanup-success");
    const deleted: string[] = [];
    const removedProjects: string[] = [];

    const result = await cleanupLiveAgentJourney({
      manifestPath: fixture.manifestPath,
      repoRoot: process.cwd(),
      tempRoot,
      transport: {
        deleteRun: async (runId) => {
          deleted.push(runId);
          return runId.endsWith("run-a") ? 200 : 404;
        },
        listRunIds: async () => ["unrelated-run"],
        removeProject: async (projectPath) => {
          removedProjects.push(projectPath);
        },
      },
    });

    expect(deleted).toEqual(["cleanup-success-run-a", "cleanup-success-run-b"]);
    expect(removedProjects).toEqual([fixture.projectPath]);
    expect(result).toEqual({
      deletedRunIds: ["cleanup-success-run-a"],
      alreadyAbsentRunIds: ["cleanup-success-run-b"],
      projectPath: fixture.projectPath,
    });
    expect(fs.existsSync(fixture.projectPath)).toBe(false);
    expect(fs.existsSync(fixture.manifestPath)).toBe(true);
  });

  it("retains the project and manifest when a run is still present", async () => {
    const { fixture, tempRoot } = createFixture("cleanup-refuse");
    let removedProject = false;

    await expect(cleanupLiveAgentJourney({
      manifestPath: fixture.manifestPath,
      repoRoot: process.cwd(),
      tempRoot,
      transport: {
        deleteRun: async () => 200,
        listRunIds: async () => ["cleanup-refuse-run-b"],
        removeProject: async () => {
          removedProject = true;
        },
      },
    })).rejects.toThrow(/still present/i);

    expect(removedProject).toBe(false);
    expect(fs.existsSync(fixture.projectPath)).toBe(true);
    expect(fs.existsSync(fixture.manifestPath)).toBe(true);
  });

  it("refuses unexpected delete responses before touching the project", async () => {
    const { fixture, tempRoot } = createFixture("cleanup-error");

    await expect(cleanupLiveAgentJourney({
      manifestPath: fixture.manifestPath,
      repoRoot: process.cwd(),
      tempRoot,
      transport: {
        deleteRun: async () => 500,
        listRunIds: async () => [],
        removeProject: async () => undefined,
      },
    })).rejects.toThrow(/status 500/i);

    expect(fs.existsSync(fixture.projectPath)).toBe(true);
  });
});
