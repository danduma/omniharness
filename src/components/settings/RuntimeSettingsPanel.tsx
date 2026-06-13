import { Switch } from "@/components/ui/switch";
import { t, useI18nSnapshot } from "@/lib/i18n";
import type { SettingsResponse } from "@/app/home/types";
import {
  resolveRuntimeResourceSettings,
  RUNTIME_RESOURCE_SETTING_KEYS,
} from "@/lib/runtime-resource-settings";

interface RuntimeSettingsPanelProps {
  settings: Record<string, string>;
  setSetting: (key: string, value: string) => void;
  resourceSnapshot?: SettingsResponse["resourceSnapshot"];
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

function setResourceSetting(
  setSetting: (key: string, value: string) => void,
  key: string,
  value: number | boolean,
) {
  setSetting(key, String(value));
}

function formatMb(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  if (value >= 1024) {
    const gb = value / 1024;
    return `${gb >= 10 ? Math.round(gb) : gb.toFixed(1)} GB`;
  }
  return `${Math.round(value)} MB`;
}

function formatPercent(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? null : `${Math.round(value)}%`;
}

function percentOfTotal(value: number, total: number | null | undefined) {
  return total && Number.isFinite(total) && total > 0
    ? Math.round((value / total) * 100)
    : null;
}

export function RuntimeSettingsPanel({ settings, setSetting, resourceSnapshot }: RuntimeSettingsPanelProps) {
  useI18nSnapshot();
  const recoveryPolicy = parseRecoveryPolicy(settings.RECOVERY_POLICY);
  const busyMessageAction = settings.BUSY_MESSAGE_ACTION === "steer" ? "steer" : "queue";
  const resourceSettings = resolveRuntimeResourceSettings(settings);
  const idleCleanupMinutes = Math.max(1, Math.round(resourceSettings.idleCleanupAfterMs / 60_000));
  const totalMemoryMb = resourceSnapshot?.totalMemoryMb ?? null;
  const memoryFreePercent = resourceSnapshot?.memoryFreePercent ?? null;
  const currentFreeMemoryMb = totalMemoryMb && memoryFreePercent != null
    ? Math.round((totalMemoryMb * memoryFreePercent) / 100)
    : null;
  const configuredFreeMemoryMb = totalMemoryMb
    ? Math.round((totalMemoryMb * resourceSettings.minMemoryFreePercent) / 100)
    : null;
  const diskFreePercent = percentOfTotal(resourceSnapshot?.diskFreeMb ?? 0, resourceSnapshot?.diskTotalMb);
  const diskLimitPercent = percentOfTotal(resourceSettings.minDiskFreeMb, resourceSnapshot?.diskTotalMb);
  const workerMemoryPercent = percentOfTotal(resourceSettings.estimatedWorkerMemoryMb, totalMemoryMb);
  const memoryContext = currentFreeMemoryMb != null && totalMemoryMb
    ? t("settings.runtime.memoryContext", {
        currentPercent: formatPercent(memoryFreePercent) ?? "-",
        currentFree: formatMb(currentFreeMemoryMb) ?? "-",
        total: formatMb(totalMemoryMb) ?? "-",
        limitFree: formatMb(configuredFreeMemoryMb) ?? "-",
        limitPercent: formatPercent(resourceSettings.minMemoryFreePercent) ?? "-",
      })
    : t("settings.runtime.resourceSnapshotUnavailable");
  const diskContext = resourceSnapshot?.diskFreeMb != null && resourceSnapshot.diskTotalMb != null
    ? t("settings.runtime.diskContext", {
        currentPercent: formatPercent(diskFreePercent) ?? "-",
        currentFree: formatMb(resourceSnapshot.diskFreeMb) ?? "-",
        total: formatMb(resourceSnapshot.diskTotalMb) ?? "-",
        limitFree: formatMb(resourceSettings.minDiskFreeMb) ?? "-",
        limitPercent: formatPercent(diskLimitPercent) ?? "-",
      })
    : t("settings.runtime.resourceSnapshotUnavailable");
  const workerMemoryContext = totalMemoryMb
    ? t("settings.runtime.workerMemoryContext", {
        reservation: formatMb(resourceSettings.estimatedWorkerMemoryMb) ?? "-",
        percent: formatPercent(workerMemoryPercent) ?? "-",
      })
    : t("settings.runtime.resourceSnapshotUnavailable");

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-muted-foreground">{t("settings.runtime.defaultSendBehaviour")}</div>
        <div className="flex items-center gap-4" role="radiogroup" aria-label={t("settings.runtime.defaultSendBehaviour")}>
          {([
            ["steer", t("settings.runtime.steer")],
            ["queue", t("settings.runtime.queue")],
          ] as const).map(([value, label]) => (
            <label
              key={value}
              className="flex items-center gap-1.5 text-xs font-medium text-foreground"
            >
              <input
                type="radio"
                name="BUSY_MESSAGE_ACTION"
                value={value}
                checked={busyMessageAction === value}
                onChange={() => setSetting("BUSY_MESSAGE_ACTION", value)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-3 border-t border-border/60 pt-4">
        <div className="text-xs font-semibold text-muted-foreground">{t("settings.runtime.resources")}</div>

        <div className="space-y-3">
          <label className="grid grid-cols-[minmax(0,1fr)_8rem] items-start gap-2 text-xs">
            <span className="space-y-1">
              <span className="block font-medium text-muted-foreground">{t("settings.runtime.minMemoryFreePercent")}</span>
              <span className="block leading-5 text-muted-foreground/80">{memoryContext}</span>
            </span>
            <input
              type="number"
              min={0}
              max={80}
              className="h-8 w-full rounded border bg-muted/50 px-2 text-right text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
              value={resourceSettings.minMemoryFreePercent}
              onChange={(event) => setResourceSetting(
                setSetting,
                RUNTIME_RESOURCE_SETTING_KEYS.minMemoryFreePercent,
                Number(event.target.value) || 0,
              )}
            />
          </label>
          <label className="grid grid-cols-[minmax(0,1fr)_8rem] items-start gap-2 text-xs">
            <span className="space-y-1">
              <span className="block font-medium text-muted-foreground">{t("settings.runtime.minDiskFreeMb")}</span>
              <span className="block leading-5 text-muted-foreground/80">{diskContext}</span>
            </span>
            <input
              type="number"
              min={0}
              step={512}
              className="h-8 w-full rounded border bg-muted/50 px-2 text-right text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
              value={resourceSettings.minDiskFreeMb}
              onChange={(event) => setResourceSetting(
                setSetting,
                RUNTIME_RESOURCE_SETTING_KEYS.minDiskFreeMb,
                Number(event.target.value) || 0,
              )}
            />
          </label>
          <label className="grid grid-cols-[minmax(0,1fr)_8rem] items-start gap-2 text-xs">
            <span className="space-y-1">
              <span className="block font-medium text-muted-foreground">{t("settings.runtime.estimatedWorkerMemoryMb")}</span>
              <span className="block leading-5 text-muted-foreground/80">{workerMemoryContext}</span>
            </span>
            <input
              type="number"
              min={0}
              step={256}
              className="h-8 w-full rounded border bg-muted/50 px-2 text-right text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
              value={resourceSettings.estimatedWorkerMemoryMb}
              onChange={(event) => setResourceSetting(
                setSetting,
                RUNTIME_RESOURCE_SETTING_KEYS.estimatedWorkerMemoryMb,
                Number(event.target.value) || 0,
              )}
            />
          </label>
        </div>

        <p className="text-xs leading-5 text-muted-foreground">{t("settings.runtime.resourceGuardHelp")}</p>

        <label className="flex items-center gap-3 text-xs">
          <Switch
            aria-label={t("settings.runtime.idleCleanup")}
            checked={resourceSettings.idleCleanupEnabled}
            onCheckedChange={(checked) => setResourceSetting(
              setSetting,
              RUNTIME_RESOURCE_SETTING_KEYS.idleCleanupEnabled,
              checked,
            )}
          />
          <span>{t("settings.runtime.idleCleanup")}</span>
        </label>

        <label className="block max-w-48 space-y-1 text-xs">
          <span className="font-medium text-muted-foreground">{t("settings.runtime.idleCleanupAfterMinutes")}</span>
          <input
            type="number"
            min={1}
            step={1}
            className="h-8 w-full rounded border bg-muted/50 px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
            value={idleCleanupMinutes}
            disabled={!resourceSettings.idleCleanupEnabled}
            onChange={(event) => setResourceSetting(
              setSetting,
              RUNTIME_RESOURCE_SETTING_KEYS.idleCleanupAfterMs,
              Math.max(1, Number(event.target.value) || 1) * 60_000,
            )}
          />
        </label>

        <p className="text-xs leading-5 text-muted-foreground">{t("settings.runtime.idleCleanupHelp")}</p>
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
