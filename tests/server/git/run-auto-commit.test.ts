import { execFileSync } from "child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { executionEvents, plans, recoveryIncidents, runs, workers } from "@/server/db/schema";
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
    await db.delete(recoveryIncidents);
    await db.delete(workers);
    await db.delete(runs);
    await db.delete(plans);
  });

  async function seedRun(args: {
    id: string;
    repo: string;
    baseline: ReturnType<typeof captureGitBaseline>;
    status?: string;
    lastError?: string | null;
    failedAt?: Date | null;
    pushOnCommit?: boolean;
    workerStatus?: string | null;
  }) {
    const now = new Date();
    await db.insert(plans).values({
      id: `${args.id}-plan`,
      path: `vibes/ad-hoc/${args.id}.md`,
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: args.id,
      planId: `${args.id}-plan`,
      mode: "direct",
      projectPath: args.repo,
      title: "Gated run",
      status: args.status ?? "done",
      lastError: args.lastError ?? null,
      failedAt: args.failedAt ?? null,
      autoCommitMilestones: true,
      pushOnCommit: args.pushOnCommit ?? false,
      gitBaselineJson: JSON.stringify(args.baseline),
      createdAt: now,
      updatedAt: now,
    });
    if (args.workerStatus) {
      await db.insert(workers).values({
        id: `${args.id}-worker-1`,
        runId: args.id,
        type: "claude",
        status: args.workerStatus,
        cwd: args.repo,
        outputLog: "",
        outputEntriesJson: "[]",
        currentText: "",
        lastText: "",
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  it("does not commit or push when the conversation died on an auth failure", async () => {
    // This is what actually happened: an account-suspended run reached a
    // "done"-looking turn via auto-resume, then committed the whole dirty
    // working tree and pushed it.
    const repo = createRepo("auth-failed-no-commit");
    const baseline = captureGitBaseline(repo);
    writeFileSync(path.join(repo, "unrelated-work-in-progress.txt"), "not mine to commit\n");
    const headBefore = git(repo, ["rev-parse", "HEAD"]);
    await seedRun({
      id: "run-auth-failed",
      repo,
      baseline,
      status: "failed",
      lastError: "Internal error: Failed to authenticate. API Error: 403 Account suspended",
      pushOnCommit: true,
      workerStatus: "error",
    });

    const result = await runMilestoneAutoCommit("run-auth-failed", "Looks finished.");

    expect(result?.status).toBe("skipped");
    expect(git(repo, ["rev-parse", "HEAD"])).toBe(headBefore);
    // And the conversation is told, rather than left to assume it pushed.
    const events = await db.select().from(executionEvents);
    expect(events.map((event) => event.eventType)).toEqual(["auto_commit_skipped"]);
    expect(events[0]?.detailsPreview ?? events[0]?.details ?? "").toContain("failed");
  });

  it("does not commit while recovery is still open for the conversation", async () => {
    const repo = createRepo("recovering-no-commit");
    const baseline = captureGitBaseline(repo);
    writeFileSync(path.join(repo, "feature.txt"), "implemented\n");
    const headBefore = git(repo, ["rev-parse", "HEAD"]);
    await seedRun({ id: "run-recovering", repo, baseline, workerStatus: "working" });
    const now = new Date();
    await db.insert(recoveryIncidents).values({
      id: "incident-open",
      runId: "run-recovering",
      workerId: "run-recovering-worker-1",
      kind: "session_missing",
      status: "recovering",
      autoAttemptCount: 1,
      detectedAt: now,
      updatedAt: now,
    });

    const result = await runMilestoneAutoCommit("run-recovering", "Looks finished.");

    expect(result?.status).toBe("skipped");
    expect(git(repo, ["rev-parse", "HEAD"])).toBe(headBefore);
  });

  it("does not commit when no healthy worker is driving the conversation", async () => {
    const repo = createRepo("cancelled-worker-no-commit");
    const baseline = captureGitBaseline(repo);
    writeFileSync(path.join(repo, "feature.txt"), "implemented\n");
    const headBefore = git(repo, ["rev-parse", "HEAD"]);
    await seedRun({ id: "run-no-worker", repo, baseline, workerStatus: "cancelled" });

    const result = await runMilestoneAutoCommit("run-no-worker", "Looks finished.");

    expect(result?.status).toBe("skipped");
    expect(git(repo, ["rev-parse", "HEAD"])).toBe(headBefore);
  });

  it("still commits for a healthy conversation whose worker is live", async () => {
    const repo = createRepo("healthy-commits");
    const baseline = captureGitBaseline(repo);
    writeFileSync(path.join(repo, "feature.txt"), "implemented\n");
    await seedRun({ id: "run-healthy", repo, baseline, workerStatus: "idle" });

    const result = await runMilestoneAutoCommit("run-healthy", "Direct run completed.");

    expect(result?.status).toBe("created");
    const events = await db.select().from(executionEvents);
    expect(events.map((event) => event.eventType)).toEqual(["auto_commit_created"]);
  });

  it("does not treat a transient error as a reason to withhold the commit", async () => {
    const repo = createRepo("transient-still-commits");
    const baseline = captureGitBaseline(repo);
    writeFileSync(path.join(repo, "feature.txt"), "implemented\n");
    await seedRun({
      id: "run-transient",
      repo,
      baseline,
      lastError: "Ask failed: read ECONNRESET",
      workerStatus: "idle",
    });

    const result = await runMilestoneAutoCommit("run-transient", "Direct run completed.");

    expect(result?.status).toBe("created");
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
    expect(git(repo, ["log", "-1", "--pretty=%s"])).toBe("Direct implementation");
    expect(git(repo, ["log", "-1", "--pretty=%B"])).not.toContain("OmniHarness");
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
