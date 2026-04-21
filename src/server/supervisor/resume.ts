import { db } from "../db";
import { runs } from "../db/schema";
import { eq } from "drizzle-orm";
import { startSupervisorRun } from "./start";

export async function resumeSupervisorRun(runId: string) {
  await db.update(runs).set({ status: "running", updatedAt: new Date() }).where(eq(runs.id, runId));
  startSupervisorRun(runId);
}
