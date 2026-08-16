import { t } from "@/lib/i18n";
import {
  hasVerifiedDeadCredentialMarker,
  readVerifiedDeadCredentialAccountId,
  stripProviderFailureMarkers,
} from "@/lib/provider-account-failures";
import type { AccountRecord, NoticeDescriptor } from "./types";

// A dead credential is the one failure where the generic copy is actively
// wrong: "send a message to reconnect" respawns a worker that authenticates
// against the same revoked token and fails identically, forever. The server
// only stamps the marker after probing the credential a second time, so when
// it is present we can tell the user the one thing that does help.

// Sign-in lives in a subcommand for some CLIs and inside the session for
// others, so an unmapped worker gets the generic wording rather than a guess.
const CLI_LOGIN_HINT_KEYS: Record<string, string> = {
  claude: "conversation.failure.reauth.hint.claude",
  codex: "conversation.failure.reauth.hint.codex",
};

function accountDisplayName(account: AccountRecord | null, accountId: string | null) {
  return account?.label?.trim() || accountId || t("conversation.failure.reauth.accountFallback");
}

function reauthSuggestion(args: {
  account: AccountRecord | null;
  accountName: string;
  workerType: string | null;
  workerLabel: string;
}) {
  const authMode = args.account?.authMode?.trim();
  if (authMode === "api_key" || (args.account && args.account.type === "api")) {
    return t("conversation.failure.reauth.hint.apiKey", { account: args.accountName });
  }
  if (authMode === "credential_command") {
    return t("conversation.failure.reauth.hint.credentialCommand", { account: args.accountName });
  }
  if (authMode === "credential_profile") {
    return t("conversation.failure.reauth.hint.credentialProfile", { account: args.accountName });
  }

  const cliKey = args.workerType ? CLI_LOGIN_HINT_KEYS[args.workerType] : undefined;
  return cliKey
    ? t(cliKey)
    : t("conversation.failure.reauth.hint.cli", { worker: args.workerLabel });
}

/**
 * Build the failure notice for a credential the provider rejected twice.
 * Returns null for every other failure so the caller keeps its normal copy.
 */
export function buildCredentialReauthNotice(args: {
  lastError: string | null | undefined;
  accounts: readonly AccountRecord[];
  workerType: string | null | undefined;
  workerLabel: string | null | undefined;
}): NoticeDescriptor | null {
  if (!hasVerifiedDeadCredentialMarker(args.lastError)) {
    return null;
  }

  const accountId = readVerifiedDeadCredentialAccountId(args.lastError);
  const account = accountId
    ? args.accounts.find((candidate) => candidate.id === accountId) ?? null
    : null;
  const workerType = args.workerType?.trim().toLowerCase()
    || account?.cliType?.trim().toLowerCase()
    || null;
  const workerLabel = args.workerLabel?.trim() || t("conversation.failure.reauth.workerFallback");
  const accountName = accountDisplayName(account, accountId);
  const providerText = stripProviderFailureMarkers(args.lastError).replace(/^run failed:\s*/i, "").trim();

  return {
    tone: "error",
    action: t("conversation.failure.reauth.action"),
    message: t("conversation.failure.reauth.message", { account: accountName }),
    suggestion: reauthSuggestion({ account, accountName, workerType, workerLabel }),
    // The provider's own words stay visible, but the spawn-readiness line does
    // not: the doctor check never looks at credentials, so "Ready to spawn."
    // next to a revoked token reads as a contradiction.
    details: providerText ? [providerText] : [],
  };
}
