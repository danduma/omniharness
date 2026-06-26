import { execFileSync } from "child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { executionEvents, plans, runs } from "@/server/db/schema";
import { captureGitBaseline } from "@/server/git/auto-commit";
import { runMilestoneAutoCommit } from "@/server/git/run-auto-commit";

function git(cwd: string, args: string[]) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function createRepo(name: string) {
  const repo = mkdtempSync(path.join(tmpdir(), `omni-${name}-`));
  git(repo, ["init"]);
  git(repo, ["config", "user.name", "OmniHarness Test"]);
  git(repo, ["config", "user.email", "omni@example.test"]);
  writeFileSync(path.join(repo, "README.md"), "# Test\n");
  git(repo, ["add", "README.md"]);
  git(repo, ["commit", "-m", "initial"]);
  return repo;
}

describe("runMilestoneAutoCommit", () => {
  beforeEach(async () => {
    await db.delete(executionEvents);
    await db.delete(runs);
    await db.delete(plans);
  });

  it("creates a milestone commit for completed direct runs", async () => {
    const repo = createRepo("direct-run-auto-commit");
    const baseline = captureGitBaseline(repo);
    writeFileSync(path.join(repo, "feature.txt"), "implemented\n");
    const now = new Date();
    await db.insert(plans).values({
      id: "plan-direct-commit",
      path: "vibes/ad-hoc/direct-commit.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: "run-direct-commit",
      planId: "plan-direct-commit",
      mode: "direct",
      projectPath: repo,
      title: "Direct implementation",
      status: "done",
      autoCommitMilestones: true,
      pushOnCommit: false,
      gitBaselineJson: JSON.stringify(baseline),
      createdAt: now,
      updatedAt: now,
    });

    const result = await runMilestoneAutoCommit("run-direct-commit", "Direct run completed.");

    expect(result?.status).toBe("created");
    expect(git(repo, ["log", "-1", "--pretty=%s"])).toBe("OmniHarness: Direct implementation");
    const event = await db.select().from(executionEvents).get();
    expect(event?.eventType).toBe("auto_commit_created");
  });

  it("emits created instead of failed for unstaged tracked src path modifications", async () => {
    const repo = createRepo("direct-run-auto-commit-src-path");
    const trackedPath = path.join(repo, "src", "app", "(public)", "(marketing)", "page.tsx");
    mkdirSync(path.dirname(trackedPath), { recursive: true });
    writeFileSync(trackedPath, "export default function Page() { return null; }\n");
    git(repo, ["add", "src/app/(public)/(marketing)/page.tsx"]);
    git(repo, ["commit", "-m", "add marketing page"]);
    const baseline = captureGitBaseline(repo);
    writeFileSync(trackedPath, "export default function Page() { return 'done'; }\n");
    const now = new Date();
    await db.insert(plans).values({
      id: "plan-direct-src-path",
      path: "vibes/ad-hoc/direct-src-path.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: "run-direct-src-path",
      planId: "plan-direct-src-path",
      mode: "direct",
      projectPath: repo,
      title: "Direct implementation",
      status: "done",
      autoCommitMilestones: true,
      pushOnCommit: false,
      gitBaselineJson: JSON.stringify(baseline),
      createdAt: now,
      updatedAt: now,
    });

    const result = await runMilestoneAutoCommit("run-direct-src-path", "Direct run completed.");

    expect(result?.status).toBe("created");
    expect(git(repo, ["show", "--name-only", "--pretty=format:", "HEAD"]).split("\n").filter(Boolean)).toEqual([
      "src/app/(public)/(marketing)/page.tsx",
    ]);
    const events = await db.select().from(executionEvents);
    expect(events.map((event) => event.eventType)).toEqual(["auto_commit_created"]);
  });
});
