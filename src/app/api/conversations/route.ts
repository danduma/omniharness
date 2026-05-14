import { NextRequest, NextResponse } from "next/server";
import { ensureSupervisorRuntimeStarted } from "@/server/supervisor/runtime-watchdog";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { createConversation } from "@/server/conversations/create";
import { normalizeConversationMode } from "@/server/conversations/modes";
import { normalizeChatAttachments } from "@/lib/chat-attachments";
import type { GitWorkspaceTarget } from "@/lib/git-workspace";
import { GitWorkspaceError } from "@/server/git/workspaces";

function readGitWorkspaceTarget(value: unknown): GitWorkspaceTarget | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<GitWorkspaceTarget>;
  if (
    (candidate.kind === "current_checkout" || candidate.kind === "worktree")
    && typeof candidate.repoRoot === "string"
    && typeof candidate.gitCommonDir === "string"
    && typeof candidate.checkoutPath === "string"
    && (typeof candidate.branchName === "string" || candidate.branchName === null)
    && (typeof candidate.worktreeId === "string" || candidate.worktreeId === null)
  ) {
    return candidate as GitWorkspaceTarget;
  }
  return null;
}

function readGitWorkspaceLaunch(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.mode !== "new_worktree") {
    return null;
  }
  if (
    typeof candidate.projectPath !== "string"
    || typeof candidate.newBranchName !== "string"
    || typeof candidate.checkoutPath !== "string"
    || typeof candidate.expectedStatusFingerprint !== "string"
    || !(typeof candidate.expectedHeadSha === "string" || candidate.expectedHeadSha === null)
  ) {
    return null;
  }
  return {
    mode: "new_worktree" as const,
    projectPath: candidate.projectPath,
    newBranchName: candidate.newBranchName,
    checkoutPath: candidate.checkoutPath,
    startPoint: typeof candidate.startPoint === "string" ? candidate.startPoint : undefined,
    worktreeParent: typeof candidate.worktreeParent === "string" ? candidate.worktreeParent : undefined,
    expectedHeadSha: candidate.expectedHeadSha,
    expectedStatusFingerprint: candidate.expectedStatusFingerprint,
  };
}

function gitWorkspaceStatus(error: unknown) {
  if (!(error instanceof GitWorkspaceError)) {
    return null;
  }
  if (
    error.code.startsWith("stale_")
    || error.code.includes("dirty")
    || error.code.includes("conflicted")
    || error.code === "branch_checked_out_elsewhere"
    || error.code === "pending_orphan_worktree"
  ) {
    return 409;
  }
  return 400;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiSession(req, {
      source: "Conversations",
      action: "Start a conversation",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const body = await req.json();
    const mode = normalizeConversationMode(body?.mode);
    const command = String(body?.command ?? "").trim();
    const attachments = normalizeChatAttachments(body?.attachments);
    if (!command && attachments.length === 0) {
      return errorResponse("Command or attachment is required", {
        status: 400,
        source: "Conversations",
        action: "Start a conversation",
      });
    }

    if (mode === "implementation") {
      ensureSupervisorRuntimeStarted().catch((error) => {
        console.error("Supervisor runtime startup failed while creating a conversation:", error);
      });
    }

    const result = await createConversation({
      mode,
      command,
      projectPath: typeof body?.projectPath === "string" ? body.projectPath : null,
      gitWorkspaceTarget: readGitWorkspaceTarget(body?.gitWorkspaceTarget),
      gitWorkspaceLaunch: readGitWorkspaceLaunch(body?.gitWorkspaceLaunch),
      preferredWorkerType: typeof body?.preferredWorkerType === "string" ? body.preferredWorkerType : null,
      preferredWorkerModel: typeof body?.preferredWorkerModel === "string" ? body.preferredWorkerModel : null,
      preferredWorkerEffort: typeof body?.preferredWorkerEffort === "string" ? body.preferredWorkerEffort : null,
      allowedWorkerTypes: Array.isArray(body?.allowedWorkerTypes) || typeof body?.allowedWorkerTypes === "string"
        ? body.allowedWorkerTypes
        : null,
      attachments,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    const gitStatus = gitWorkspaceStatus(error);
    return errorResponse(error, {
      status: gitStatus ?? 500,
      source: "Conversations",
      action: "Start a conversation",
      details: error instanceof GitWorkspaceError
        ? [
          `code: ${error.code}`,
          Object.keys(error.details).length > 0 ? `details: ${JSON.stringify(error.details)}` : null,
        ].filter((detail): detail is string => Boolean(detail))
        : undefined,
    });
  }
}
