import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import { projectMemoryPanelManager } from "@/app/home/ProjectMemoryPanelManager";
import { t, useI18nSnapshot } from "@/lib/i18n";

interface ProjectMemorySettingsPanelProps {
  projectPath: string | null;
  globalMemoryEnabled: boolean;
}

function formatBytes(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }
  return `${(size / 1024).toFixed(1)} KB`;
}

export function ProjectMemorySettingsPanel({ projectPath, globalMemoryEnabled }: ProjectMemorySettingsPanelProps) {
  useI18nSnapshot();
  const state = useManagerSnapshot(projectMemoryPanelManager);

  useEffect(() => {
    projectMemoryPanelManager.setProjectPath(projectPath);
    void projectMemoryPanelManager.reloadList();
  }, [projectPath]);

  useEffect(() => {
    if (state.projectPath && state.selectedPath) {
      void projectMemoryPanelManager.loadFile();
    }
  }, [state.projectPath, state.selectedPath]);

  const dirty = state.content !== state.originalContent;
  const effectiveEnabled = globalMemoryEnabled && state.enabled;

  if (!projectPath) {
    return (
      <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
        <div className="text-sm font-medium">{t("settings.memory.title")}</div>
        <p className="text-xs text-muted-foreground">{t("settings.memory.noProject")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
      <div className="space-y-1">
        <div className="text-sm font-medium">{t("settings.memory.title")}</div>
        <p className="text-xs text-muted-foreground">{t("settings.memory.description")}</p>
        <p className="text-[11px] text-muted-foreground/80">
          {t("settings.memory.projectPathLabel")}: <span className="font-mono">{projectPath}</span>
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/70 p-3">
        <Switch
          id="PROJECT_MEMORY_ENABLED"
          aria-label={t("settings.memory.toggleEnabled")}
          checked={effectiveEnabled}
          disabled={!globalMemoryEnabled}
          onCheckedChange={(checked) => void projectMemoryPanelManager.toggleEnabled(checked)}
        />
        <div className="min-w-0 space-y-1">
          <div className="text-sm font-medium">{t("settings.memory.enabledForProject")}</div>
          <p className="text-xs text-muted-foreground">
            {!globalMemoryEnabled
              ? t("settings.memory.disabledGlobally")
              : state.enabled
                ? t("settings.memory.enabledHelp")
                : t("settings.memory.disabledForProject")}
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[200px_minmax(0,1fr)]">
        <div className="rounded-lg border border-border/60 bg-background/70 p-2">
          {state.files.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">{t("settings.memory.empty")}</p>
          ) : (
            <ul className="space-y-1">
              {state.files.map((file) => (
                <li key={file.path}>
                  <button
                    type="button"
                    onClick={() => void projectMemoryPanelManager.selectPath(file.path)}
                    className={cn(
                      "w-full rounded px-2 py-1.5 text-left text-xs transition-colors",
                      state.selectedPath === file.path
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <div className="truncate font-mono">{file.path}</div>
                    <div className="text-[10px] text-muted-foreground/70">{formatBytes(file.size)}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex min-h-[280px] flex-col gap-2">
          {state.selectedPath ? (
            <>
              <textarea
                className="flex-1 w-full resize-none rounded-lg border border-border/60 bg-background/70 p-3 font-mono text-xs"
                value={state.content}
                onChange={(event) => projectMemoryPanelManager.setContent(event.target.value)}
                spellCheck={false}
                disabled={state.loading || state.saving}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {state.saveStatus === "saved"
                    ? t("settings.memory.saved")
                    : dirty
                      ? t("settings.memory.unsaved")
                      : ""}
                </span>
                <Button
                  size="sm"
                  onClick={() => void projectMemoryPanelManager.save()}
                  disabled={!dirty || state.saving}
                >
                  {state.saving ? t("settings.memory.saving") : t("settings.memory.save")}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
              {state.loading ? t("settings.memory.loading") : t("settings.memory.selectFile")}
            </div>
          )}
        </div>
      </div>

      {state.error ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}
    </div>
  );
}
