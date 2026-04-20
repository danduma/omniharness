import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { plans, runs, messages as dbMessages } from '@/server/db/schema';
import { Supervisor } from '@/server/supervisor';
import { CreditManager } from '@/server/credits';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { command } = await req.json();
    if (!command.startsWith('implement ')) {
      return NextResponse.json({ error: 'Command must start with "implement "' }, { status: 400 });
    }

    const planPath = command.slice('implement '.length).trim();
    if (!fs.existsSync(path.resolve(process.cwd(), planPath))) {
      return NextResponse.json({ error: 'Plan file not found' }, { status: 404 });
    }

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
      content: command,
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
