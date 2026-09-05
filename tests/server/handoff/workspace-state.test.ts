import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { collectHandoffWorkspaceState, computeWorkspaceFingerprint } from "@/server/handoff/workspace-state";

const roots: string[] = [];

function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omni-handoff-git-"));
  roots.push(root);
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: root });
  fs.writeFileSync(path.join(root, "tracked.txt"), "before\n");
  execFileSync("git", ["add", "tracked.txt"], { cwd: root });
  execFileSync("git", ["commit", "-qm", "initial"], { cwd: root });
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("handoff workspace state", () => {
  it("changes the fingerprint for tracked changes but ignores untracked churn", async () => {
    const root = makeRepo();
    const initial = await computeWorkspaceFingerprint(root);
    fs.writeFileSync(path.join(root, "scratch.log"), "one");
    expect(await computeWorkspaceFingerprint(root)).toBe(initial);
    fs.writeFileSync(path.join(root, "tracked.txt"), "after\n");
    expect(await computeWorkspaceFingerprint(root)).not.toBe(initial);
  });

  it("never derives the session file list from git status", async () => {
    const root = makeRepo();
    fs.writeFileSync(path.join(root, "tracked.txt"), "already dirty\n");
    const baseline = await collectHandoffWorkspaceState({ projectPath: root, baseline: null });
    fs.writeFileSync(path.join(root, "new.txt"), "new\n");
    const current = await collectHandoffWorkspaceState({ projectPath: root, baseline: {
      status: "ok",
      repoRoot: root,
      headSha: baseline.currentHead,
      clean: false,
      porcelain: " M tracked.txt",
    } });
    expect(current.modifiedFiles).toEqual([]);
    expect(current.untrackedFiles).toEqual([]);
    expect(current.dirtyBeforeSession).toBe(true);
  });
});
