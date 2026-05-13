import { execFileSync } from "child_process";
import fs from "fs";
import { mkdtemp, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/git/route";
import { getGitWorkspaceSnapshot } from "@/server/git/workspaces";
import { getProjectGitWorkspaceConfig } from "@/server/projects/config";

function git(cwd: string, args: string[]) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function createRepo(name: string) {
  const repo = fs.realpathSync.native(await mkdtemp(path.join(tmpdir(), `omni-api-git-${name}-`)));
  git(repo, ["init"]);
  git(repo, ["config", "user.name", "OmniHarness Test"]);
  git(repo, ["config", "user.email", "omni@example.test"]);
  await writeFile(path.join(repo, "README.md"), "# Test\n", "utf8");
  git(repo, ["add", "README.md"]);
  git(repo, ["commit", "-m", "initial"]);
  git(repo, ["branch", "next"]);
  return repo;
}

function request(body: unknown) {
  return new NextRequest("http://localhost/api/git", {
    method: "POST",
    headers: {
      origin: "http://localhost",
    },
    body: JSON.stringify(body),
  });
}

describe("/api/git", () => {
  it("returns a git workspace status snapshot", async () => {
    const repo = await createRepo("status");
    const response = await POST(request({
      operation: "status",
      projectPath: repo,
    }));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.snapshot.repoRoot).toBe(repo);
    expect(payload.snapshot.branches.map((branch: { name: string }) => branch.name)).toContain("next");
  });

  it("rejects stale create-worktree mutations with structured git workspace errors", async () => {
    const repo = await createRepo("stale");
    const before = await getGitWorkspaceSnapshot(repo);
    await writeFile(path.join(repo, "dirty.txt"), "dirty\n", "utf8");

    const response = await POST(request({
      operation: "prepare_session_worktree",
      projectPath: repo,
      newBranchName: "feature/api-stale",
      checkoutPath: path.join(path.dirname(repo), `${path.basename(repo)}-feature`),
      expectedHeadSha: before.headSha,
      expectedStatusFingerprint: before.statusFingerprint,
    }));

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.error.source).toBe("Git workspace");
    expect(payload.error.action).toBe("Prepare session worktree");
    expect(payload.error.details).toContain("code: stale_status");
  });

  it("persists selected workspace targets in project config after validation", async () => {
    const repo = await createRepo("select");
    const snapshot = await getGitWorkspaceSnapshot(repo);
    const target = {
      kind: "current_checkout",
      repoRoot: snapshot.repoRoot,
      gitCommonDir: snapshot.gitCommonDir,
      checkoutPath: snapshot.checkoutPath,
      branchName: snapshot.branchName,
      worktreeId: null,
    };

    const response = await POST(request({
      operation: "select",
      projectPath: repo,
      target,
    }));

    expect(response.status).toBe(200);
    expect(getProjectGitWorkspaceConfig(repo).defaultTarget).toEqual(target);
  });
});
