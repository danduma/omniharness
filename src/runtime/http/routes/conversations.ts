import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { normalizeConversationMode } from "@/server/conversations/modes";
import { normalizeChatAttachments } from "@/lib/chat-attachments";
import { getSessionProvider } from "@/server/session-providers/registry";
import type { SessionType } from "@/server/session-providers/types";
import { emitNamedEvent } from "@/server/events/named-events";
import type { GitWorkspaceTarget } from "@/lib/git-workspace";
import { GitWorkspaceError } from "@/server/git/workspaces";
import { ensureSupervisorRuntimeStarted } from "@/server/supervisor/runtime-watchdog";
import { RUN_ID_PATTERN } from "@/server/runs/ids";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readExternalClaudeSessionId(value: unknown): string | null {
  if (value == null || value === "") {
    return null;
  }
  const id = String(value).trim();
  if (UUID_RE.test(id)) {
    return id;
  }
  throw Object.assign(new Error("Invalid external session id."), { status: 400 });
}
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { toNextRequest } from "./next-request";

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

function readSessionType(value: unknown): SessionType {
  if (value == null || value === "" || value === "omni") {
    return "omni";
  }
  if (value === "process") {
    return "process";
  }
  emitNamedEvent({
    kind: "error.surfaced",
    code: "session.provider.unknown",
    message: `Unknown session provider: ${String(value)}`,
    surface: "toast",
  });
  throw Object.assign(new Error(`Unknown session provider: ${String(value)}`), { status: 400 });
}

function readRequestedRunId(value: unknown) {
  if (value == null || value === "") {
    return null;
  }

  const requestedRunId = String(value).trim();
  if (RUN_ID_PATTERN.test(requestedRunId)) {
    return requestedRunId;
  }

  throw Object.assign(new Error("Invalid requested run id."), { status: 400 });
}

export const handleConversationsRequest: OmniHttpHandler = async (request) => {
  try {
    if (request.method !== "POST") {
      return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
        status: 405,
        headers: { allow: "POST" },
      });
    }

    const auth = await requireApiSession(toNextRequest(request), {
      source: "Conversations",
      action: "Start a conversation",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const body = await request.json();
    const sessionType = readSessionType(body?.sessionType);
    const mode = normalizeConversationMode(body?.mode);
    const command = String(body?.command ?? "").trim();
    const attachments = normalizeChatAttachments(body?.attachments);
    const externalClaudeSessionId = readExternalClaudeSessionId(body?.externalClaudeSessionId);
    const hasProcessArgv = sessionType === "process" && Array.isArray(body?.process?.argv) && body.process.argv.length > 0;
    const hasProcessCommand = sessionType === "process" && typeof body?.process?.command === "string" && body.process.command.trim();
    if (!command && attachments.length === 0 && !hasProcessArgv && !hasProcessCommand && !externalClaudeSessionId) {
      return errorResponse("Command or attachment is required", {
        status: 400,
        source: "Conversations",
        action: "Start a conversation",
      });
    }

    if (sessionType === "omni" && mode === "implementation") {
      ensureSupervisorRuntimeStarted().catch((error) => {
        console.error("Supervisor runtime startup failed while creating a conversation:", error);
      });
    }

    const provider = getSessionProvider(sessionType);
    const result = await provider.create({
      sessionType,
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
      requestedRunId: readRequestedRunId(body?.requestedRunId),
      attachments,
      externalClaudeSessionId,
      process: sessionType === "process" && body?.process && typeof body.process === "object"
        ? {
          argv: Array.isArray(body.process.argv) ? body.process.argv : undefined,
          command: typeof body.process.command === "string" ? body.process.command : undefined,
          cwd: typeof body.process.cwd === "string" ? body.process.cwd : null,
          envPolicy: body.process.envPolicy === "inherit_safe" ? "inherit_safe" : "minimal",
        }
        : null,
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    const gitStatus = gitWorkspaceStatus(error);
    const explicitStatus = typeof (error as { status?: unknown })?.status === "number"
      ? (error as { status: number }).status
      : null;
    return errorResponse(error, {
      status: gitStatus ?? explicitStatus ?? 500,
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
};
