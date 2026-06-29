import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Power, RefreshCw } from "lucide-react";
import { WORKER_OPTIONS } from "@/app/home/constants";
import type { AccountRecord, WorkerAvailability, WorkerModelCatalog, WorkerType } from "@/app/home/types";
import { buildInlineError, parseBooleanSetting, parseWorkerType, parseWorkerTypes } from "@/app/home/utils";
import type { AppErrorDescriptor } from "@/lib/app-errors";
import { requestJson } from "@/lib/app-errors";
import { cn } from "@/lib/utils";
import { ErrorNotice } from "@/components/home/ErrorNotice";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { getWorkerAvailabilityMessage } from "./worker-availability-copy";

interface AgentsSettingsPanelProps {
  settings: Record<string, string>;
  setSetting: (key: string, value: string) => void;
  settingsWorkers: WorkerAvailability[];
  accounts: AccountRecord[];
  onAccountsChanged: (accounts: AccountRecord[]) => void;
  onRefreshAccounts: () => Promise<void>;
  workerModels?: Partial<WorkerModelCatalog>;
  workerModelsRefreshing?: boolean;
  workerCatalogQuery: {
    isError: boolean;
    isFetching?: boolean;
    error: unknown;
    data?: { diagnostics?: AppErrorDescriptor[] };
  };
  onRefreshWorkerCatalog: () => void;
  workerCatalogRefreshing: boolean;
}

