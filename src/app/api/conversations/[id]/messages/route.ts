import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { askAgent } from "@/server/bridge-client";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { db } from "@/server/db";
import { messages, runs, workers } from "@/server/db/schema";
import { startSupervisorRun } from "@/server/supervisor/start";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiSession(req, {
      source: "Conversations",
      action: "Send a conversation message",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const { id } = await params;
    const body = await req.json();
    const content = String(body?.content ?? "").trim();
    if (!content) {
      return errorResponse("Message content cannot be empty", {
        status: 400,
        source: "Conversations",
        action: "Send a conversation message",
      });
    }

    const run = await db.select().from(runs).where(eq(runs.id, id)).get();
    if (!run) {
      return errorResponse("Conversation not found", {
        status: 404,
        source: "Conversations",
        action: "Send a conversation message",
      });
    }

    if (run.mode === "implementation") {
      await db.insert(messages).values({
        id: randomUUID(),
        runId: id,
        role: "user",
        kind: "checkpoint",
        content,
        createdAt: new Date(),
      });

      await db.update(runs).set({
        status: "running",
        failedAt: null,
        lastError: null,
        updatedAt: new Date(),
      }).where(eq(runs.id, id));
      startSupervisorRun(id);
      return NextResponse.json({ ok: true });
    }

    const worker = await db.select().from(workers).where(eq(workers.runId, id)).get();
    if (!worker) {
      return errorResponse("Conversation worker not found", {
        status: 404,
        source: "Conversations",
        action: "Send a conversation message",
      });
    }

    await db.insert(messages).values({
      id: randomUUID(),
      runId: id,
      role: "user",
      kind: "checkpoint",
      content,
      createdAt: new Date(),
    });

    const response = await askAgent(worker.id, content);

    await db.update(workers).set({
      status: response.state,
      updatedAt: new Date(),
    }).where(eq(workers.id, worker.id));

    await db.insert(messages).values({
      id: randomUUID(),
      runId: id,
      role: "worker",
      kind: run.mode,
      content: response.response,
      workerId: worker.id,
      createdAt: new Date(),
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return errorResponse(error, {
      status: 500,
      source: "Conversations",
      action: "Send a conversation message",
    });
  }
}
