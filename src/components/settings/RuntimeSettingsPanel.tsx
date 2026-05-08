interface RuntimeSettingsPanelProps {
  settings: Record<string, string>;
  setSetting: (key: string, value: string) => void;
}

export function RuntimeSettingsPanel({ settings, setSetting }: RuntimeSettingsPanelProps) {
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
    </div>
  );
}
