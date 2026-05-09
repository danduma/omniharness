import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { recoveryIncidents } from "@/server/db/schema";
import { reconcileRunRecovery } from "./recovery-reconciler";
import type { RecoveryLiveAgentLike } from "./recovery-state";

export async function listRunRecoveryIncidents(runId: string) {
  return db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId));
}

export async function inspectRunRecovery(runId: string) {
  const incidents = await listRunRecoveryIncidents(runId);
  const openIncidents = incidents.filter((incident) => (
    incident.status === "open"
    || incident.status === "recovering"
    || incident.status === "needs_user"
  ));
  return {
    runId,
    incidents,
    openIncidents,
    currentIncident: openIncidents.at(-1) ?? null,
  };
}

export async function triggerRunRecovery(args: {
  runId: string;
  liveAgents?: RecoveryLiveAgentLike[];
  force?: boolean;
  source?: string;
}) {
  return reconcileRunRecovery({
    runId: args.runId,
    liveAgents: args.liveAgents ?? [],
    force: args.force ?? true,
    source: args.source ?? "control-plane",
  });
}

export async function acknowledgeRecoveryIncident(args: {
  incidentId: string;
}) {
  const incident = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.id, args.incidentId)).get();
  if (!incident) {
    throw new Error("Recovery incident not found");
  }
  if (incident.status !== "resolved" && incident.status !== "failed") {
    throw new Error("Only terminal recovery incidents can be acknowledged");
  }
  await db.update(recoveryIncidents).set({
    details: JSON.stringify({
      ...(incident.details ? JSON.parse(incident.details) : {}),
      acknowledgedAt: new Date().toISOString(),
    }),
    updatedAt: new Date(),
  }).where(eq(recoveryIncidents.id, incident.id));
  return { ok: true, incidentId: incident.id };
}
