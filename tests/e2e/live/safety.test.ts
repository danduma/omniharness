import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createLiveJourneyProject,
  resolveLiveJourneyProjectRoot,
} from "./project-fixture";
import {
  assertLiveJourneyOptIn,
  assertLoopbackUrl,
  assertManifestOwnsRun,
  assertManifestSafe,
  assertOwnedTempProject,
  assertProjectMarkerMatches,
  readLiveJourneyManifest,
  recordOwnedRunDurably,
} from "./safety";

const cleanupPaths: string[] = [];

function temporaryDirectory(prefix: string): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  cleanupPaths.push(directory);
  return directory;
}

afterEach(() => {
  for (const cleanupPath of cleanupPaths.splice(0)) {
    fs.rmSync(cleanupPath, { recursive: true, force: true });
  }
});

describe("live journey safety", () => {
  it.each([
    "http://localhost:3035",
    "http://127.0.0.1:3035",
    "http://[::1]:3035",
  ])("allows loopback target %s", (target) => {
    expect(assertLoopbackUrl(target).origin).toBe(new URL(target).origin);
  });

  it.each([
    "https://example.com",
    "http://192.168.1.10:3035",
    "file:///tmp/omniharness",
  ])("rejects non-loopback target %s", (target) => {
    expect(() => assertLoopbackUrl(target)).toThrow(/loopback/i);
  });

  it("requires explicit real-agent opt-in and runtime authentication", () => {
    expect(() => assertLiveJourneyOptIn({})).toThrow(/OMNIHARNESS_LIVE_E2E=1/);
    expect(() => assertLiveJourneyOptIn({ OMNIHARNESS_LIVE_E2E: "1" })).toThrow(/password|authenticated/i);
    expect(() => assertLiveJourneyOptIn({
      OMNIHARNESS_LIVE_E2E: "1",
      OMNIHARNESS_LIVE_E2E_PASSWORD: "runtime-only",
    })).not.toThrow();
    expect(() => assertLiveJourneyOptIn({
      OMNIHARNESS_LIVE_E2E: "1",
      OMNIHARNESS_LIVE_E2E_AUTHENTICATED: "1",
    })).not.toThrow();
  });

  it("allows only a real temporary project outside the repository and registered projects", () => {
    const tempRoot = temporaryDirectory("omni-live-root-");
    const projectPath = fs.mkdtempSync(path.join(tempRoot, "project-"));
    const repoRoot = fs.mkdtempSync(path.join(tempRoot, "repo-"));
    const registeredProject = fs.mkdtempSync(path.join(tempRoot, "registered-"));

    expect(assertOwnedTempProject({ projectPath, repoRoot, tempRoot })).toBe(fs.realpathSync(projectPath));
    expect(() => assertOwnedTempProject({
      projectPath: repoRoot,
      repoRoot,
      tempRoot,
    })).toThrow(/repository/i);
    expect(() => assertOwnedTempProject({
      projectPath: registeredProject,
      repoRoot,
      tempRoot,
      registeredProjectPaths: [registeredProject],
    })).toThrow(/registered/i);
  });

  it("rejects paths outside temp and symlink escapes", () => {
    const tempRoot = temporaryDirectory("omni-live-root-");
    const repoRoot = temporaryDirectory("omni-live-repo-");
    const outside = temporaryDirectory("omni-live-outside-");
    const symlink = path.join(tempRoot, "escape");
    fs.symlinkSync(outside, symlink);

    expect(() => assertOwnedTempProject({ projectPath: outside, repoRoot, tempRoot })).toThrow(/temporary/i);
    expect(() => assertOwnedTempProject({ projectPath: symlink, repoRoot, tempRoot })).toThrow(/temporary|symlink/i);
  });

  it("creates a marked dependency-free project and an empty durable manifest", () => {
    const tempRoot = temporaryDirectory("omni-live-root-");
    const manifestRoot = temporaryDirectory("omni-live-manifests-");
    const fixture = createLiveJourneyProject({ journeyId: "journey-123", manifestRoot, tempRoot });
    cleanupPaths.push(fixture.projectPath);

    expect(fixture.projectPath).toBe(fs.realpathSync(fixture.projectPath));
    expect(fs.readFileSync(path.join(fixture.projectPath, ".gitignore"), "utf8")).toContain("*");
    expect(fixture.manifest.runs).toEqual([]);
    expect(readLiveJourneyManifest(fixture.manifestPath)).toEqual(fixture.manifest);
    expect(() => assertProjectMarkerMatches(fixture.projectPath, fixture.manifest)).not.toThrow();
  });

  it("places the real UI fixture in a dedicated visible folder beside the repository", () => {
    const workspaceRoot = temporaryDirectory("omni-live-workspace-");
    const repoRoot = path.join(workspaceRoot, "omniharness");
    fs.mkdirSync(repoRoot);

    const journeyRoot = resolveLiveJourneyProjectRoot(repoRoot);
    cleanupPaths.push(journeyRoot);
    const workspaceRealPath = fs.realpathSync(workspaceRoot);
    const repoRealPath = fs.realpathSync(repoRoot);

    expect(journeyRoot).toBe(fs.realpathSync(path.join(workspaceRoot, "omniharness-live-journeys")));
    expect(path.basename(journeyRoot).startsWith(".")).toBe(false);
    expect(path.relative(workspaceRealPath, journeyRoot)).not.toMatch(/^\.\./);
    expect(path.relative(repoRealPath, journeyRoot)).toMatch(/^\.\./);
  });

  it("records each owned run synchronously before returning", () => {
    const tempRoot = temporaryDirectory("omni-live-root-");
    const manifestRoot = temporaryDirectory("omni-live-manifests-");
    const fixture = createLiveJourneyProject({ journeyId: "journey-456", manifestRoot, tempRoot });
    cleanupPaths.push(fixture.projectPath);

    const updated = recordOwnedRunDurably(fixture.manifestPath, {
      id: "run-a",
      label: "A",
      createdAt: "2026-07-13T20:00:00.000Z",
    });

    expect(updated.runs.map((run) => run.id)).toEqual(["run-a"]);
    expect(readLiveJourneyManifest(fixture.manifestPath).runs.map((run) => run.id)).toEqual(["run-a"]);
    expect(() => assertManifestOwnsRun(updated, "run-a")).not.toThrow();
    expect(() => assertManifestOwnsRun(updated, "unowned-run")).toThrow(/not owned/i);
  });

  it("rejects duplicate run ids and secret-shaped manifest data", () => {
    const manifest = {
      schemaVersion: 1 as const,
      journeyId: "journey-789",
      createdAt: "2026-07-13T20:00:00.000Z",
      projectPath: "/tmp/owned",
      runs: [
        { id: "same", label: "A" as const, createdAt: "2026-07-13T20:00:00.000Z" },
        { id: "same", label: "B" as const, createdAt: "2026-07-13T20:00:01.000Z" },
      ],
    };
    expect(() => assertManifestSafe(manifest)).toThrow(/duplicate/i);

    expect(() => assertManifestSafe({
      ...manifest,
      runs: [],
      journeyId: "Bearer secret-token",
    })).toThrow(/secret|unsafe/i);
  });

  it("rejects a marker from another journey", () => {
    const tempRoot = temporaryDirectory("omni-live-root-");
    const manifestRoot = temporaryDirectory("omni-live-manifests-");
    const fixture = createLiveJourneyProject({ journeyId: "journey-owner", manifestRoot, tempRoot });
    cleanupPaths.push(fixture.projectPath);
    const markerPath = path.join(fixture.projectPath, ".omniharness-live-journey.json");
    const marker = JSON.parse(fs.readFileSync(markerPath, "utf8")) as Record<string, unknown>;
    fs.writeFileSync(markerPath, JSON.stringify({ ...marker, journeyId: "journey-other" }));

    expect(() => assertProjectMarkerMatches(fixture.projectPath, fixture.manifest)).toThrow(/marker|journey/i);
  });
});
