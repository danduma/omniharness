import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { execFileSync } from "child_process";
import fs from "fs";
import { mkdtemp } from "fs/promises";
import os from "os";
import path from "path";
import { unlockApp } from "./helpers";

function git(cwd: string, args: string[]) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function createRepo(name: string) {
  const repo = fs.realpathSync.native(await mkdtemp(path.join(os.tmpdir(), `omni-e2e-${name}-`)));
  git(repo, ["init"]);
  git(repo, ["config", "user.name", "OmniHarness E2E"]);
  git(repo, ["config", "user.email", "omni-e2e@example.test"]);
  fs.writeFileSync(path.join(repo, "README.md"), "# E2E\n", "utf8");
  git(repo, ["add", "README.md"]);
  git(repo, ["commit", "-m", "initial"]);
  git(repo, ["branch", "next"]);
  return repo;
}

async function createConflictedRepo(name: string) {
  const repo = await createRepo(name);
  git(repo, ["checkout", "-b", "conflict-side"]);
  fs.writeFileSync(path.join(repo, "README.md"), "# Side\n", "utf8");
  git(repo, ["add", "README.md"]);
  git(repo, ["commit", "-m", "side"]);
  git(repo, ["checkout", "-"]);
  fs.writeFileSync(path.join(repo, "README.md"), "# Main\n", "utf8");
  git(repo, ["add", "README.md"]);
  git(repo, ["commit", "-m", "main"]);
  try {
    git(repo, ["merge", "conflict-side"]);
  } catch {
    // Expected: leave the temp repository in an unmerged conflicted state.
  }
  return repo;
}

let originalProjectsValue: string | null = null;
const testOrigin = "http://127.0.0.1:4010";

type E2ERunRecord = {
  id: string;
  projectPath?: string | null;
  gitWorkspaceJson?: string | null;
};

type E2EGitStatusResponse = {
  snapshot?: unknown;
};

function projectUrl(repo: string) {
  return `/?project=${encodeURIComponent(repo)}`;
}

async function rememberOriginalProjects(request: APIRequestContext) {
  if (originalProjectsValue !== null) {
    return originalProjectsValue;
  }

  const response = await request.get("/api/settings");
  expect(response.ok()).toBe(true);
  const payload = await response.json() as { values?: { PROJECTS?: string } };
  originalProjectsValue = payload.values?.PROJECTS ?? "[]";
  return originalProjectsValue;
}

async function restoreOriginalProjects(request: APIRequestContext) {
  if (originalProjectsValue === null) {
    return;
  }

  await postProjectsSetting(request, originalProjectsValue);
}

function withTestProject(repo: string) {
  return JSON.stringify([repo]);
}

async function postProjectsSetting(request: APIRequestContext, projectsValue: string) {
  let lastFailure = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await request.post("/api/settings", {
      headers: { origin: testOrigin },
      data: { PROJECTS: projectsValue },
    });
    if (response.ok()) {
      return;
    }
    lastFailure = await response.text().catch(() => `HTTP ${response.status()}`);
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw new Error(`Failed to save test PROJECTS setting: ${lastFailure}`);
}

async function loadGitStatusSnapshot(request: APIRequestContext, repo: string) {
  let lastFailure = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await request.post("/api/git", {
      headers: { origin: testOrigin },
      data: { operation: "status", projectPath: repo },
    });
    if (response.ok()) {
      const payload = await response.json() as E2EGitStatusResponse;
      expect(payload.snapshot).toBeTruthy();
      return payload.snapshot;
    }
    lastFailure = await response.text().catch(() => `HTTP ${response.status()}`);
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw new Error(`Failed to load git status for ${repo}: ${lastFailure}`);
}

async function openProject(page: Page, repo: string, options: { mode?: "direct" | "planning" | "implementation" } = {}) {
  await rememberOriginalProjects(page.request);
  await postProjectsSetting(page.request, withTestProject(repo));
  const snapshot = await loadGitStatusSnapshot(page.request, repo);
  if (options.mode) {
    await page.addInitScript(({ mode, projectPath, gitSnapshot }) => {
      window.localStorage.setItem("omni-git-workspace-cache:v1", JSON.stringify({
        projects: {
          [projectPath]: {
            snapshot: gitSnapshot,
            savedAt: new Date().toISOString(),
          },
        },
      }));
      window.localStorage.setItem("omni-composer-mode", mode);
    }, { mode: options.mode, projectPath: repo, gitSnapshot: snapshot });
  } else {
    await page.addInitScript(({ projectPath, gitSnapshot }) => {
      window.localStorage.setItem("omni-git-workspace-cache:v1", JSON.stringify({
        projects: {
          [projectPath]: {
            snapshot: gitSnapshot,
            savedAt: new Date().toISOString(),
          },
        },
      }));
    }, { projectPath: repo, gitSnapshot: snapshot });
  }
  await unlockApp(page, projectUrl(repo));
  const newConversationButton = page.getByRole("button", { name: `New conversation in ${path.basename(repo)}` });
  if (await newConversationButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await newConversationButton.click();
  }
  await expect(page.locator("[data-composer-input='true']")).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("button", { name: "Choose branch or workspace" })).toBeEnabled({ timeout: 30000 });
}

async function openWorkspaceMenu(page: Page) {
  const button = page.getByRole("button", { name: "Choose branch or workspace" });
  const currentWorkspace = page.getByText("Current workspace", { exact: true });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await button.click();
    if (await currentWorkspace.isVisible({ timeout: 1500 }).catch(() => false)) {
      return;
    }
  }
  await expect(currentWorkspace).toBeVisible();
}

