import { db } from "../db";
import { runs } from "../db/schema";
import { eq } from "drizzle-orm";
import { startSupervisorRun } from "./start";
import { clearSupervisorWakeLease } from "./lease";

export async function resumeSupervisorRun(runId: string) {
  await clearSupervisorWakeLease(runId);
  await db.update(runs).set({ status: "running", updatedAt: new Date() }).where(eq(runs.id, runId));
  startSupervisorRun(runId);
}
