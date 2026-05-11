import { parseQuotaResetText } from "@/server/quota/reset-parser";

export type WorkerHealth = "healthy" | "stuck" | "cred-exhausted";

export interface WorkerHealthInput {
  silenceMs: number;
  repeatCount: number;
  unresolvedItems: number;
  stderr?: string;
}

export function classifyWorkerHealth(input: WorkerHealthInput): WorkerHealth {
  const stderr = input.stderr || "";

  if (parseQuotaResetText(stderr).isQuotaError) {
    return "cred-exhausted";
  }

  if (input.silenceMs >= 30_000 && input.unresolvedItems > 0) {
    return "stuck";
  }

  if (input.repeatCount >= 3 && input.unresolvedItems > 0) {
    return "stuck";
  }

  return "healthy";
}

export interface FalseCompletionCheck {
  workerClaimedDone: boolean;
  unresolvedItems: number;
  missingArtifacts: string[];
}

export function detectFalseCompletion(input: FalseCompletionCheck) {
  if (!input.workerClaimedDone) {
    return false;
  }

  return input.unresolvedItems > 0 || input.missingArtifacts.length > 0;
}
