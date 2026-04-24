import { NextRequest, NextResponse } from 'next/server';
import { CreditManager } from '@/server/credits';
import { createConversation } from '@/server/conversations/create';
import { ensureSupervisorRuntimeStarted } from '@/server/supervisor/runtime-watchdog';
import { errorResponse } from '@/server/api-errors';
import { requireApiSession } from "@/server/auth/guards";
interface AttachmentInput {
  kind?: string;
  name?: string;
  path?: string;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiSession(req, {
      source: "Supervisor",
      action: "Start a run",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    await ensureSupervisorRuntimeStarted();

    const body = await req.json();
    const { command } = body as { command?: unknown };
    const trimmedCommand = String(command ?? '').trim();
    if (!trimmedCommand) {
      return errorResponse("Command cannot be empty", {
        status: 400,
        source: "Supervisor",
        action: "Start a run",
      });
    }

    const attachments = Array.isArray(body?.attachments)
      ? (body.attachments as AttachmentInput[])
      : [];

    // Sync accounts
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

    return NextResponse.json({ ok: true, planId: result.planId, runId: result.runId });
  } catch (error: unknown) {
    return errorResponse(error, {
      status: 500,
      source: "Supervisor",
      action: "Start a run",
    });
  }
}