export function AgentsSettingsPanel({
  settings,
  setSetting,
  settingsWorkers,
  accounts,
  onAccountsChanged,
  onRefreshAccounts,
  workerModels,
  workerModelsRefreshing = false,
  workerCatalogQuery,
  onRefreshWorkerCatalog,
  workerCatalogRefreshing,
}: AgentsSettingsPanelProps) {
  useI18nSnapshot();
  const [accountActionError, setAccountActionError] = useState<unknown>(null);
  const [pendingAccountAction, setPendingAccountAction] = useState<string | null>(null);
  const configuredAllowedWorkerTypes = parseWorkerTypes(settings.WORKER_ALLOWED_TYPES);
  const configuredAllowedWorkerSet = new Set(configuredAllowedWorkerTypes);
  const availableWorkerTypes = new Set(
    settingsWorkers
      .filter((worker) => worker.availability.status === "ok")
      .map((worker) => worker.type),
  );
  const displayedAllowedWorkerTypes = configuredAllowedWorkerTypes.filter((type) => availableWorkerTypes.has(type));
  const displayedAllowedWorkerSet = new Set(displayedAllowedWorkerTypes);
  const defaultWorkerType = parseWorkerType(settings.WORKER_DEFAULT_TYPE) ?? displayedAllowedWorkerTypes[0] ?? configuredAllowedWorkerTypes[0] ?? "codex";
  const yoloEnabled = parseBooleanSetting(settings.WORKER_YOLO_MODE, true);
  const memoryEnabled = parseBooleanSetting(settings.SUPERVISOR_MEMORY_ENABLED, true);
  const defaultWorkerOptions = WORKER_OPTIONS
    .filter((option) => displayedAllowedWorkerSet.has(option.value))
    .map((option) => ({ value: option.value, label: option.label }));
  const orderedWorkers = [
    ...configuredAllowedWorkerTypes.flatMap((type) => settingsWorkers.find((worker) => worker.type === type) ?? []),
    ...settingsWorkers.filter((worker) => !configuredAllowedWorkerSet.has(worker.type)),
  ];
  const accountsByWorkerType = new Map<string, AccountRecord[]>();
  for (const account of accounts) {
    const key = account.cliType || "";
    if (!key) continue;
    accountsByWorkerType.set(key, [...(accountsByWorkerType.get(key) ?? []), account]);
  }

  const persistAllowedWorkerOrder = (nextAllowed: WorkerType[]) => {
    setSetting("WORKER_ALLOWED_TYPES", JSON.stringify(nextAllowed));
    setSetting("WORKER_DEFAULT_TYPE", nextAllowed[0] ?? "codex");
  };

  const toggleAllowedWorker = (workerType: WorkerType, checked: boolean) => {
    const nextAllowed = checked
      ? Array.from(new Set([...configuredAllowedWorkerTypes, workerType]))
      : configuredAllowedWorkerTypes.filter((type) => type !== workerType);

    if (nextAllowed.length === 0) {
      return;
    }

    persistAllowedWorkerOrder(nextAllowed);
  };

  const moveAllowedWorker = (workerType: WorkerType, direction: -1 | 1) => {
    const currentIndex = configuredAllowedWorkerTypes.indexOf(workerType);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= configuredAllowedWorkerTypes.length) {
      return;
    }

    const nextAllowed = [...configuredAllowedWorkerTypes];
    [nextAllowed[currentIndex], nextAllowed[nextIndex]] = [nextAllowed[nextIndex], nextAllowed[currentIndex]];
    persistAllowedWorkerOrder(nextAllowed);
  };

  const setDefaultWorkerType = (workerType: string) => {
    const parsedWorkerType = parseWorkerType(workerType);
    if (!parsedWorkerType || !configuredAllowedWorkerSet.has(parsedWorkerType)) {
      return;
    }

    persistAllowedWorkerOrder([
      parsedWorkerType,
      ...configuredAllowedWorkerTypes.filter((type) => type !== parsedWorkerType),
    ]);
  };

  const workerProvider = (workerType: WorkerType) => {
    if (workerType === "claude") return "anthropic";
    if (workerType === "gemini") return "google";
    if (workerType === "opencode") return "opencode";
    return "openai";
  };

  const runAccountAction = async (actionKey: string, action: () => Promise<void>) => {
    setAccountActionError(null);
    setPendingAccountAction(actionKey);
    try {
      await action();
      await onRefreshAccounts();
    } catch (error) {
      setAccountActionError(error);
    } finally {
      setPendingAccountAction(null);
    }
  };

  const createLocalAccount = (worker: WorkerAvailability) => runAccountAction(`create:${worker.type}`, async () => {
    const nextAccount = await requestJson<AccountRecord>("/api/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: `local-session-${worker.type}`,
        cliType: worker.type,
        provider: workerProvider(worker.type),
        type: "external",
        label: t("settings.agents.localAccountLabel", { worker: worker.label }),
        authMode: "local_session",
        authRef: `local:${worker.type}`,
      }),
    }, {
      source: t("settings.agents.accountActionErrorSource"),
      action: t("settings.agents.createAccountAction"),
    });
    onAccountsChanged([...accounts.filter((account) => account.id !== nextAccount.id), nextAccount]);
  });

  const setAccountEnabled = (account: AccountRecord, enabled: boolean) => runAccountAction(`enabled:${account.id}`, async () => {
    const nextAccount = await requestJson<AccountRecord>(`/api/accounts/${encodeURIComponent(account.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled }),
    }, {
      source: t("settings.agents.accountActionErrorSource"),
      action: t("settings.agents.updateAccountAction"),
    });
    onAccountsChanged(accounts.map((item) => (item.id === nextAccount.id ? nextAccount : item)));
  });

  const refreshAccountStatus = (account: AccountRecord) => runAccountAction(`status:${account.id}`, async () => {
    const nextAccount = await requestJson<AccountRecord>(`/api/accounts/${encodeURIComponent(account.id)}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: account.status ?? "unknown" }),
    }, {
      source: t("settings.agents.accountActionErrorSource"),
      action: t("settings.agents.refreshAccountStatusAction"),
    });
    onAccountsChanged(accounts.map((item) => (item.id === nextAccount.id ? nextAccount : item)));
  });

  const formatTokenCount = (value: number | null | undefined) => (
    typeof value === "number" && Number.isFinite(value) ? new Intl.NumberFormat().format(value) : null
  );

  const formatTokenQuota = (worker: WorkerAvailability) => {
    const quota = worker.tokenQuota;
    if (!quota) {
      return t("settings.agents.monthlyTokensUnknown");
    }

    const remaining = formatTokenCount(quota.remainingTokens);
    const limit = formatTokenCount(quota.monthlyLimitTokens);
    const used = formatTokenCount(quota.usedTokens);

    if (quota.status === "reported" && remaining) {
      return limit
        ? t("settings.agents.monthlyTokensRemainingOf", { remaining, limit })
        : t("settings.agents.monthlyTokensRemaining", { remaining });
    }

    if (quota.status === "usage_only" && used) {
      return t("settings.agents.monthlyTokensUsageOnly", { used });
    }

    return t("settings.agents.monthlyTokensUnknown");
  };

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
      <div className="flex items-center gap-3">
        <label className="shrink-0 text-xs font-semibold text-muted-foreground" htmlFor="WORKER_DEFAULT_TYPE">
          {t("settings.agents.defaultWorker")}
        </label>
        <Select
          id="WORKER_DEFAULT_TYPE"
          className="w-auto"
          value={defaultWorkerType}
          options={defaultWorkerOptions}
          onValueChange={setDefaultWorkerType}
        />
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/70 p-3">
        <Switch
          id="WORKER_YOLO_MODE"
          aria-label={t("settings.agents.toggleDangerouslySkipPermissions")}
          checked={yoloEnabled}
          onCheckedChange={(checked) => setSetting("WORKER_YOLO_MODE", checked ? "true" : "false")}
        />
        <div className="min-w-0 space-y-1">
          <div className="text-sm font-medium">{t("settings.agents.dangerouslySkipPermissions")}</div>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/70 p-3">
        <Switch
          id="SUPERVISOR_MEMORY_ENABLED"
          aria-label={t("settings.agents.toggleSupervisorMemory")}
          checked={memoryEnabled}
          onCheckedChange={(checked) => setSetting("SUPERVISOR_MEMORY_ENABLED", checked ? "true" : "false")}
        />
        <div className="min-w-0 space-y-1">
          <div className="text-sm font-medium">{t("settings.agents.supervisorMemory")}</div>
          <p className="text-xs text-muted-foreground">{t("settings.agents.supervisorMemoryHelp")}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <div className="text-xs font-semibold text-muted-foreground">{t("settings.agents.workerAvailability")}</div>
              <div className="text-xs font-medium text-foreground">{t("settings.agents.autoPriority")}</div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefreshWorkerCatalog}
              disabled={workerCatalogRefreshing}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", workerCatalogRefreshing && "animate-spin")} aria-hidden="true" />
              {workerCatalogRefreshing ? t("settings.agents.refreshingAvailability") : t("settings.agents.refreshAvailability")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("settings.agents.autoPriorityHelp")}</p>
        </div>
        {orderedWorkers.map((worker) => {
          const isAvailable = worker.availability.status === "ok";
          const isChecked = displayedAllowedWorkerSet.has(worker.type);
          const priorityIndex = displayedAllowedWorkerTypes.indexOf(worker.type);
          const canMoveUp = isChecked && priorityIndex > 0;
          const canMoveDown = isChecked && priorityIndex >= 0 && priorityIndex < displayedAllowedWorkerTypes.length - 1;
                  const modelOptions = workerModels?.[worker.type] ?? [];
                  const workerAccounts = accountsByWorkerType.get(worker.type) ?? [];
          const hasLocalAccount = workerAccounts.some((account) => account.authMode === "local_session");
          const availabilityMessage = isAvailable ? null : getWorkerAvailabilityMessage(worker);
          const availabilityTone =
            worker.availability.status === "ok"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : worker.availability.status === "warning"
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                : "bg-destructive/10 text-destructive";

          return (
            <div
              key={worker.type}
              className={cn(
                "flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-background/70 p-3",
                !isAvailable && "opacity-70",
              )}
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <Switch
                  aria-label={t("settings.agents.toggleWorker", { worker: worker.label })}
                  className="mt-0.5"
                  checked={isChecked}
                  disabled={!isAvailable || (isChecked && displayedAllowedWorkerTypes.length === 1)}
                  onCheckedChange={(checked) => toggleAllowedWorker(worker.type, checked)}
                />
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium break-words">{worker.label}</span>
                    {isChecked ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                        {t("settings.agents.priorityRank", { rank: String(priorityIndex + 1) })}
                      </span>
                    ) : null}
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]", availabilityTone)}>
                      {worker.availability.status}
                    </span>
                  </div>
                  {availabilityMessage ? (
                    <p className="text-xs break-words text-muted-foreground">
                      {availabilityMessage}
                    </p>
                  ) : null}
                  <dl className="grid gap-x-3 gap-y-1 pt-1 text-[11px] text-muted-foreground sm:grid-cols-[max-content_minmax(0,1fr)]">
                    <dt className="whitespace-nowrap font-medium text-foreground/70">{t("settings.agents.installedDir")}</dt>
                    <dd className="min-w-0 truncate" title={worker.installation?.path ?? undefined}>
                      {worker.installation?.dir ?? (worker.availability.binary ? t("common.unknown") : t("settings.agents.notInstalled"))}
                    </dd>
                    <dt className="whitespace-nowrap font-medium text-foreground/70">{t("settings.agents.monthlyTokens")}</dt>
                    <dd className="min-w-0 truncate" title={worker.tokenQuota?.source}>
                      {formatTokenQuota(worker)}
                    </dd>
                    <dt className="whitespace-nowrap font-medium text-foreground/70">{t("settings.agents.accounts")}</dt>
                    <dd className="min-w-0">
                      <div className="space-y-1">
                        {workerAccounts.length > 0 ? (
                          <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto pr-1">
                            {workerAccounts.map((account) => (
                              <span
                              key={account.id}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px]",
                                  account.enabled
                                    ? "bg-muted text-foreground/80"
                                    : "bg-muted/50 text-muted-foreground line-through",
                                )}
                              >
                                <span>{account.label || `${account.provider} ${account.type}`}</span>
                                <button
                                  type="button"
                                  className="rounded-sm p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                                  aria-label={t("settings.agents.refreshAccountStatus", { account: account.label || account.id })}
                                  disabled={pendingAccountAction !== null}
                                  onClick={() => refreshAccountStatus(account)}
                                >
                                  <RefreshCw className={cn("h-3 w-3", pendingAccountAction === `status:${account.id}` && "animate-spin")} aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  className="rounded-sm p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                                  aria-label={account.enabled
                                    ? t("settings.agents.disableAccount", { account: account.label || account.id })
                                    : t("settings.agents.enableAccount", { account: account.label || account.id })}
                                  disabled={pendingAccountAction !== null}
                                  onClick={() => setAccountEnabled(account, !account.enabled)}
                                >
                                  <Power className="h-3 w-3" aria-hidden="true" />
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span>{t("settings.agents.accountsNone")}</span>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={hasLocalAccount || pendingAccountAction !== null}
                          onClick={() => createLocalAccount(worker)}
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                          {t("settings.agents.addLocalAccount")}
                        </Button>
                      </div>
                    </dd>
                    <dt className="whitespace-nowrap font-medium text-foreground/70">{t("settings.tabs.models")}</dt>
                    <dd className="min-w-0">
                      {modelOptions.length > 0 ? (
                        <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto pr-1">
                          {modelOptions.map((model) => (
                            <span key={model.value} className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-foreground/80">
                              {model.label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span>{workerModelsRefreshing ? t("settings.models.loadingModels") : t("settings.agents.noModelsReported")}</span>
                      )}
                    </dd>
                  </dl>
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("settings.agents.moveWorkerUp", { worker: worker.label })}
                  disabled={!canMoveUp}
                  onClick={() => moveAllowedWorker(worker.type, -1)}
                >
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("settings.agents.moveWorkerDown", { worker: worker.label })}
                  disabled={!canMoveDown}
                  onClick={() => moveAllowedWorker(worker.type, 1)}
                >
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {accountActionError ? (
        <ErrorNotice
          error={buildInlineError(accountActionError, {
            source: t("settings.agents.accountActionErrorSource"),
            action: t("settings.agents.updateAccountAction"),
          })}
        />
      ) : null}

      {workerCatalogQuery.isError ? (
        <ErrorNotice
          error={buildInlineError(workerCatalogQuery.error, {
            source: t("settings.agents.errorSource"),
            action: t("settings.agents.loadWorkerAvailability"),
          })}
        />
      ) : null}
    </div>
  );
}
