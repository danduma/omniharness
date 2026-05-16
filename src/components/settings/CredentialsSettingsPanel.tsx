import { Check, X } from "lucide-react";
import { WORKER_OPTIONS } from "@/app/home/constants";
import type { WorkerType } from "@/app/home/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { t, useI18nSnapshot } from "@/lib/i18n";

interface CredentialsSettingsPanelProps {
  settings: Record<string, string>;
  setSetting: (key: string, value: string) => void;
}

function commandKeyForWorker(workerType: WorkerType) {
  return `OMNIHARNESS_CREDENTIAL_COMMAND_${workerType.toUpperCase()}`;
}

function argsKeyForWorker(workerType: WorkerType) {
  return `OMNIHARNESS_CREDENTIAL_COMMAND_ARGS_${workerType.toUpperCase()}`;
}

function isConfigured(value: string | undefined) {
  return Boolean(value?.trim());
}

function CredentialStatus({ configured }: { configured: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        configured
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "bg-muted text-muted-foreground",
      )}
    >
      {configured ? <Check className="h-3 w-3" aria-hidden="true" /> : <X className="h-3 w-3" aria-hidden="true" />}
      {configured ? t("settings.credentials.configured") : t("settings.credentials.notConfigured")}
    </span>
  );
}

export function CredentialsSettingsPanel({
  settings,
  setSetting,
}: CredentialsSettingsPanelProps) {
  useI18nSnapshot();
  const compactInputClassName = "h-7 rounded-md px-2 text-xs md:text-xs";

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
        <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="OMNIHARNESS_CREDENTIAL_PROFILES_DIR">
            {t("settings.credentials.profilesDir")}
          </label>
          <Input
            id="OMNIHARNESS_CREDENTIAL_PROFILES_DIR"
            className={compactInputClassName}
            value={settings.OMNIHARNESS_CREDENTIAL_PROFILES_DIR ?? ""}
            placeholder=".omniharness/credential-profiles"
            onChange={(event) => setSetting("OMNIHARNESS_CREDENTIAL_PROFILES_DIR", event.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground">{t("settings.credentials.profilesDirHelp")}</p>
      </section>

      <section className="space-y-3 rounded-xl border border-border/60 bg-background/70 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{t("settings.credentials.providerScripts")}</h3>
            <p className="max-w-[64ch] text-xs text-muted-foreground">{t("settings.credentials.providerScriptsHelp")}</p>
          </div>
        </div>

        <div className="space-y-3">
          {WORKER_OPTIONS.map((worker) => {
            const commandKey = commandKeyForWorker(worker.value);
            const argsKey = argsKeyForWorker(worker.value);
            const configured = isConfigured(settings[commandKey]);
            return (
              <div key={worker.value} className="rounded-lg border border-border/50 p-2.5">
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-medium">{worker.label}</div>
                    <CredentialStatus configured={configured} />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!configured && !(settings[argsKey] ?? "").trim()}
                    onClick={() => {
                      setSetting(commandKey, "");
                      setSetting(argsKey, "");
                    }}
                  >
                    {t("common.clear")}
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1.5fr)_minmax(140px,0.65fr)]">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground" htmlFor={commandKey}>
                      {t("settings.credentials.script")}
                    </label>
                    <Input
                      id={commandKey}
                      className={compactInputClassName}
                      value={settings[commandKey] ?? ""}
                      placeholder="/path/to/credential-provider"
                      onChange={(event) => setSetting(commandKey, event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground" htmlFor={argsKey}>
                      {t("settings.credentials.arguments")}
                    </label>
                    <Input
                      id={argsKey}
                      className={compactInputClassName}
                      value={settings[argsKey] ?? ""}
                      placeholder="[]"
                      onChange={(event) => setSetting(argsKey, event.target.value)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">{t("settings.credentials.providerContract")}</p>
      </section>
    </div>
  );
}
