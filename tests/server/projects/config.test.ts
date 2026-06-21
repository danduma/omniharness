import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getProjectGitWorkspaceConfig,
  getProjectConfigPath,
  getProjectSetting,
  isProjectMemoryEnabled,
  readProjectConfig,
  resolveProjectGitWorkspaceDefault,
  setProjectGitWorkspaceDefaultTarget,
  setProjectGitWorkspaceParent,
  setProjectSetting,
  writeProjectConfig,
} from "@/server/projects/config";
import { GitWorkspaceTarget } from "@/lib/git-workspace";

let projectPath: string;

beforeEach(() => {
  projectPath = fs.mkdtempSync(path.join(os.tmpdir(), "omniharness-config-"));
});

afterEach(() => {
  fs.rmSync(projectPath, { recursive: true, force: true });
});

describe("project config", () => {
  it("returns an empty config when the file is missing", () => {
    const config = readProjectConfig(projectPath);
    expect(config).toEqual({ version: 1 });
  });

  it("creates .omniharness/ lazily on write", () => {
    writeProjectConfig(projectPath, { version: 1, supervisor: { memoryEnabled: false } });
    expect(fs.existsSync(getProjectConfigPath(projectPath))).toBe(true);
    const config = readProjectConfig(projectPath);
    expect(config.supervisor?.memoryEnabled).toBe(false);
  });

  it("creates a project .gitignore entry when .omniharness/ is first created", () => {
    writeProjectConfig(projectPath, { version: 1, supervisor: { memoryEnabled: false } });

    expect(fs.readFileSync(path.join(projectPath, ".gitignore"), "utf8")).toBe(".omniharness/\n");
  });

  it("adds .omniharness/ to an existing project .gitignore on first creation", () => {
    fs.writeFileSync(path.join(projectPath, ".gitignore"), "node_modules/\n", "utf8");

    writeProjectConfig(projectPath, { version: 1, supervisor: { memoryEnabled: false } });

    expect(fs.readFileSync(path.join(projectPath, ".gitignore"), "utf8")).toBe("node_modules/\n.omniharness/\n");
  });

  it("does not duplicate an existing project .gitignore entry", () => {
    fs.writeFileSync(path.join(projectPath, ".gitignore"), "node_modules/\n.omniharness/\n", "utf8");

    writeProjectConfig(projectPath, { version: 1, supervisor: { memoryEnabled: false } });

    expect(fs.readFileSync(path.join(projectPath, ".gitignore"), "utf8")).toBe("node_modules/\n.omniharness/\n");
  });

  it("treats malformed JSON as empty config", () => {
    fs.mkdirSync(path.join(projectPath, ".omniharness"), { recursive: true });
    fs.writeFileSync(getProjectConfigPath(projectPath), "not json", "utf8");
    expect(readProjectConfig(projectPath)).toEqual({ version: 1 });
  });

  it("supports dotted getters and setters", () => {
    setProjectSetting(projectPath, "supervisor.memoryEnabled", false);
    expect(getProjectSetting(projectPath, "supervisor.memoryEnabled", true)).toBe(false);
    setProjectSetting(projectPath, "supervisor.memoryEnabled", true);
    expect(getProjectSetting(projectPath, "supervisor.memoryEnabled", false)).toBe(true);
  });

  it("returns the default for unset keys", () => {
    expect(getProjectSetting(projectPath, "supervisor.memoryEnabled", true)).toBe(true);
    expect(getProjectSetting(projectPath, "supervisor.memoryEnabled", false)).toBe(false);
  });

  it("isProjectMemoryEnabled defaults to true when no config", () => {
    expect(isProjectMemoryEnabled(projectPath)).toBe(true);
  });

  it("isProjectMemoryEnabled respects an explicit false", () => {
    setProjectSetting(projectPath, "supervisor.memoryEnabled", false);
    expect(isProjectMemoryEnabled(projectPath)).toBe(false);
  });

  it("isProjectMemoryEnabled returns false when no project path is given", () => {
    expect(isProjectMemoryEnabled(null)).toBe(false);
    expect(isProjectMemoryEnabled("")).toBe(false);
  });

  it("persists git workspace defaults under project config", () => {
    const target: GitWorkspaceTarget = {
      kind: "worktree",
      repoRoot: "/repo",
      gitCommonDir: "/repo/.git",
      checkoutPath: "/repo-feature",
      branchName: "feature/test",
      worktreeId: "/repo-feature",
    };

    setProjectGitWorkspaceDefaultTarget(projectPath, target);
    setProjectGitWorkspaceParent(projectPath, "/worktrees");

    expect(getProjectGitWorkspaceConfig(projectPath)).toEqual({
      defaultTarget: target,
      worktreeParent: "/worktrees",
    });
  });

  it("falls back when a persisted git workspace target belongs to a different repository", () => {
    const savedTarget: GitWorkspaceTarget = {
      kind: "worktree",
      repoRoot: "/repo",
      gitCommonDir: "/repo/.git",
      checkoutPath: "/repo-feature",
      branchName: "feature/test",
      worktreeId: "/repo-feature",
    };
    const fallbackTarget: GitWorkspaceTarget = {
      kind: "current_checkout",
      repoRoot: "/other",
      gitCommonDir: "/other/.git",
      checkoutPath: "/other",
      branchName: "main",
      worktreeId: null,
    };
    setProjectGitWorkspaceDefaultTarget(projectPath, savedTarget);

    const resolved = resolveProjectGitWorkspaceDefault(projectPath, {
      repoRoot: "/other",
      gitCommonDir: "/other/.git",
    }, fallbackTarget);

    expect(resolved.target).toBe(fallbackTarget);
    expect(resolved.savedTarget).toEqual(savedTarget);
    expect(resolved.warning?.code).toBe("stale_workspace_target");
    expect(getProjectGitWorkspaceConfig(projectPath).defaultTarget).toEqual(savedTarget);
  });
});
