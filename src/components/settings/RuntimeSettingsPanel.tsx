import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { t, useI18nSnapshot } from "@/lib/i18n";

interface RuntimeSettingsPanelProps {
  settings: Record<string, string>;
  setSetting: (key: string, value: string) => void;
}

type RecoveryPolicyDraft = {
  autoRecoverImplementationRuns: boolean;
  autoRecoverDirectRuns: boolean;
  maxAutoAttemptsPerIncident: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
  sessionResumeFirst: boolean;
  restartFromCheckpointWhenSessionMissing: boolean;
  preserveQueuedMessages: boolean;
};

const DEFAULT_RECOVERY_POLICY: RecoveryPolicyDraft = {
  autoRecoverImplementationRuns: true,
  autoRecoverDirectRuns: false,
  maxAutoAttemptsPerIncident: 3,
  baseBackoffMs: 5000,
  maxBackoffMs: 60000,
  sessionResumeFirst: true,
  restartFromCheckpointWhenSessionMissing: true,
  preserveQueuedMessages: true,
};

function parseRecoveryPolicy(value: string | undefined): RecoveryPolicyDraft {
  try {
    return { ...DEFAULT_RECOVERY_POLICY, ...JSON.parse(value || "{}") };
  } catch {
    return DEFAULT_RECOVERY_POLICY;
  }
}

function setRecoveryPolicyValue(
  settings: Record<string, string>,
  setSetting: (key: string, value: string) => void,
  patch: Partial<RecoveryPolicyDraft>,
) {
  const current = parseRecoveryPolicy(settings.RECOVERY_POLICY);
  setSetting("RECOVERY_POLICY", JSON.stringify({ ...current, ...patch }));
}

export function RuntimeSettingsPanel({ settings, setSetting }: RuntimeSettingsPanelProps) {
  useI18nSnapshot();
  const recoveryPolicy = parseRecoveryPolicy(settings.RECOVERY_POLICY);
  const busyMessageAction = settings.BUSY_MESSAGE_ACTION === "steer" ? "steer" : "queue";

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-muted-foreground">{t("settings.runtime.defaultSendBehaviour")}</div>
        <div className="inline-flex rounded-xl border border-border/60 bg-muted/30 p-1" role="radiogroup" aria-label={t("settings.runtime.defaultSendBehaviour")}>
          {([
            ["steer", t("settings.runtime.steer")],
            ["queue", t("settings.runtime.queue")],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={busyMessageAction === value}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                busyMessageAction === value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setSetting("BUSY_MESSAGE_ACTION", value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 border-t border-border/60 pt-4">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-muted-foreground">{t("settings.runtime.recovery")}</div>
        </div>

        <label className="flex items-center gap-3 text-xs">
          <Switch
            aria-label={t("settings.runtime.autoRecoverImplementationRuns")}
            checked={recoveryPolicy.autoRecoverImplementationRuns}
            onCheckedChange={(checked) => setRecoveryPolicyValue(settings, setSetting, { autoRecoverImplementationRuns: checked })}
          />
          <span>{t("settings.runtime.autoRecoverImplementationRuns")}</span>
        </label>
        <label className="flex items-center gap-3 text-xs">
          <Switch
            aria-label={t("settings.runtime.autoRecoverDirectRuns")}
            checked={recoveryPolicy.autoRecoverDirectRuns}
            onCheckedChange={(checked) => setRecoveryPolicyValue(settings, setSetting, { autoRecoverDirectRuns: checked })}
          />
          <span>{t("settings.runtime.autoRecoverDirectRuns")}</span>
        </label>
        <label className="flex items-center gap-3 text-xs">
          <Switch
            aria-label={t("settings.runtime.preserveQueuedMessages")}
            checked={recoveryPolicy.preserveQueuedMessages}
            onCheckedChange={(checked) => setRecoveryPolicyValue(settings, setSetting, { preserveQueuedMessages: checked })}
          />
          <span>{t("settings.runtime.preserveQueuedMessages")}</span>
        </label>

        <div className="grid gap-2 sm:grid-cols-3">
          <label className="space-y-1 text-xs">
            <span className="font-medium text-muted-foreground">{t("settings.runtime.attempts")}</span>
            <input
              type="number"
              min={1}
              max={10}
              className="h-8 w-full rounded border bg-muted/50 px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
              value={recoveryPolicy.maxAutoAttemptsPerIncident}
              onChange={(event) => setRecoveryPolicyValue(settings, setSetting, { maxAutoAttemptsPerIncident: Number(event.target.value) || 1 })}
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="font-medium text-muted-foreground">{t("settings.runtime.baseBackoffMs")}</span>
            <input
              type="number"
              min={1000}
              step={1000}
              className="h-8 w-full rounded border bg-muted/50 px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
              value={recoveryPolicy.baseBackoffMs}
              onChange={(event) => setRecoveryPolicyValue(settings, setSetting, { baseBackoffMs: Number(event.target.value) || 1000 })}
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="font-medium text-muted-foreground">{t("settings.runtime.maxBackoffMs")}</span>
            <input
              type="number"
              min={1000}
              step={1000}
              className="h-8 w-full rounded border bg-muted/50 px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
              value={recoveryPolicy.maxBackoffMs}
              onChange={(event) => setRecoveryPolicyValue(settings, setSetting, { maxBackoffMs: Number(event.target.value) || 1000 })}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