async function workspaceMenuText(page: Page) {
  await openWorkspaceMenu(page);
  return page.getByRole("menu", { name: "Choose branch or workspace" }).innerText();
}

async function findRunForWorkspace(page: Page, checkoutPath: string) {
  const response = await page.request.get("/api/events?snapshot=1&persisted=1");
  expect(response.ok()).toBe(true);
  const payload = await response.json() as { runs?: E2ERunRecord[] };
  return (payload.runs ?? []).find((run) => {
    return run.projectPath === checkoutPath || run.gitWorkspaceJson?.includes(checkoutPath);
  })?.id ?? "";
}

test.describe("approval-gated branch workspace journeys", () => {
  test.setTimeout(180000);

  test.afterEach(async ({ request }) => {
    await restoreOriginalProjects(request);
  });

  test("discovers the branch button and opens a real git status selector", async ({ page }) => {
    const repo = await createRepo("discovery");
    await openProject(page, repo, { mode: "direct" });

    await openWorkspaceMenu(page);

    await expect(page.getByText("Current workspace")).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Refresh git status/ })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Start in new worktree/ })).toBeVisible();
    await expect(page.getByText("Branches", { exact: true })).toBeVisible();
    await expect(page.getByText("Worktrees", { exact: true })).toBeVisible();
  });

  test("starts a run in a confirmed new branch-backed worktree without changing the parent checkout", async ({ page }) => {
    const repo = await createRepo("start-new-worktree");
    const beforeBranch = git(repo, ["rev-parse", "--abbrev-ref", "HEAD"]);
    const branchName = "feature/e2e-start-worktree";
    const checkoutPath = path.join(path.dirname(repo), `${path.basename(repo)}-feature-e2e-start-worktree`);

    await openProject(page, repo, { mode: "direct" });
    await page.locator("[data-composer-input='true']").fill("Verify this run is pinned to its new worktree.");
    await openWorkspaceMenu(page);
    const startWorktreeItem = page.getByRole("menuitem", { name: /Start in new worktree/ });
    await expect(startWorktreeItem).not.toHaveAttribute("aria-disabled", "true", { timeout: 60000 });
    await startWorktreeItem.click();
    await expect(page.getByRole("dialog", { name: "Start in new worktree" })).toBeVisible();
    await page.getByLabel("Branch name").fill(branchName);
    await page.getByLabel("Checkout path").fill(checkoutPath);
    await page.getByRole("button", { name: "Use for next prompt" }).click();

    expect(fs.existsSync(checkoutPath)).toBe(false);

    await page.getByRole("button", { name: "Send message" }).click();

    let createdRunId = "";
    await expect.poll(async () => {
      createdRunId = await findRunForWorkspace(page, checkoutPath);
      return createdRunId;
    }, { timeout: 120000 }).not.toBe("");

    await page.goto(`/session/${createdRunId}`);
    await expect(page.getByLabel(`Run workspace: ${branchName} at ${checkoutPath}`)).toBeVisible({ timeout: 120000 });
    expect(fs.existsSync(checkoutPath)).toBe(true);
    expect(git(checkoutPath, ["rev-parse", "--abbrev-ref", "HEAD"])).toBe(branchName);
    expect(git(repo, ["rev-parse", "--abbrev-ref", "HEAD"])).toBe(beforeBranch);
  });

  test("blocks dirty checkout and dirty worktree removal in the UI while preserving HEAD", async ({ page }) => {
    const repo = await createRepo("dirty-safety");
    const beforeBranch = git(repo, ["rev-parse", "--abbrev-ref", "HEAD"]);
    const worktreePath = path.join(path.dirname(repo), `${path.basename(repo)}-next`);
    git(repo, ["worktree", "add", worktreePath, "next"]);
    fs.writeFileSync(path.join(repo, "dirty.txt"), "dirty parent\n", "utf8");
    fs.writeFileSync(path.join(worktreePath, "dirty.txt"), "dirty worktree\n", "utf8");

    await openProject(page, repo, { mode: "direct" });
    await expect.poll(() => workspaceMenuText(page), { timeout: 60000 }).toContain("1 dirty");
    await openWorkspaceMenu(page);
    await expect(page.getByRole("button", { name: "Checkout" }).first()).toBeDisabled();
    await expect(page.getByRole("button", { name: "Remove worktree" }).nth(1)).toBeDisabled();
    await expect(page.getByText("Checkout branch")).toBeHidden();

    expect(git(repo, ["rev-parse", "--abbrev-ref", "HEAD"])).toBe(beforeBranch);
    expect(fs.existsSync(worktreePath)).toBe(true);
  });

  test("shows conflicted state and disables unsafe workspace operations", async ({ page }) => {
    const repo = await createConflictedRepo("conflict-safety");
    const beforeBranch = git(repo, ["rev-parse", "--abbrev-ref", "HEAD"]);

    await openProject(page, repo, { mode: "direct" });
    await expect.poll(() => workspaceMenuText(page), {
      timeout: 60000,
    }).toContain("conflicted");
    await openWorkspaceMenu(page);
    await expect(page.getByRole("menuitem", { name: /Start in new worktree/ })).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByRole("button", { name: "Checkout" }).first()).toBeDisabled();
    await expect(page.getByRole("button", { name: "New worktree" }).first()).toBeDisabled();
    await expect(page.getByText("Start in new worktree").first()).toBeVisible();

    expect(git(repo, ["rev-parse", "--abbrev-ref", "HEAD"])).toBe(beforeBranch);
  });
});
