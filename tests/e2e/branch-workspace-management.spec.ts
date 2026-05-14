import { test, expect, type Page } from "@playwright/test";
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

function projectUrl(repo: string) {
  return `/?project=${encodeURIComponent(repo)}`;
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

test.describe("approval-gated branch workspace journeys", () => {
  test.setTimeout(90000);

  test("discovers the branch button and opens a real git status selector", async ({ page }) => {
    const repo = await createRepo("discovery");
    await unlockApp(page, projectUrl(repo));

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

    await unlockApp(page, projectUrl(repo));
    await page.locator("[data-composer-input='true']").fill("Verify this run is pinned to its new worktree.");
    await openWorkspaceMenu(page);
    await page.getByRole("menuitem", { name: /Start in new worktree/ }).click();
    await expect(page.getByRole("dialog", { name: "Start in new worktree" })).toBeVisible();
    await page.getByLabel("Branch name").fill(branchName);
    await page.getByLabel("Checkout path").fill(checkoutPath);
    await page.getByRole("button", { name: "Use for next prompt" }).click();

    expect(fs.existsSync(checkoutPath)).toBe(false);

    await page.getByRole("button", { name: "Send message" }).click();

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

    await unlockApp(page, projectUrl(repo));
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

    await unlockApp(page, projectUrl(repo));
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
