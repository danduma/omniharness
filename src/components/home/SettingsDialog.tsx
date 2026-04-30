import type React from "react";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { type AppErrorDescriptor, appErrorKey, requestJson } from "@/lib/app-errors";
import { LLM_PROVIDER_OPTIONS, WORKER_OPTIONS } from "@/app/home/constants";
import type { LlmFieldPrefix, LlmProfileTab, SettingsTab, WorkerAvailability, WorkerType } from "@/app/home/types";
import { buildInlineError, parseBooleanSetting, parseWorkerType } from "@/app/home/utils";
import { cn } from "@/lib/utils";
import { ErrorNotice } from "./ErrorNotice";

function LlmSettingsForm({
  prefix,
  title,
  description,
  apiKeys,
  setApiKeys,
  secretStates,
}: {
  prefix: LlmFieldPrefix;
  title: string;
  description: string;
  apiKeys: Record<string, string>;
  setApiKeys: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  secretStates?: Record<string, { configured: boolean; updatedAt: string }>;
}) {
  const providerKey = `${prefix}_PROVIDER`;
  const modelKey = `${prefix}_MODEL`;
  const baseUrlKey = `${prefix}_BASE_URL`;
  const apiKeyKey = `${prefix}_API_KEY`;
  const defaultProvider = prefix === "SUPERVISOR_LLM" ? "gemini" : "openai";
  const provider = apiKeys[providerKey] || defaultProvider;
  const apiKey = apiKeys[apiKeyKey] || "";
  const currentModel = apiKeys[modelKey] || "";
  const apiKeyConfigured = secretStates?.[apiKeyKey]?.configured ?? false;

  const geminiModelsQuery = useQuery({
    queryKey: ["llm-models", prefix, provider, apiKey],
    enabled: provider === "gemini" && apiKey.trim().length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      return requestJson<{ models: Array<{ id: string; label: string }> }>("/api/llm-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey,
        }),
      }, {
        source: "LLM Settings",
        action: "Fetch available models",
      });
    },
  });
  const availableModels = useMemo(() => geminiModelsQuery.data?.models ?? [], [geminiModelsQuery.data?.models]);

  useEffect(() => {
    if (provider !== "gemini") {
      return;
    }

    if (!availableModels.length) {
      return;
    }

    if (!currentModel.trim()) {
      setApiKeys((previous) => ({ ...previous, [modelKey]: availableModels[0].id }));
    }
  }, [availableModels, currentModel, modelKey, provider, setApiKeys]);

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
      <div className="space-y-1">
        <div className="text-sm font-semibold">{title}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor={providerKey}>
            Provider
          </label>
          <select
            id={providerKey}
            className="h-8 w-full rounded border bg-muted/50 px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
            value={apiKeys[providerKey] || defaultProvider}
            onChange={(e) => setApiKeys((previous) => ({ ...previous, [providerKey]: e.target.value }))}
          >
            {LLM_PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor={modelKey}>
            Model
          </label>
          {provider === "gemini" ? (
            <Combobox
              items={availableModels}
              value={availableModels.find((model) => model.id === currentModel) ?? null}
              itemToStringValue={(model) => model.label}
              onValueChange={(model) => {
                setApiKeys((previous) => ({
                  ...previous,
                  [modelKey]: model?.id ?? "",
                }));
              }}
              disabled={!apiKey.trim() || geminiModelsQuery.isPending}
            >
              <ComboboxInput
                id={modelKey}
                aria-label="Model"
                placeholder={
                  !apiKey.trim()
                    ? "Enter API key first"
                    : geminiModelsQuery.isPending
                      ? "Loading models..."
                      : "Search Gemini models"
                }
                className="w-full"
              />
              <ComboboxContent className="w-[var(--anchor-width)]">
                <ComboboxEmpty>
                  {!apiKey.trim()
                    ? "Enter API key first"
                    : geminiModelsQuery.isPending
                      ? "Loading models..."
                      : "No Gemini models available"}
                </ComboboxEmpty>
                <ComboboxList>
                  {(model) => (
                    <ComboboxItem key={model.id} value={model}>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">{model.label}</span>
                        <span className="truncate text-[11px] text-muted-foreground">{model.id}</span>
                      </div>
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          ) : (
            <Input
              id={modelKey}
              value={currentModel}
              onChange={(e) => setApiKeys((previous) => ({ ...previous, [modelKey]: e.target.value }))}
              placeholder={prefix === "SUPERVISOR_LLM" ? "gemini-3.1-pro-preview" : "gpt-5.4-mini"}
              className="h-8 bg-muted/50 text-xs"
            />
          )}
          {provider === "gemini" ? (
            <p className="text-[11px] text-muted-foreground">
              Gemini model ids load automatically from the API key and appear in a searchable dropdown.
            </p>
          ) : null}
          {geminiModelsQuery.isError ? (
            <p className="text-[11px] text-destructive">
              {geminiModelsQuery.error instanceof Error ? geminiModelsQuery.error.message : "Unable to fetch available models."}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor={baseUrlKey}>
            Endpoint
          </label>
          <Input
            id={baseUrlKey}
            value={apiKeys[baseUrlKey] || ""}
            onChange={(e) => setApiKeys((previous) => ({ ...previous, [baseUrlKey]: e.target.value }))}
            placeholder="Optional custom base URL"
            className="h-8 bg-muted/50 text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor={apiKeyKey}>
            API Key
          </label>
          <Input
            id={apiKeyKey}
            type="password"
            value={apiKeys[apiKeyKey] || ""}
            onChange={(e) => setApiKeys((previous) => ({ ...previous, [apiKeyKey]: e.target.value }))}
            placeholder={apiKeyConfigured ? "Saved credential" : "Provider credential"}
            className="h-8 bg-muted/50 text-xs"
          />
          {apiKeyConfigured && !apiKeys[apiKeyKey]?.trim() ? (
            <p className="text-[11px] text-muted-foreground">
              Credential saved. Enter a new value to replace it.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeSettingsTab: SettingsTab;
  setActiveSettingsTab: React.Dispatch<React.SetStateAction<SettingsTab>>;
  activeLlmProfileTab: LlmProfileTab;
  setActiveLlmProfileTab: React.Dispatch<React.SetStateAction<LlmProfileTab>>;
  apiKeys: Record<string, string>;
  setApiKeys: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  secretStates?: Record<string, { configured: boolean; updatedAt: string }>;
  settingsWorkers: WorkerAvailability[];
  configuredAllowedWorkerSet: Set<WorkerType>;
  configuredAllowedWorkerTypes: WorkerType[];
  handleToggleAllowedWorker: (workerType: WorkerType, checked: boolean) => void;
  workerCatalogQuery: {
    isError: boolean;
    error: unknown;
    data?: { diagnostics?: AppErrorDescriptor[] };
  };
  settingsDiagnostics: AppErrorDescriptor[];
  saveSettings: {
    error: unknown;
    isPending: boolean;
    mutate: () => void;
  };
}

export function SettingsDialog({
  open,
  onOpenChange,
  activeSettingsTab,
  setActiveSettingsTab,
  activeLlmProfileTab,
  setActiveLlmProfileTab,
  apiKeys,
  setApiKeys,
  secretStates,
  settingsWorkers,
  configuredAllowedWorkerSet,
  configuredAllowedWorkerTypes,
  handleToggleAllowedWorker,
  workerCatalogQuery,
  settingsDiagnostics,
  saveSettings,
}: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>OmniHarness Configuration</DialogTitle>
          <DialogDescription>
            Configure primary and fallback supervisor LLM credentials for this workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="inline-flex rounded-xl border border-border/60 bg-muted/30 p-1">
            <button
              type="button"
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                activeSettingsTab === "llm"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={activeSettingsTab === "llm"}
              onClick={() => setActiveSettingsTab("llm")}
            >
              LLM Settings
            </button>
            <button
              type="button"
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                activeSettingsTab === "workers"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={activeSettingsTab === "workers"}
              onClick={() => setActiveSettingsTab("workers")}
            >
              Worker Agents
            </button>
          </div>

          {activeSettingsTab === "llm" ? (
            <>
              <div className="space-y-3">
                <div className="inline-flex rounded-xl border border-border/60 bg-muted/30 p-1">
                  <button
                    type="button"
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                      activeLlmProfileTab === "supervisor"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    aria-pressed={activeLlmProfileTab === "supervisor"}
                    onClick={() => setActiveLlmProfileTab("supervisor")}
                  >
                    Supervisor Credentials
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                      activeLlmProfileTab === "fallback"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    aria-pressed={activeLlmProfileTab === "fallback"}
                    onClick={() => setActiveLlmProfileTab("fallback")}
                  >
                    Fallback Credentials
                  </button>
                </div>

                {activeLlmProfileTab === "supervisor" ? (
                  <LlmSettingsForm
                    prefix="SUPERVISOR_LLM"
                    title="Supervisor LLM"
                    description="Configure the provider, model, endpoint, and credentials used first for supervisor turns."
                    apiKeys={apiKeys}
                    setApiKeys={setApiKeys}
                    secretStates={secretStates}
                  />
                ) : (
                  <LlmSettingsForm
                    prefix="SUPERVISOR_FALLBACK_LLM"
                    title="Fallback LLM"
                    description="Use a second provider profile if the primary supervisor credentials are unavailable."
                    apiKeys={apiKeys}
                    setApiKeys={setApiKeys}
                    secretStates={secretStates}
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Credit Exhaustion Strategy</label>
                <select
                  className="h-8 w-full rounded border bg-muted/50 px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                  value={apiKeys.CREDIT_STRATEGY || "swap_account"}
                  onChange={e => setApiKeys(p => ({ ...p, CREDIT_STRATEGY: e.target.value }))}
                >
                  <option value="swap_account">Swap Account</option>
                  <option value="fallback_api">Fallback API</option>
                  <option value="wait_for_reset">Wait for Reset</option>
                  <option value="cross_provider">Cross Provider</option>
                </select>
              </div>
            </>
          ) : (
            <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="space-y-1">
                <div className="text-sm font-semibold">Worker Agents</div>
                <p className="text-xs text-muted-foreground">
                  Only currently available bridge workers can be enabled for new conversations.
                </p>
              </div>

              <div className="space-y-2">
                {settingsWorkers.map((worker) => {
                  const isAvailable = worker.availability.status === "ok";
                  const isChecked = configuredAllowedWorkerSet.has(worker.type);
                  const availabilityTone =
                    worker.availability.status === "ok"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : worker.availability.status === "warning"
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        : "bg-destructive/10 text-destructive";

                  return (
                    <label
                      key={worker.type}
                      className={cn(
                        "flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-background/70 p-3",
                        !isAvailable && "opacity-70",
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 rounded border-border"
                          checked={isChecked}
                          disabled={!isAvailable || (isChecked && configuredAllowedWorkerTypes.length === 1)}
                          onChange={(event) => handleToggleAllowedWorker(worker.type, event.target.checked)}
                        />
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium break-words">{worker.label}</span>
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]", availabilityTone)}>
                              {worker.availability.status}
                            </span>
                          </div>
                          <p className="text-xs break-words text-muted-foreground">
                            {worker.availability.message || (isAvailable ? "Ready to spawn from the bridge." : "Unavailable right now.")}
                          </p>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="WORKER_DEFAULT_TYPE">
                  Default Worker Agent
                </label>
                <select
                  id="WORKER_DEFAULT_TYPE"
                  className="h-8 w-full rounded border bg-muted/50 px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                  value={parseWorkerType(apiKeys.WORKER_DEFAULT_TYPE) ?? configuredAllowedWorkerTypes[0] ?? "codex"}
                  onChange={(event) => setApiKeys((current) => ({ ...current, WORKER_DEFAULT_TYPE: event.target.value }))}
                >
                  {WORKER_OPTIONS
                    .filter((option) => configuredAllowedWorkerSet.has(option.value))
                    .map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                  ))}
                </select>
              </div>

              <label className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-background/70 p-3" htmlFor="WORKER_YOLO_MODE">
                <div className="min-w-0 space-y-1">
                  <div className="text-sm font-medium">YOLO Worker Mode</div>
                  <p className="text-xs text-muted-foreground">
                    Default new workers to the runtime&apos;s most permissive mode so routine approvals rarely interrupt execution.
                  </p>
                </div>
                <input
                  id="WORKER_YOLO_MODE"
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-border"
                  checked={parseBooleanSetting(apiKeys.WORKER_YOLO_MODE, true)}
                  onChange={(event) => setApiKeys((current) => ({
                    ...current,
                    WORKER_YOLO_MODE: event.target.checked ? "true" : "false",
                  }))}
                />
              </label>

              {workerCatalogQuery.isError ? (
                <ErrorNotice
                  error={buildInlineError(workerCatalogQuery.error, {
                    source: "Agent runtime",
                    action: "Load worker availability",
                  })}
                />
              ) : null}
            </div>
          )}

          {settingsDiagnostics.length > 0 ? (
            <div className="space-y-3">
              {settingsDiagnostics.map((error) => (
                <ErrorNotice key={appErrorKey(error)} error={error} />
              ))}
            </div>
          ) : null}

          {workerCatalogQuery.data?.diagnostics?.length ? (
            <div className="space-y-3">
              {workerCatalogQuery.data.diagnostics.map((error) => (
                <ErrorNotice key={appErrorKey(error)} error={error} />
              ))}
            </div>
          ) : null}

          {saveSettings.error ? (
            <ErrorNotice
              error={buildInlineError(saveSettings.error, {
                source: "Settings",
                action: "Save settings",
              })}
            />
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
