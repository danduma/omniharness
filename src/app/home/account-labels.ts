import { t } from "@/lib/i18n";
import type { AccountRecord } from "./types";

function stringMetadata(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function accountIdentity(account: AccountRecord) {
  const identity = account.metadata?.identity;
  return identity && typeof identity === "object" && !Array.isArray(identity)
    ? identity as Record<string, unknown>
    : {};
}

function authSourceLabel(account: AccountRecord) {
  if (account.authMode === "api_key" || account.type === "api") {
    return t("conversation.composer.account.source.apiKey");
  }
  if (account.authMode === "credential_command") {
    return t("conversation.composer.account.source.credentialCommand");
  }
  if (account.authMode === "credential_profile") {
    return t("conversation.composer.account.source.credentialProfile");
  }
  if (account.authMode === "isolated_cli_home") {
    return t("conversation.composer.account.source.isolatedCliHome");
  }
  if (account.authMode === "local_session" || account.type === "subscription") {
    return t("conversation.composer.account.source.subscription");
  }
  return t("conversation.composer.account.source.legacy");
}

export function formatAccountOptionLabel(account: AccountRecord) {
  const identity = accountIdentity(account);
  const email = stringMetadata(identity.email);
  const fallbackLabel = account.label?.trim() || account.id;
  return `${authSourceLabel(account)} · ${email || fallbackLabel}`;
}

export function resolveCompatibleComposerAccountId(args: {
  accounts: readonly AccountRecord[];
  workerType: string | null | undefined;
  selectedAccountId: string;
}) {
  if (args.selectedAccountId === "auto" || !args.workerType?.trim()) {
    return "auto";
  }

  const workerType = args.workerType.trim().toLowerCase();
  const selectedAccount = args.accounts.find((account) => account.id === args.selectedAccountId);
  if (!selectedAccount?.enabled) {
    return "auto";
  }

  const accountWorkerType = selectedAccount.cliType?.trim().toLowerCase();
  return !accountWorkerType || accountWorkerType === workerType
    ? selectedAccount.id
    : "auto";
}
