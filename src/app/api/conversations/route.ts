import { NextRequest, NextResponse } from "next/server";
import { ensureSupervisorRuntimeStarted } from "@/server/supervisor/runtime-watchdog";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { createConversation } from "@/server/conversations/create";
import { normalizeChatAttachments } from "@/lib/chat-attachments";

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

    await ensureSupervisorRuntimeStarted();

    const body = await req.json();
    const command = String(body?.command ?? "").trim();
    const attachments = normalizeChatAttachments(body?.attachments);
    if (!command && attachments.length === 0) {
      return errorResponse("Command or attachment is required", {
        status: 400,
        source: "Conversations",
        action: "Start a conversation",
      });
    }

    const result = await createConversation({
      mode: body?.mode,
      command,
      projectPath: typeof body?.projectPath === "string" ? body.projectPath : null,
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
    return errorResponse(error, {
      status: 500,
      source: "Conversations",
      action: "Start a conversation",
    });
  }
}
