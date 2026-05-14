import fs from "fs";
import path from "path";
import type {
  GitRepositoryIdentity,
  GitWorkspaceTarget,
  GitWorkspaceWarning,
  PendingOrphanWorktreeRecovery,
} from "@/lib/git-workspace";

export interface ProjectGitWorkspaceConfig {
  defaultTarget?: GitWorkspaceTarget;
  worktreeParent?: string;
  pendingOrphanWorktrees?: PendingOrphanWorktreeRecovery[];
}

export interface ProjectConfig {
  version: 1;
  supervisor?: {
    memoryEnabled?: boolean;
  };
  git?: {
    workspace?: ProjectGitWorkspaceConfig;
  };
}

export const PROJECT_CONFIG_VERSION = 1;
const PROJECT_CONFIG_DIRNAME = ".omniharness";
const PROJECT_CONFIG_FILENAME = "config.json";

export function getProjectOmniharnessDir(projectPath: string) {
  return path.join(projectPath, PROJECT_CONFIG_DIRNAME);
}

export function getProjectConfigPath(projectPath: string) {
  return path.join(getProjectOmniharnessDir(projectPath), PROJECT_CONFIG_FILENAME);
}

export function readProjectConfig(projectPath: string): ProjectConfig {
  if (!projectPath) {
    return { version: PROJECT_CONFIG_VERSION };
  }

  const configPath = getProjectConfigPath(projectPath);
  if (!fs.existsSync(configPath)) {
    return { version: PROJECT_CONFIG_VERSION };
  }

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return { version: PROJECT_CONFIG_VERSION };
    }
    const candidate = parsed as Record<string, unknown>;
    return {
      version: PROJECT_CONFIG_VERSION,
      supervisor: typeof candidate.supervisor === "object" && candidate.supervisor !== null
        ? (candidate.supervisor as ProjectConfig["supervisor"])
        : undefined,
      git: typeof candidate.git === "object" && candidate.git !== null
        ? (candidate.git as ProjectConfig["git"])
        : undefined,
    };
  } catch {
    return { version: PROJECT_CONFIG_VERSION };
  }
}

export function writeProjectConfig(projectPath: string, next: ProjectConfig) {
  if (!projectPath) {
    throw new Error("writeProjectConfig requires a non-empty projectPath");
  }

  const dir = getProjectOmniharnessDir(projectPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const configPath = getProjectConfigPath(projectPath);
  const serialized = JSON.stringify({ ...next, version: PROJECT_CONFIG_VERSION }, null, 2);
  fs.writeFileSync(configPath, `${serialized}\n`, "utf8");
}

function getNested(obj: Record<string, unknown> | undefined, dottedKey: string): unknown {
  if (!obj) {
    return undefined;
  }

  const parts = dottedKey.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setNested(obj: Record<string, unknown>, dottedKey: string, value: unknown) {
  const parts = dottedKey.split(".");
  let current: Record<string, unknown> = obj;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    const existing = current[part];
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

export function getProjectSetting<T>(projectPath: string, dottedKey: string, defaultValue: T): T {
  if (!projectPath) {
    return defaultValue;
  }

  const config = readProjectConfig(projectPath) as unknown as Record<string, unknown>;
  const value = getNested(config, dottedKey);
  if (value === undefined) {
    return defaultValue;
  }

  return value as T;
}

export function setProjectSetting(projectPath: string, dottedKey: string, value: unknown) {
  if (!projectPath) {
    throw new Error("setProjectSetting requires a non-empty projectPath");
  }

  const config = readProjectConfig(projectPath) as unknown as Record<string, unknown>;
  setNested(config, dottedKey, value);
  writeProjectConfig(projectPath, config as unknown as ProjectConfig);
}

export function isProjectMemoryEnabled(projectPath: string | null | undefined): boolean {
  if (!projectPath) {
    return false;
  }

  const value = getProjectSetting<boolean>(projectPath, "supervisor.memoryEnabled", true);
  return value !== false;
}

export function getProjectGitWorkspaceConfig(projectPath: string): ProjectGitWorkspaceConfig {
  return getProjectSetting<ProjectGitWorkspaceConfig>(projectPath, "git.workspace", {});
}

export function setProjectGitWorkspaceDefaultTarget(projectPath: string, target: GitWorkspaceTarget) {
  setProjectSetting(projectPath, "git.workspace.defaultTarget", target);
}

export function setProjectGitWorkspaceParent(projectPath: string, worktreeParent: string | undefined) {
  setProjectSetting(projectPath, "git.workspace.worktreeParent", worktreeParent);
}

export function addProjectGitWorkspacePendingOrphan(
  projectPath: string,
  orphan: PendingOrphanWorktreeRecovery,
) {
  const existing = getProjectGitWorkspaceConfig(projectPath).pendingOrphanWorktrees ?? [];
  const withoutDuplicate = existing.filter((candidate) => candidate.checkoutPath !== orphan.checkoutPath);
  setProjectSetting(projectPath, "git.workspace.pendingOrphanWorktrees", [...withoutDuplicate, orphan]);
}

export function resolveProjectGitWorkspaceDefault(
  projectPath: string,
  identity: GitRepositoryIdentity,
  fallbackTarget: GitWorkspaceTarget,
): {
  target: GitWorkspaceTarget;
  savedTarget: GitWorkspaceTarget | null;
  warning: GitWorkspaceWarning | null;
} {
  const savedTarget = getProjectGitWorkspaceConfig(projectPath).defaultTarget ?? null;
  if (!savedTarget) {
    return { target: fallbackTarget, savedTarget: null, warning: null };
  }
  if (savedTarget.gitCommonDir !== identity.gitCommonDir) {
    return {
      target: fallbackTarget,
      savedTarget,
      warning: {
        code: "stale_workspace_target",
        message: "Saved workspace target belongs to a different repository.",
        details: {
          savedGitCommonDir: savedTarget.gitCommonDir,
          currentGitCommonDir: identity.gitCommonDir,
        },
      },
    };
  }
  return { target: savedTarget, savedTarget, warning: null };
}
