type AccountLaunchPolicyInput = {
  cliType: string | null;
  authMode: string;
  enabled: boolean;
  status: string | null;
  lifecycleOperationErrorCode: string | null;
};

export function canBypassDisabledAccountAfterAuthTimeout(account: AccountLaunchPolicyInput) {
  return account.cliType === "claude"
    && account.authMode === "local_session"
    && !account.enabled
    && ["unknown", "auth_failed", "login_required"].includes(account.status ?? "")
    && account.lifecycleOperationErrorCode === "account.auth.timeout";
}

export function canAttemptAccountLaunch(account: AccountLaunchPolicyInput) {
  return account.enabled || canBypassDisabledAccountAfterAuthTimeout(account);
}
