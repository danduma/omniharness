import { decodeClaudeGatewayModel } from "@/lib/claude-model-gateway";

export type WorkerLaunchSelection = {
  model: string | null;
  effort: string | null;
  accountId: string | null;
  credentialSource: "gateway" | "account";
};

export function resolveWorkerLaunchSelection(
  worker: {
    effectiveLaunchModel?: string | null;
    effectiveLaunchEffort?: string | null;
    launchCredentialSource?: string | null;
  },
  run: {
    preferredWorkerModel?: string | null;
    preferredWorkerEffort?: string | null;
    preferredWorkerAccountId?: string | null;
  },
  // The account this worker is already allocated to. Only `run
  // .preferredWorkerAccountId` used to be consulted, and that column is empty
  // whenever the account was auto-selected rather than pinned by the user — so
  // every respawn of such a worker launched with accountId=null. A null account
  // makes resolveAccountCredentials fall back to the generic credential
  // profile, which does NOT unset ANTHROPIC_API_KEY, so a stale key left in
  // settings leaked into the worker and outranked the OAuth subscription. The
  // provider answers a bad key with "403 Account suspended", which is how a
  // perfectly healthy Max account kept looking suspended after a session
  // recovery.
  allocation?: { accountId?: string | null } | null,
): WorkerLaunchSelection {
  const fallbackModel = run.preferredWorkerModel?.trim() || null;
  const credentialSource = worker.launchCredentialSource === "gateway"
    || (!worker.launchCredentialSource && decodeClaudeGatewayModel(fallbackModel) !== null)
    ? "gateway"
    : "account";
  const accountId = run.preferredWorkerAccountId?.trim() || allocation?.accountId?.trim() || null;
  return {
    model: worker.effectiveLaunchModel?.trim() || fallbackModel,
    effort: worker.effectiveLaunchEffort?.trim().toLowerCase() || run.preferredWorkerEffort?.trim().toLowerCase() || null,
    accountId: credentialSource === "gateway" ? null : accountId,
    credentialSource,
  };
}
