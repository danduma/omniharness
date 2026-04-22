import { NextRequest, NextResponse } from "next/server";
import { getAgent } from "@/server/bridge-client";
import { db } from "@/server/db";
import { runs, workers } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { errorResponse } from "@/server/api-errors";

function formatErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isMissingAgentError(error: unknown) {
  const message = formatErrorMessage(error).toLowerCase();
  return message.includes("404") || message.includes("not_found") || message.includes("agent not found");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const worker = await db.select().from(workers).where(eq(workers.id, name)).get();
  const run = worker ? await db.select().from(runs).where(eq(runs.id, worker.runId)).get() : null;
  const outputLog = worker?.outputLog ?? "";

  try {
    const data = await getAgent(name);
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
      bridgeLastError: data.lastError ?? null,
      runLastError: run?.lastError ?? null,
      lastError: data.lastError ?? run?.lastError ?? null,
      outputLog,
      displayText,
    });
  } catch (error: unknown) {
    if (worker && isMissingAgentError(error)) {
      return NextResponse.json({
        name,
        type: worker.type,
        cwd: worker.cwd,
        state: "starting",
        sessionId: worker.bridgeSessionId ?? null,
        requestedModel: run?.preferredWorkerModel ?? null,
        effectiveModel: null,
        requestedEffort: run?.preferredWorkerEffort ?? null,
        effectiveEffort: null,
        sessionMode: worker.bridgeSessionMode ?? null,
        bridgeLastError: formatErrorMessage(error),
        runLastError: run?.lastError ?? null,
        lastError: run?.lastError ?? null,
        outputEntries: [],
        outputLog,
        displayText: outputLog,
        renderedOutput: null,
        currentText: "",
        lastText: outputLog,
        stderrBuffer: [],
        pendingPermissions: [],
        stopReason: null,
        bridgeMissing: true,
      });
    }

    return errorResponse(error, {
      status: 500,
      source: "Bridge",
      action: "Load worker details",
    });
  }
}
