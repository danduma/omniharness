import { eq } from "drizzle-orm";
import { isAuthShapedProviderFailure, annotateVerifiedDeadCredential, annotateVerifiedLiveCredential } from "@/lib/provider-account-failures";
import { db } from "@/server/db";
import { runs, workerCredentialAllocations, workers } from "@/server/db/schema";
import { markAccountLoginRequired } from "@/server/accounts/login-required";
import { supportsCredentialLivenessProbe, verifyAccountCredentialLiveness } from "@/server/accounts/credential-verification";
import { recordExecutionEvent } from "@/server/events/execution-event-store";
import { emitNamedEvent } from "@/server/events/named-events";

type RunRecord = typeof runs.$inferSelect;
type WorkerRecord = typeof workers.$inferSelect;

async function resolveWorkerAccountId(run: RunRecord, worker: WorkerRecord) {
  const allocation = await db
    .select()
    .from(workerCredentialAllocations)
    .where(eq(workerCredentialAllocations.workerId, worker.id))
    .get();
  return allocation?.accountId ?? run.preferredWorkerAccountId?.trim() ?? null;
}

/**
 * Decide whether an auth-shaped failure is really the account's fault.
 *
 * Both the initial prompt and follow-up prompt paths use this helper. The
 * provider error alone is not proof of a dead credential, so the same exact
 * account is probed before we tell the UI to ask for sign-in again.
 */
export async function resolveCredentialAuthFailureMessage(
  run: RunRecord,
  worker: WorkerRecord,
  message: string,
) {
  if (!isAuthShapedProviderFailure(message) || !supportsCredentialLivenessProbe(worker.type)) {
    return message;
  }

  const accountId = await resolveWorkerAccountId(run, worker);
  const verification = await verifyAccountCredentialLiveness({
    workerType: worker.type,
    accountId,
    cwd: worker.cwd || run.projectPath || process.cwd(),
  });

  await recordExecutionEvent({
    runId: run.id,
    workerId: worker.id,
    eventType: "worker_credential_verified",
    details: {
      summary: verification.liveness === "live"
        ? "Provider reported an auth failure but the credential still works; treating it as transient."
        : `Credential verification returned "${verification.liveness}"; the failure stands.`,
      accountId,
      liveness: verification.liveness,
      detail: verification.detail,
      providerError: message,
    },
  });

  if (verification.liveness === "live") {
    return annotateVerifiedLiveCredential(message);
  }

  if (verification.liveness === "dead") {
    if (accountId) {
      await markAccountLoginRequired({
        accountId,
        workerType: worker.type,
        reason: verification.detail,
        source: "credential_verification",
      });
    }
    emitNamedEvent({
      kind: "account.login_required",
      accountId: accountId ?? "default",
      workerType: worker.type,
      reason: verification.detail,
    });
    return annotateVerifiedDeadCredential(message, accountId);
  }

  return message;
}
