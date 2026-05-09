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
  const recoveryPolicy = parseRecoveryPolicy(settings.RECOVERY_POLICY);

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
      <div className="space-y-1">
        <div className="text-sm font-semibold">Runtime</div>
        <p className="text-xs text-muted-foreground">
          Control how OmniHarness handles active work.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground" htmlFor="BUSY_MESSAGE_ACTION">
          Busy-message behavior
        </label>
        <select
          id="BUSY_MESSAGE_ACTION"
          className="h-8 w-full rounded border bg-muted/50 px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
          value={settings.BUSY_MESSAGE_ACTION === "steer" ? "steer" : "queue"}
          onChange={(event) => setSetting("BUSY_MESSAGE_ACTION", event.target.value)}
        >
          <option value="queue">Queue</option>
          <option value="steer">Steer immediately</option>
        </select>
        <p className="text-[11px] text-muted-foreground">
          Controls what happens when you send text while a supervisor or worker is already running.
        </p>
      </div>

      <div className="space-y-3 border-t border-border/60 pt-4">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-muted-foreground">Recovery</div>
          <p className="text-[11px] text-muted-foreground">
            Controls automatic rescue for disconnected workers and stale running conversations.
          </p>
        </div>

        <label className="flex items-center justify-between gap-3 text-xs">
          <span>Auto-recover implementation runs</span>
          <input
            type="checkbox"
            checked={recoveryPolicy.autoRecoverImplementationRuns}
            onChange={(event) => setRecoveryPolicyValue(settings, setSetting, { autoRecoverImplementationRuns: event.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-xs">
          <span>Auto-recover direct runs</span>
          <input
            type="checkbox"
            checked={recoveryPolicy.autoRecoverDirectRuns}
            onChange={(event) => setRecoveryPolicyValue(settings, setSetting, { autoRecoverDirectRuns: event.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-xs">
          <span>Preserve queued messages</span>
          <input
            type="checkbox"
            checked={recoveryPolicy.preserveQueuedMessages}
            onChange={(event) => setRecoveryPolicyValue(settings, setSetting, { preserveQueuedMessages: event.target.checked })}
          />
        </label>

        <div className="grid gap-2 sm:grid-cols-3">
          <label className="space-y-1 text-xs">
            <span className="font-medium text-muted-foreground">Attempts</span>
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
            <span className="font-medium text-muted-foreground">Base backoff ms</span>
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
            <span className="font-medium text-muted-foreground">Max backoff ms</span>
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
