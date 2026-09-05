"use client";

import { lazy, Suspense, useCallback } from "react";
import { CheckCircle2, LogIn, LogOut, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import type { AccountRecord } from "@/interface/home/types";
import type { ClaudeAccountAuthManager } from "@/interface/home/ClaudeAccountAuthManager";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { buildInlineError } from "@/interface/home/utils";
import { cn } from "@/lib/utils";
import { ErrorNotice } from "@/components/home/ErrorNotice";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const ManagedTerminalViewport = lazy(
  () => import("@/components/ManagedTerminalViewport").then((module) => ({ default: module.ManagedTerminalViewport })),
);

function phaseLabel(phase: string) {
  const supported = new Set(["idle", "authenticating", "verifying", "completed", "failed", "cancelled", "interrupted"]);
  return t(`settings.agents.claudeAuth.phase.${supported.has(phase) ? phase : "idle"}`);
}

function accountStatusLabel(status: string | null) {
  if (status === "available") return t("settings.agents.claudeAuth.status.available");
  if (status === "authenticating" || status === "verifying") return phaseLabel(status);
  if (status === "quota_blocked" || status === "quota_exhausted") return t("settings.agents.claudeAuth.status.quotaBlocked");
  if (status === "unknown") return t("common.unknown");
  return t("settings.agents.claudeAuth.status.signInRequired");
}

export function ClaudeAccountSettings({
  accounts,
  manager,
  onRefreshAccounts,
}: {
  accounts: AccountRecord[];
  manager: ClaudeAccountAuthManager;
  onRefreshAccounts: () => Promise<void>;
}) {
  useI18nSnapshot();
  const state = useManagerSnapshot(manager);
  const managedAccounts = accounts.filter(
    (account) => account.cliType === "claude" && ["isolated_cli_home", "local_session"].includes(account.authMode),
  );
  const isolatedAccounts = managedAccounts.filter((account) => account.authMode === "isolated_cli_home");
  const purgeAccount = isolatedAccounts.find((account) => account.id === state.purgeAccountId) ?? null;
  const removeAccount = isolatedAccounts.find((account) => account.id === state.removeAccountId) ?? null;
  const active = state.phase === "authenticating" || state.phase === "verifying";

  const refreshAccounts = useCallback(async () => {
    await onRefreshAccounts();
  }, [onRefreshAccounts]);
  const handleTerminalExit = useCallback(() => {
    void manager.refreshAfterTerminalExit().then(refreshAccounts);
  }, [manager, refreshAccounts]);
  const runAndRefresh = useCallback(async (action: () => Promise<boolean>) => {
    const completed = await action();
    if (completed) await refreshAccounts();
  }, [refreshAccounts]);

  return (
    <section className="space-y-3 rounded-lg border border-border/60 bg-background/70 p-3" aria-label={t("settings.agents.claudeAuth.sectionAriaLabel")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            <h3 className="text-sm font-semibold">{t("settings.agents.claudeAuth.sectionTitle")}</h3>
          </div>
          <p className="max-w-xl text-xs leading-5 text-muted-foreground">
            {t("settings.agents.claudeAuth.sectionDescription")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => void runAndRefresh(() => manager.beginLocalSignIn())}>
            <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
            {t("settings.agents.claudeAuth.signInLocal")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => manager.openConnect()}>
            {t("settings.agents.claudeAuth.connect")}
          </Button>
        </div>
      </div>

      {managedAccounts.length === 0 ? (
        <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          {t("settings.agents.claudeAuth.empty")}
        </p>
      ) : (
        <div className="space-y-2">
          {managedAccounts.map((account) => {
            const isIsolated = account.authMode === "isolated_cli_home";
            const canResume = account.status !== "available"
              && account.status !== "quota_blocked"
              && account.status !== "quota_exhausted";
            return (
              <div key={account.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 px-3 py-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{account.label || account.id}</span>
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      account.status === "available"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                    )}>
                      {accountStatusLabel(account.status)}
                    </span>
                  </div>
                  <p className="mt-0.5 break-all font-mono text-[10px] text-muted-foreground">{account.id}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button type="button" size="sm" variant="ghost" disabled={state.pending} onClick={() => void runAndRefresh(() => manager.refreshStatus(account.id))}>
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("settings.agents.claudeAuth.refresh")}
                  </Button>
                  {canResume ? (
                    <Button type="button" size="sm" variant="outline" disabled={state.pending} onClick={() => void manager.resume(account.id)}>
                      <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("settings.agents.claudeAuth.signIn")}
                    </Button>
                  ) : isIsolated ? (
                    <Button type="button" size="sm" variant="outline" disabled={state.pending} onClick={() => void runAndRefresh(() => manager.logout(account.id))}>
                      <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("settings.agents.claudeAuth.logout")}
                    </Button>
                  ) : null}
                  {isIsolated ? (
                    <>
                      <Button type="button" size="sm" variant="ghost" disabled={state.pending} onClick={() => manager.openRemove(account.id)}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("settings.agents.claudeAuth.remove")}
                      </Button>
                      <Button type="button" size="sm" variant="destructive" disabled={state.pending} onClick={() => manager.openPurge(account.id)}>
                        {t("settings.agents.claudeAuth.purge")}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {state.error ? (
        <ErrorNotice error={buildInlineError(state.error, {
          source: t("settings.agents.claudeAuth.errorSource"),
          action: t("settings.agents.claudeAuth.errorAction"),
        })} />
      ) : null}

      <Dialog open={state.open} onOpenChange={(open) => manager.setOpen(open)}>
        <DialogContent className="flex max-h-[min(760px,calc(100dvh-2rem))] flex-col overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("settings.agents.claudeAuth.title")}</DialogTitle>
            <DialogDescription>{t("settings.agents.claudeAuth.description")}</DialogDescription>
          </DialogHeader>

          {state.loginMode === "isolated" && state.phase === "idle" && !state.accountId ? (
            <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void runAndRefresh(() => manager.begin()); }}>
              <div className="space-y-2">
                <Label htmlFor="claude-account-label">{t("settings.agents.claudeAuth.accountLabel")}</Label>
                <Input
                  id="claude-account-label"
                  autoComplete="off"
                  value={state.label}
                  placeholder={t("settings.agents.claudeAuth.accountLabelPlaceholder")}
                  onChange={(event) => manager.patchDraft({ label: event.currentTarget.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="claude-account-email">{t("settings.agents.claudeAuth.email")}</Label>
                <Input
                  id="claude-account-email"
                  type="email"
                  autoComplete="email"
                  value={state.email}
                  placeholder={t("settings.agents.claudeAuth.emailPlaceholder")}
                  onChange={(event) => manager.patchDraft({ email: event.currentTarget.value })}
                />
                <p className="text-xs text-muted-foreground">{t("settings.agents.claudeAuth.emailHelp")}</p>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
                <Label htmlFor="claude-account-sso" className="flex-col items-start gap-1">
                  <span>{t("settings.agents.claudeAuth.sso")}</span>
                  <span className="text-xs font-normal text-muted-foreground">{t("settings.agents.claudeAuth.ssoHelp")}</span>
                </Label>
                <Switch id="claude-account-sso" checked={state.sso} onCheckedChange={(sso) => manager.patchDraft({ sso })} />
              </div>
              <DialogFooter className="mx-0 mb-0 px-0 pb-0">
                <Button type="button" variant="ghost" onClick={() => manager.setOpen(false)}>{t("common.cancel")}</Button>
                <Button type="submit" disabled={state.pending || !state.label.trim()}>
                  {state.pending ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <LogIn className="h-4 w-4" aria-hidden="true" />}
                  {t("settings.agents.claudeAuth.startSignIn")}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
              <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
                <div>
                  <p className="text-xs font-medium text-foreground">{phaseLabel(state.phase)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {active ? t("settings.agents.claudeAuth.closeKeepsRunning") : t("settings.agents.claudeAuth.operationFinished")}
                  </p>
                </div>
                {state.phase === "completed" ? <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" /> : null}
              </div>

              {state.terminalId ? (
                <div className="h-[min(360px,45dvh)] overflow-hidden rounded-lg border border-border/60 bg-black p-1">
                  <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-white/60">{t("settings.agents.claudeAuth.loadingTerminal")}</div>}>
                    <ManagedTerminalViewport terminalId={state.terminalId} className="h-full" onExit={handleTerminalExit} />
                  </Suspense>
                </div>
              ) : null}

              {state.operationError ? (
                <ErrorNotice error={{
                  source: t("settings.agents.claudeAuth.errorSource"),
                  action: t("settings.agents.claudeAuth.errorAction"),
                  message: state.operationError.message,
                }} />
              ) : null}

              <DialogFooter className="mx-0 mb-0 px-0 pb-0">
                {active ? (
                  <Button type="button" variant="destructive" disabled={state.pending} onClick={() => void runAndRefresh(() => manager.cancel())}>
                    {t("settings.agents.claudeAuth.cancelSignIn")}
                  </Button>
                ) : state.phase !== "completed" ? (
                  <Button type="button" variant="outline" disabled={state.pending} onClick={() => void manager.retry()}>
                    {t("settings.agents.claudeAuth.retry")}
                  </Button>
                ) : null}
                <Button type="button" variant={state.phase === "completed" ? "default" : "ghost"} onClick={() => manager.setOpen(false)}>
                  {state.phase === "completed" ? t("settings.agents.claudeAuth.dialogDone") : t("settings.agents.claudeAuth.dialogClose")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={state.removeAccountId !== null} onOpenChange={(open) => { if (!open) manager.closeRemove(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.agents.claudeAuth.removeTitle")}</DialogTitle>
            <DialogDescription>{t("settings.agents.claudeAuth.removeDescription", { account: removeAccount?.label || state.removeAccountId || "" })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => manager.closeRemove()}>{t("common.cancel")}</Button>
            <Button type="button" variant="destructive" disabled={state.pending} onClick={() => void runAndRefresh(() => manager.confirmRemove())}>
              {t("settings.agents.claudeAuth.removeConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={state.purgeAccountId !== null} onOpenChange={(open) => { if (!open) manager.closePurge(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.agents.claudeAuth.purgeTitle")}</DialogTitle>
            <DialogDescription>{t("settings.agents.claudeAuth.purgeDescription", { account: purgeAccount?.label || state.purgeAccountId || "" })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="claude-purge-confirmation">{t("settings.agents.claudeAuth.purgeConfirmationLabel", { accountId: state.purgeAccountId || "" })}</Label>
            <Input
              id="claude-purge-confirmation"
              autoComplete="off"
              value={state.purgeConfirmation}
              onChange={(event) => manager.setPurgeConfirmation(event.currentTarget.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => manager.closePurge()}>{t("common.cancel")}</Button>
            <Button
              type="button"
              variant="destructive"
              disabled={state.pending || state.purgeConfirmation !== state.purgeAccountId}
              onClick={() => void runAndRefresh(() => manager.confirmPurge())}
            >
              {t("settings.agents.claudeAuth.purgeConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
