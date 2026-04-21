import { NextRequest, NextResponse } from "next/server";
import { getAgent } from "@/server/bridge-client";
import { db } from "@/server/db";
import { runs, workers } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { errorResponse } from "@/server/api-errors";

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
    const structuredOutput = typeof data.renderedOutput === "string" && data.renderedOutput.trim().length > 0
      ? data.renderedOutput
      : "";
    const liveText = data.currentText.length > 0
      ? data.currentText
      : "";
    const displayBase = structuredOutput || outputLog || data.lastText || "";
    const displayText = liveText && !structuredOutput
      ? displayBase
        ? `${displayBase}${displayBase.endsWith("\n") || liveText.startsWith("\n") ? "" : "\n"}${liveText}`
        : liveText
      : displayBase;
    return NextResponse.json({
      ...data,
      lastError: run?.lastError ?? null,
      outputLog,
      displayText,
    });
  } catch (error: unknown) {
    return errorResponse(error, {
      status: 500,
      source: "Bridge",
      action: "Load worker details",
    });
  }
}
