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
): WorkerLaunchSelection {
  const fallbackModel = run.preferredWorkerModel?.trim() || null;
  const credentialSource = worker.launchCredentialSource === "gateway"
    || (!worker.launchCredentialSource && decodeClaudeGatewayModel(fallbackModel) !== null)
    ? "gateway"
    : "account";
  return {
    model: worker.effectiveLaunchModel?.trim() || fallbackModel,
    effort: worker.effectiveLaunchEffort?.trim().toLowerCase() || run.preferredWorkerEffort?.trim().toLowerCase() || null,
    accountId: credentialSource === "gateway" ? null : run.preferredWorkerAccountId?.trim() || null,
    credentialSource,
  };
}
import { decodeClaudeGatewayModel } from "@/lib/claude-model-gateway";
