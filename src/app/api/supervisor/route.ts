import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { plans, runs, messages as dbMessages } from '@/server/db/schema';
import { Supervisor } from '@/server/supervisor';
import { CreditManager } from '@/server/credits';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

interface AttachmentInput {
  kind?: string;
  name?: string;
  path?: string;
}

function quoteBlock(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join('\n');
}

function formatAttachments(attachments: AttachmentInput[]) {
  if (attachments.length === 0) return '';

  const lines = attachments.map((attachment) => {
    const parts = [
      attachment.kind?.trim(),
      attachment.name?.trim(),
      attachment.path?.trim(),
    ].filter(Boolean);

    return parts.length > 0 ? `- ${parts.join(' | ')}` : '- attachment';
  });

  return `\nAttachments:\n\n${lines.join('\n')}\n`;
}

function createAdHocPlan(command: string, attachments: AttachmentInput[]) {
  const adHocDir = path.resolve(process.cwd(), 'vibes', 'ad-hoc');
  fs.mkdirSync(adHocDir, { recursive: true });

  const filename = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.md`;
  const relativePath = path.join('vibes', 'ad-hoc', filename);
  const summary = command.replace(/\s+/g, ' ').trim();
  const markdown = `# Ad Hoc Request

Original command:

${quoteBlock(command)}
${formatAttachments(attachments)}

## Checklist

- [ ] ${summary}
`;

  fs.writeFileSync(path.resolve(process.cwd(), relativePath), markdown, 'utf-8');
  return relativePath;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { command } = body as { command?: unknown };
    const trimmedCommand = String(command ?? '').trim();
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
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(dbMessages).values({
      id: randomUUID(),
      runId,
      role: 'user',
      content: trimmedCommand,
      createdAt: new Date(),
    });

    // Start supervisor loop in background
    const supervisor = new Supervisor({ planId, runId });
    supervisor.run().catch((err) => {
      console.error('Supervisor failed:', err);
    });

    return NextResponse.json({ ok: true, planId, runId });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
