import { CreditManager } from "@/server/credits";
import { createConversation } from "@/server/conversations/create";
import { ensureSupervisorRuntimeStarted } from "@/server/supervisor/runtime-watchdog";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { normalizeChatAttachments } from "@/lib/chat-attachments";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { toNextRequest } from "./next-request";

export const handleSupervisorRequest: OmniHttpHandler = async (request) => {
  try {
    if (request.method !== "POST") {
      return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
        status: 405,
        headers: { allow: "POST" },
      });
    }

    const auth = await requireApiSession(toNextRequest(request), {
      source: "Supervisor",
      action: "Start a run",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    await ensureSupervisorRuntimeStarted();

    const body = await request.json();
    const { command } = body as { command?: unknown };
    const trimmedCommand = String(command ?? "").trim();
    if (!trimmedCommand) {
      return errorResponse("Command cannot be empty", {
        status: 400,
        source: "Supervisor",
        action: "Start a run",
      });
    }

    const attachments = normalizeChatAttachments(body?.attachments);

    const creditManager = new CreditManager();
    await creditManager.syncAccounts();

    const result = await createConversation({
      mode: "implementation",
      command: trimmedCommand,
      projectPath: typeof body?.projectPath === "string" && body.projectPath.trim()
        ? body.projectPath.trim()
        : null,
      preferredWorkerType: typeof body?.preferredWorkerType === "string" ? body.preferredWorkerType : null,
      preferredWorkerModel: typeof body?.preferredWorkerModel === "string" ? body.preferredWorkerModel : null,
      preferredWorkerEffort: typeof body?.preferredWorkerEffort === "string" ? body.preferredWorkerEffort : null,
      allowedWorkerTypes: Array.isArray(body?.allowedWorkerTypes) || typeof body?.allowedWorkerTypes === "string"
        ? body.allowedWorkerTypes
        : null,
      attachments,
    });

    return Response.json({ ok: true, planId: result.planId, runId: result.runId });
  } catch (error) {
    return errorResponse(error, {
      status: 500,
      source: "Supervisor",
      action: "Start a run",
    });
  }
};
