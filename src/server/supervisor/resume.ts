import { db } from "../db";
import { runs } from "../db/schema";
import { eq } from "drizzle-orm";

export async function resumeSupervisorRun(runId: string) {
  await db.update(runs).set({ status: "running", updatedAt: new Date() }).where(eq(runs.id, runId));
}
