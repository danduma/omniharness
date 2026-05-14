import { execFileSync } from "child_process";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { autoCommitMilestone, captureGitBaseline } from "@/server/git/auto-commit";

const GIT_AUTO_COMMIT_TEST_TIMEOUT_MS = 30_000;

function git(cwd: string, args: string[]) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function createTempDir(name: string) {
  return mkdtempSync(path.join(tmpdir(), `omni-${name}-`));
}

function createRepo(name: string) {
  const repo = createTempDir(name);
  git(repo, ["init"]);
  git(repo, ["config", "user.name", "OmniHarness Test"]);
  git(repo, ["config", "user.email", "omni@example.test"]);
  writeFileSync(path.join(repo, "README.md"), "# Test\n");
  git(repo, ["add", "README.md"]);
  git(repo, ["commit", "-m", "initial"]);
  return repo;
}

describe("autoCommitMilestone", () => {
  it("creates a commit when a clean baseline has changes", () => {
    const repo = createRepo("auto-commit");
    const baseline = captureGitBaseline(repo);
    writeFileSync(path.join(repo, "feature.txt"), "implemented\n");

    const result = autoCommitMilestone({
      cwd: repo,
      baseline,
      autoCommitMilestones: true,
      pushOnCommit: false,
      subject: "OmniHarness: test milestone",
      body: "run id: test-run",
    });

    expect(result.status).toBe("created");
    if (result.status !== "created") {
      throw new Error(`Expected created result, got ${result.status}`);
    }
    expect(result.commitSha).toMatch(/^[0-9a-f]{7,40}$/);
    expect(result.pushStatus).toBe("not_requested");
    expect(git(repo, ["log", "-1", "--pretty=%s"])).toBe("OmniHarness: test milestone");
    expect(git(repo, ["status", "--porcelain"])).toBe("");
  }, GIT_AUTO_COMMIT_TEST_TIMEOUT_MS);

  it("skips when the baseline was dirty", () => {
    const repo = createRepo("dirty-baseline");
    writeFileSync(path.join(repo, "dirty.txt"), "already dirty\n");
    const baseline = captureGitBaseline(repo);
    writeFileSync(path.join(repo, "feature.txt"), "implemented\n");

    const result = autoCommitMilestone({
      cwd: repo,
      baseline,
      autoCommitMilestones: true,
      pushOnCommit: false,
      subject: "OmniHarness: test milestone",
      body: "run id: test-run",
    });

    expect(result.status).toBe("skipped");
    if (result.status !== "skipped") {
      throw new Error(`Expected skipped result, got ${result.status}`);
    }
    expect(result.reason).toBe("dirty_baseline");
    expect(git(repo, ["log", "-1", "--pretty=%s"])).toBe("initial");
  }, GIT_AUTO_COMMIT_TEST_TIMEOUT_MS);

  it("skips when there are no changes", () => {
    const repo = createRepo("no-changes");
    const baseline = captureGitBaseline(repo);

    const result = autoCommitMilestone({
      cwd: repo,
      baseline,
      autoCommitMilestones: true,
      pushOnCommit: false,
      subject: "OmniHarness: test milestone",
      body: "run id: test-run",
    });

    expect(result.status).toBe("skipped");
    if (result.status !== "skipped") {
      throw new Error(`Expected skipped result, got ${result.status}`);
    }
    expect(result.reason).toBe("no_changes");
    expect(git(repo, ["log", "-1", "--pretty=%s"])).toBe("initial");
  }, GIT_AUTO_COMMIT_TEST_TIMEOUT_MS);

  it("pushes after creating a commit when push on commit is enabled", () => {
    const remote = createTempDir("remote");
    git(remote, ["init", "--bare"]);
    const repo = createRepo("push-on-commit");
    git(repo, ["remote", "add", "origin", remote]);
    git(repo, ["push", "-u", "origin", "HEAD"]);
    const baseline = captureGitBaseline(repo);
    writeFileSync(path.join(repo, "feature.txt"), "implemented\n");

    const result = autoCommitMilestone({
      cwd: repo,
      baseline,
      autoCommitMilestones: true,
      pushOnCommit: true,
      subject: "OmniHarness: pushed milestone",
      body: "run id: test-run",
    });

    expect(result.status).toBe("created");
    if (result.status !== "created") {
      throw new Error(`Expected created result, got ${result.status}`);
    }
    expect(result.pushStatus).toBe("pushed");
    expect(git(remote, ["log", "-1", "--pretty=%s"])).toBe("OmniHarness: pushed milestone");
  }, GIT_AUTO_COMMIT_TEST_TIMEOUT_MS);

  it("reports push failure without hiding the commit", () => {
    const repo = createRepo("push-failure");
    const baseline = captureGitBaseline(repo);
    writeFileSync(path.join(repo, "feature.txt"), "implemented\n");

    const result = autoCommitMilestone({
      cwd: repo,
      baseline,
      autoCommitMilestones: true,
      pushOnCommit: true,
      subject: "OmniHarness: unpushed milestone",
      body: "run id: test-run",
    });

    expect(result.status).toBe("created");
    if (result.status !== "created") {
      throw new Error(`Expected created result, got ${result.status}`);
    }
    expect(result.pushStatus).toBe("failed");
    expect(result.pushError).toContain("fatal");
    expect(git(repo, ["log", "-1", "--pretty=%s"])).toBe("OmniHarness: unpushed milestone");
  }, GIT_AUTO_COMMIT_TEST_TIMEOUT_MS);
});
