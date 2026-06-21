import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { plans, runs } from "@/server/db/schema";
import { startSupervisorRun } from "@/server/supervisor/start";
import { validatePlanForImplementation } from "./promote";

/**
 * Transition an Omni run from its interactive planning phase into the
 * supervised implementation phase — on the SAME run, with no child run.
 *
 * This is the seamless counterpart to `promotePlanningRun` (which creates a
 * separate implementation run from a legacy planning-mode run). The run keeps
 * its id, messages, and history; only `phase` flips to "implementing" and the
 * supervisor takes over. The planning messages already on the run feed the
 * supervisor's intent extraction.
 */
export async function startImplementationPhase(args: {
  runId: string;
  planPath?: string | null;
}) {
  const run = await db.select().from(runs).where(eq(runs.id, args.runId)).get();
  if (!run) {
    throw new Error(`Run ${args.runId} not found`);
  }

  if (!(run.mode === "implementation" && run.phase === "planning")) {
    throw new Error("Only an Omni run in its planning phase can start implementation");
  }

  const { selectedPlanPath, specPath } = await validatePlanForImplementation({
    runId: args.runId,
    run,
    planPath: args.planPath,
  });

  const previousPhase = run.phase;
  const previousStatus = run.status;

  // Flip the run into the implementing phase in place and point its existing
  // plan row at the verified plan file.
  await db.update(plans).set({
    path: selectedPlanPath,
    status: "running",
    updatedAt: new Date(),
  }).where(eq(plans.id, run.planId));

  await db.update(runs).set({
    phase: "implementing",
    status: "running",
    specPath,
    artifactPlanPath: selectedPlanPath,
    failedAt: null,
    lastError: null,
    updatedAt: new Date(),
  }).where(eq(runs.id, run.id));

  try {
    startSupervisorRun(run.id);
  } catch (error) {
    // Roll back to the planning phase so the user can retry the handoff.
    await db.update(runs).set({
      phase: previousPhase,
      status: previousStatus,
      updatedAt: new Date(),
    }).where(eq(runs.id, run.id));
    throw error;
  }

  return {
    runId: run.id,
    planId: run.planId,
    planPath: selectedPlanPath,
  };
}
