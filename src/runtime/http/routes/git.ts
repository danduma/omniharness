import { buildAppError } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { GitCommandError } from "@/server/git/command";
import {
  checkoutExistingBranch,
  createBranchWorktree,
  createWorktreeForExistingBranch,
  getGitWorkspaceSnapshot,
  GitWorkspaceError,
  removeWorktree,
  validateWorkspaceTarget,
} from "@/server/git/workspaces";
import { setProjectGitWorkspaceDefaultTarget } from "@/server/projects/config";
import { forkRunIntoWorktree } from "@/server/runs/recovery";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { toNextRequest } from "./next-request";

type GitOperation =
  | "status"
  | "select"
  | "checkout_existing_branch"
  | "prepare_session_worktree"
  | "create_worktree_existing_branch"
  | "fork_run_worktree"
  | "remove_worktree";

const ACTION_LABELS: Record<GitOperation, string> = {
  status: "Refresh git status",
  select: "Select workspace",
  checkout_existing_branch: "Checkout existing branch",
  prepare_session_worktree: "Prepare session worktree",
  create_worktree_existing_branch: "Create worktree for existing branch",
  fork_run_worktree: "Fork run into worktree",
  remove_worktree: "Remove worktree",
};

function parseOperation(value: unknown): GitOperation {
  if (
    value === "status"
    || value === "select"
    || value === "checkout_existing_branch"
    || value === "prepare_session_worktree"
    || value === "create_worktree_existing_branch"
    || value === "fork_run_worktree"
    || value === "remove_worktree"
  ) {
    return value;
  }
  throw new GitWorkspaceError("invalid_operation", "Unsupported git workspace operation.");
}

function readString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new GitWorkspaceError("invalid_request", `${key} is required.`);
  }
  return value;
}

function readOptionalString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readNullableString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    throw new GitWorkspaceError("invalid_request", `${key} must be a string or null.`);
  }
  return value;
}

function gitErrorResponse(error: unknown, action: string) {
  const status = error instanceof GitWorkspaceError && (
    error.code.startsWith("stale_")
    || error.code.includes("dirty")
    || error.code.includes("conflicted")
    || error.code === "branch_checked_out_elsewhere"
    || error.code === "pending_orphan_worktree"
  ) ? 409 : 400;
  const details = [
    error instanceof GitWorkspaceError ? `code: ${error.code}` : null,
    error instanceof GitWorkspaceError && Object.keys(error.details).length > 0
      ? `details: ${JSON.stringify(error.details)}`
      : null,
    error instanceof GitCommandError ? `git: ${["git", ...error.args].join(" ")}` : null,
    error instanceof GitCommandError && error.exitCode !== null ? `exit: ${error.exitCode}` : null,
    error instanceof GitCommandError && error.stderr ? `stderr: ${error.stderr.trim()}` : null,
  ].filter((detail): detail is string => Boolean(detail));

  return Response.json({
    error: buildAppError(error, {
      status,
      source: "Git workspace",
      action,
      details,
    }),
  }, { status });
}

export const handleGitRequest: OmniHttpHandler = async (request) => {
  let operation: GitOperation = "status";
  try {
    if (request.method !== "POST") {
      return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
        status: 405,
        headers: { allow: "POST" },
      });
    }

    const body = await request.json() as Record<string, unknown>;
    operation = parseOperation(body.operation);
    const auth = await requireApiSession(toNextRequest(request), {
      source: "Git workspace",
      action: ACTION_LABELS[operation],
      enforceSameOrigin: operation !== "status",
    });
    if (auth.response) {
      return auth.response;
    }

    if (operation === "status") {
      const snapshot = await getGitWorkspaceSnapshot(readString(body, "projectPath"));
      return Response.json({ snapshot });
    }

    if (operation === "select") {
      const projectPath = readString(body, "projectPath");
      const target = body.target;
      if (!target || typeof target !== "object") {
        throw new GitWorkspaceError("invalid_target", "Workspace target is required.");
      }
      const snapshot = await validateWorkspaceTarget(target as Parameters<typeof validateWorkspaceTarget>[0]);
      setProjectGitWorkspaceDefaultTarget(projectPath, target as Parameters<typeof validateWorkspaceTarget>[0]);
      return Response.json({ target, snapshot });
    }

    if (operation === "checkout_existing_branch") {
      const projectPath = readString(body, "projectPath");
      const result = await checkoutExistingBranch({
        projectPath,
        branchName: readString(body, "branchName"),
        expectedHeadSha: readNullableString(body, "expectedHeadSha"),
        expectedStatusFingerprint: readString(body, "expectedStatusFingerprint"),
        allowDirty: body.allowDirty === true,
      });
      setProjectGitWorkspaceDefaultTarget(projectPath, result.target);
      return Response.json(result);
    }

    if (operation === "prepare_session_worktree") {
      const projectPath = readString(body, "projectPath");
      const result = await createBranchWorktree({
        projectPath,
        newBranchName: readString(body, "newBranchName"),
        checkoutPath: readString(body, "checkoutPath"),
        startPoint: readOptionalString(body, "startPoint"),
        worktreeParent: readOptionalString(body, "worktreeParent"),
        expectedHeadSha: readNullableString(body, "expectedHeadSha"),
        expectedStatusFingerprint: readString(body, "expectedStatusFingerprint"),
      });
      setProjectGitWorkspaceDefaultTarget(projectPath, result.target);
      return Response.json(result);
    }

    if (operation === "create_worktree_existing_branch") {
      const projectPath = readString(body, "projectPath");
      const result = await createWorktreeForExistingBranch({
        projectPath,
        branchName: readString(body, "branchName"),
        newBranchName: readString(body, "branchName"),
        checkoutPath: readString(body, "checkoutPath"),
        worktreeParent: readOptionalString(body, "worktreeParent"),
        expectedHeadSha: readNullableString(body, "expectedHeadSha"),
        expectedStatusFingerprint: readString(body, "expectedStatusFingerprint"),
      });
      setProjectGitWorkspaceDefaultTarget(projectPath, result.target);
      return Response.json(result);
    }

    if (operation === "fork_run_worktree") {
      const result = await forkRunIntoWorktree({
        runId: readString(body, "runId"),
        targetMessageId: readOptionalString(body, "targetMessageId"),
        contentOverride: readOptionalString(body, "contentOverride"),
        newBranchName: readString(body, "newBranchName"),
        checkoutPath: readString(body, "checkoutPath"),
        startPoint: readOptionalString(body, "startPoint"),
        worktreeParent: readOptionalString(body, "worktreeParent"),
        expectedHeadSha: readNullableString(body, "expectedHeadSha"),
        expectedStatusFingerprint: readString(body, "expectedStatusFingerprint"),
      });
      return Response.json(result);
    }

    const result = await removeWorktree({
      projectPath: readString(body, "projectPath"),
      checkoutPath: readString(body, "checkoutPath"),
      expectedHeadSha: readNullableString(body, "expectedHeadSha"),
      expectedStatusFingerprint: readString(body, "expectedStatusFingerprint"),
      pruneOnly: body.pruneOnly === true,
    });
    return Response.json(result);
  } catch (error) {
    return gitErrorResponse(error, ACTION_LABELS[operation]);
  }
};
