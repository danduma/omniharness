import { NextRequest, NextResponse } from "next/server";
import { getAgent } from "@/server/bridge-client";
import { db } from "@/server/db";
import { runs, workers } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const data = await getAgent(name);
    const worker = await db.select().from(workers).where(eq(workers.id, name)).get();
    const run = worker ? await db.select().from(runs).where(eq(runs.id, worker.runId)).get() : null;
    const outputLog = worker?.outputLog ?? "";
    const liveText = data.currentText.length > 0
      ? data.currentText
      : "";
    const displayText = liveText
      ? outputLog
        ? `${outputLog}${outputLog.endsWith("\n") || liveText.startsWith("\n") ? "" : "\n"}${liveText}`
        : liveText
      : outputLog || data.lastText || "";
    return NextResponse.json({
      ...data,
      lastError: run?.lastError ?? null,
      outputLog,
      displayText,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
