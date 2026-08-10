import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { workerCredentialAllocations } from "@/server/db/schema";

/**
 * The account a worker was allocated at spawn time.
 *
 * Respawn paths must feed this into `resolveWorkerLaunchSelection`: the run's
 * `preferredWorkerAccountId` is only populated when the user pinned an account
 * explicitly, so auto-selected accounts are otherwise lost on every recreate.
 */
export async function readWorkerAllocatedAccountId(workerId: string) {
  const allocation = await db
    .select()
    .from(workerCredentialAllocations)
    .where(eq(workerCredentialAllocations.workerId, workerId))
    .get();
  return allocation?.accountId ?? null;
}
