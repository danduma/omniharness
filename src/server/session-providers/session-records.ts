import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { processSessions, runs, workers } from "@/server/db/schema";
import { getSessionProvider } from "./registry";
import { normalizeSessionType } from "./capabilities";
import type { ProviderSessionRecord, SessionRecord, SessionType } from "./types";

type RunRow = typeof runs.$inferSelect;
type WorkerRow = Pick<typeof workers.$inferSelect, "id" | "runId" | "type" | "status">;
type ProcessSessionRow = typeof processSessions.$inferSelect;

function safeParseCommandJson(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((part): part is string => typeof part === "string") : [];
  } catch {
    return [];
  }
}

export function buildProviderSessionRecord(args: {
  run: RunRow;
  primaryWorker?: WorkerRow | null;
  processSession?: ProcessSessionRow | null;
}): ProviderSessionRecord {
  const sessionType = normalizeSessionType(args.run.sessionType) as SessionType;
  if (sessionType === "process" && args.processSession) {
    return {
      runId: args.run.id,
      sessionType,
      mode: args.run.mode,
      status: args.processSession.status,
      projectPath: args.run.projectPath,
      title: args.run.title,
      primaryActorId: args.processSession.workerId,
      providerMetadata: {
        cwd: args.processSession.cwd,
        commandPreview: args.processSession.commandPreview,
        argv: safeParseCommandJson(args.processSession.commandJson),
        envPolicy: args.processSession.envPolicy,
        pid: args.processSession.pid,
        exitCode: args.processSession.exitCode,
        signal: args.processSession.signal,
        startedAt: args.processSession.startedAt?.toISOString() ?? null,
        exitedAt: args.processSession.exitedAt?.toISOString() ?? null,
        lastError: args.processSession.lastError,
      },
    };
  }

  return {
    runId: args.run.id,
    sessionType: "omni",
    mode: args.run.mode,
    status: args.run.status,
    projectPath: args.run.projectPath,
    title: args.run.title,
    primaryActorId: args.primaryWorker?.id ?? null,
    providerMetadata: null,
  };
}

export function serializeSessionRecord(args: {
  run: RunRow;
  primaryWorker?: WorkerRow | null;
  processSession?: ProcessSessionRow | null;
}): SessionRecord {
  const providerRecord = buildProviderSessionRecord(args);
  return getSessionProvider(providerRecord.sessionType).serialize(providerRecord);
}

export async function readSessionRecord(runId: string): Promise<SessionRecord | null> {
  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (!run) {
    return null;
  }
  const runWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
  const processSession = await db.select().from(processSessions).where(eq(processSessions.runId, runId)).get();
  return serializeSessionRecord({
    run,
    primaryWorker: runWorkers[0] ?? null,
    processSession: processSession ?? null,
  });
}
