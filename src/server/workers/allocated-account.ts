import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { workerCredentialAllocations } from "@/server/db/schema";
import {
  allocateWorkerAccount,
  normalizeAccountAllocationStrategy,
} from "@/server/accounts/account-allocator";

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
    .orderBy(desc(workerCredentialAllocations.updatedAt), desc(workerCredentialAllocations.createdAt))
    .get();
  return allocation?.accountId ?? null;
}

export async function refreshWorkerAllocatedAccountId(input: {
  workerId: string;
  runId: string;
  workerType: string;
  explicitAccountId?: string | null;
  env?: Record<string, string | undefined>;
}) {
  const allocation = await db
    .select()
    .from(workerCredentialAllocations)
    .where(eq(workerCredentialAllocations.workerId, input.workerId))
    .orderBy(desc(workerCredentialAllocations.updatedAt), desc(workerCredentialAllocations.createdAt))
    .get();
  if (!allocation || input.explicitAccountId?.trim() || allocation.explicit) {
    return allocation?.accountId ?? null;
  }
  const refreshed = await allocateWorkerAccount({
    workerType: input.workerType,
    runId: input.runId,
    workerId: input.workerId,
    strategy: normalizeAccountAllocationStrategy(allocation.strategy),
    env: input.env,
  });
  return refreshed.account?.id ?? allocation.accountId;
}
