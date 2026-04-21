import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { plans, runs, messages as dbMessages } from '@/server/db/schema';
import { CreditManager } from '@/server/credits';
import { queueConversationTitleGeneration } from '@/server/conversation-title';
import { createAdHocPlan } from '@/server/runs/ad-hoc-plan';
import { startSupervisorRun } from '@/server/supervisor/start';
import { parseAllowedWorkerTypes, normalizeWorkerType } from '@/server/supervisor/worker-types';
import { randomUUID } from 'crypto';
interface AttachmentInput {
  kind?: string;
  name?: string;
  path?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { command } = body as { command?: unknown };
    const trimmedCommand = String(command ?? '').trim();
    const preferredWorkerType = typeof body?.preferredWorkerType === "string" && body.preferredWorkerType.trim()
      ? normalizeWorkerType(body.preferredWorkerType)
      : null;
    const allowedWorkerTypes = parseAllowedWorkerTypes(
      Array.isArray(body?.allowedWorkerTypes)
        ? JSON.stringify(body.allowedWorkerTypes)
        : typeof body?.allowedWorkerTypes === "string"
          ? body.allowedWorkerTypes
          : null,
    );
    const projectPath = typeof body?.projectPath === "string" && body.projectPath.trim()
      ? body.projectPath.trim()
      : null;
    if (!trimmedCommand) {
      return NextResponse.json({ error: 'Command cannot be empty' }, { status: 400 });
    }

    const attachments = Array.isArray(body?.attachments)
      ? (body.attachments as AttachmentInput[])
      : [];
    const planPath = createAdHocPlan(trimmedCommand, attachments);

    // Sync accounts
    const creditManager = new CreditManager();
    await creditManager.syncAccounts();

    const planId = randomUUID();
    await db.insert(plans).values({
      id: planId,
      path: planPath,
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const runId = randomUUID();
    await db.insert(runs).values({
      id: runId,
      planId,
      projectPath,
      title: 'New conversation',
      preferredWorkerType,
      allowedWorkerTypes: JSON.stringify(allowedWorkerTypes),
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(dbMessages).values({
      id: randomUUID(),
      runId,
      role: 'user',
      kind: 'checkpoint',
      content: trimmedCommand,
      createdAt: new Date(),
    });

    startSupervisorRun(runId);

    queueConversationTitleGeneration({ runId, command: trimmedCommand }).catch((err) => {
      console.error('Conversation title generation failed:', err);
    });

    return NextResponse.json({ ok: true, planId, runId });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
