import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  executionEvents,
  messages,
  plans,
  queuedConversationMessages,
  recoveryIncidents,
  runs,
  workers,
} from "@/server/db/schema";
import {
  markRecoveryIncidentFailed,
  markRecoveryIncidentRecovering,
  markRecoveryIncidentResolved,
  openRecoveryIncident,
} from "@/server/runs/recovery-incidents";
import {
  __getRingForTests,
  __resetNamedEventsForTests,
  type BufferedEntry,
} from "@/server/events/named-events";

function eventsByKind(kind: string) {
  return __getRingForTests().filter((entry): entry is BufferedEntry => entry.event.kind === kind);
}

const RUN_ID = "run-recovery-events";
const WORKER_ID = "w-recovery-events";

async function seedRunAndWorker() {
  const now = new Date();
  await db.insert(plans).values({
    id: "plan-recovery-events",
    path: "/tmp/x.md",
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(runs).values({
    id: RUN_ID,
    planId: "plan-recovery-events",
    mode: "direct",
    title: "Recovery test",
    status: "ready",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(workers).values({
    id: WORKER_ID,
    runId: RUN_ID,
    type: "codex",
    status: "starting",
    cwd: "/tmp",
    outputLog: "",
    outputEntriesJson: "[]",
    currentText: "",
    lastText: "",
    createdAt: now,
    updatedAt: now,
  });
}

describe("recovery-incidents named events", () => {
  beforeEach(async () => {
    __resetNamedEventsForTests();
    await db.delete(executionEvents);
    await db.delete(recoveryIncidents);
    await db.delete(queuedConversationMessages);
    await db.delete(messages);
    await db.delete(workers);
    await db.delete(runs);
    await db.delete(plans);
    await seedRunAndWorker();
  });

  it("emits recovery.opened when a new incident is opened", async () => {
    const incident = await openRecoveryIncident({
      runId: RUN_ID,
      workerId: WORKER_ID,
      kind: "worker_lost",
      lastError: "bridge stopped",
    });

    const opened = eventsByKind("recovery.opened");
    expect(opened).toHaveLength(1);
    expect(opened[0]!.event).toMatchObject({
      kind: "recovery.opened",
      runId: RUN_ID,
      incidentId: incident.id,
      recoveryKind: "worker_lost",
    });
  });

  it("emits recovery.attempt with incremented attempt count", async () => {
    const incident = await openRecoveryIncident({
      runId: RUN_ID,
      workerId: WORKER_ID,
      kind: "worker_lost",
    });

    await markRecoveryIncidentRecovering({
      incidentId: incident.id,
      runId: RUN_ID,
      workerId: WORKER_ID,
      decision: "respawn",
    });
    await markRecoveryIncidentRecovering({
      incidentId: incident.id,
      runId: RUN_ID,
      workerId: WORKER_ID,
      decision: "respawn",
    });

    const attempts = eventsByKind("recovery.attempt").map((entry) => entry.event);
    expect(attempts).toEqual([
      { kind: "recovery.attempt", runId: RUN_ID, incidentId: incident.id, attempt: 1 },
      { kind: "recovery.attempt", runId: RUN_ID, incidentId: incident.id, attempt: 2 },
    ]);
  });

  it("emits recovery.resolved when an incident closes cleanly", async () => {
    const incident = await openRecoveryIncident({
      runId: RUN_ID,
      workerId: WORKER_ID,
      kind: "worker_lost",
    });
    await markRecoveryIncidentResolved({
      incidentId: incident.id,
      runId: RUN_ID,
      workerId: WORKER_ID,
      summary: "ok",
    });

    expect(eventsByKind("recovery.resolved")).toHaveLength(1);
  });

  it("emits recovery.gave_up + error.surfaced when recovery is exhausted", async () => {
    const incident = await openRecoveryIncident({
      runId: RUN_ID,
      workerId: WORKER_ID,
      kind: "worker_lost",
    });
    await markRecoveryIncidentRecovering({
      incidentId: incident.id,
      runId: RUN_ID,
      workerId: WORKER_ID,
      decision: "respawn",
    });
    await markRecoveryIncidentFailed({
      incidentId: incident.id,
      runId: RUN_ID,
      workerId: WORKER_ID,
      reason: "Bridge never came back online after 5 attempts.",
    });

    const gaveUp = eventsByKind("recovery.gave_up").map((entry) => entry.event);
    expect(gaveUp).toEqual([
      { kind: "recovery.gave_up", runId: RUN_ID, incidentId: incident.id, attempts: 1 },
    ]);
    const surfaced = eventsByKind("error.surfaced").map((entry) => entry.event);
    expect(surfaced).toEqual([
      expect.objectContaining({
        kind: "error.surfaced",
        code: "recovery.gave_up",
        runId: RUN_ID,
        workerId: WORKER_ID,
        surface: "banner",
      }),
    ]);
  });
});
