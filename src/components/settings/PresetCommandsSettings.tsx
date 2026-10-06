import { Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WorkerLaunchControls } from "@/components/composer/WorkerLaunchControls";
import { formatAccountOptionLabel } from "@/interface/home/account-labels";
import { EFFORT_OPTIONS, WORKER_OPTIONS } from "@/interface/home/constants";
import type { AccountRecord, WorkerModelCatalog, WorkerType } from "@/interface/home/types";
import { getWorkerModelOptions } from "@/interface/home/utils";
import { decodeClaudeGatewayModel } from "@/lib/claude-model-gateway";
import { t, useI18nSnapshot } from "@/lib/i18n";
import {
  PRESET_COMMANDS_SETTING,
  addPresetCommand,
  duplicatePresetCommand,
  normalizePresetEffort,
  readPresetCommands,
  removePresetCommand,
  serializePresetCommands,
  updatePresetCommand,
  type PresetCommand,
} from "@/lib/preset-commands";

interface PresetCommandsSettingsProps {
  settings: Record<string, string>;
  setSetting: (key: string, value: string) => void;
  workerModels?: Partial<WorkerModelCatalog>;
  accounts: AccountRecord[];
  themeMode: "day" | "night";
}

const AUTO_ACCOUNT = "auto";

const PRESET_EFFORT_OPTIONS = EFFORT_OPTIONS.map((label) => ({
  value: normalizePresetEffort(label) ?? label,
  label,
}));

function isGatewayPreset(preset: PresetCommand) {
  return preset.workerType === "claude" && decodeClaudeGatewayModel(preset.model) !== null;
}

function accountOptionsFor(preset: PresetCommand, accounts: AccountRecord[]) {
  if (isGatewayPreset(preset)) {
    return [{ value: AUTO_ACCOUNT, label: t("conversation.composer.account.gatewayProvider") }];
  }
  const options = [
    { value: AUTO_ACCOUNT, label: t("conversation.composer.account.auto") },
    ...accounts
      .filter((account) => account.enabled && (!account.cliType || account.cliType === preset.workerType))
      .map((account) => ({ value: account.id, label: formatAccountOptionLabel(account) })),
  ];
  if (preset.accountId && !options.some((option) => option.value === preset.accountId)) {
    options.push({ value: preset.accountId, label: t("settings.presetCommands.accountUnavailable") });
  }
  return options;
}

export function PresetCommandsSettings({ settings, setSetting, workerModels, accounts, themeMode }: PresetCommandsSettingsProps) {
  useI18nSnapshot();
  const presets = readPresetCommands(settings);
  const save = (next: PresetCommand[]) => setSetting(PRESET_COMMANDS_SETTING, serializePresetCommands(next));
  const update = (id: string, patch: Partial<Omit<PresetCommand, "id">>) => save(updatePresetCommand(presets, id, patch));

  const handleWorkerTypeChange = (preset: PresetCommand, workerType: WorkerType) => {
    const model = getWorkerModelOptions(workerModels, workerType)[0]?.value ?? preset.model;
    // Accounts belong to one CLI, so a CLI change falls back to Auto.
    update(preset.id, { workerType, model, accountId: null });
  };

  const handleModelChange = (preset: PresetCommand, model: string) => {
    const next = { ...preset, model };
    update(preset.id, { model, ...(isGatewayPreset(next) ? { accountId: null } : {}) });
  };

  return (
    <div className="space-y-3" data-preset-commands-settings="true">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="text-sm font-semibold">{t("settings.presetCommands.title")}</div>
          <p className="text-xs leading-5 text-muted-foreground">{t("settings.presetCommands.description")}</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => save(addPresetCommand(presets))}>
          <Plus className="h-4 w-4" />
          <span>{t("settings.presetCommands.add")}</span>
        </Button>
      </div>

      {presets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">
          {t("settings.presetCommands.empty")}
        </p>
      ) : null}

      {presets.map((preset) => {
        const displayName = preset.name.trim() || t("settings.presetCommands.untitled");
        const modelOptions = getWorkerModelOptions(workerModels, preset.workerType);
        return (
          <div
            key={preset.id}
            data-preset-command={preset.id}
            className="space-y-2 rounded-lg border border-border/70 bg-background/60 p-3"
          >
            <div className="flex items-center gap-2">
              <Input
                value={preset.name}
                aria-label={t("settings.presetCommands.name")}
                placeholder={t("settings.presetCommands.namePlaceholder")}
                aria-invalid={!preset.name.trim()}
                onChange={(event) => update(preset.id, { name: event.target.value })}
                className="h-8 min-w-0 flex-1 text-sm font-medium"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={t("settings.presetCommands.duplicate", { name: displayName })}
                title={t("settings.presetCommands.duplicate", { name: displayName })}
                onClick={() => save(duplicatePresetCommand(presets, preset.id))}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label={t("settings.presetCommands.remove", { name: displayName })}
                title={t("settings.presetCommands.remove", { name: displayName })}
                onClick={() => save(removePresetCommand(presets, preset.id))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Textarea
              value={preset.prompt}
              aria-label={t("settings.presetCommands.prompt")}
              placeholder={t("settings.presetCommands.promptPlaceholder")}
              aria-invalid={!preset.prompt.trim()}
              onChange={(event) => update(preset.id, { prompt: event.target.value })}
              rows={3}
              className="min-h-[4.5rem] text-sm [overflow-wrap:anywhere]"
            />
            <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1 sm:gap-x-2">
              <WorkerLaunchControls
                themeMode={themeMode}
                worker={{
                  value: preset.workerType,
                  options: WORKER_OPTIONS,
                  onChange: (value) => handleWorkerTypeChange(preset, value as WorkerType),
                }}
                account={{
                  value: isGatewayPreset(preset) ? AUTO_ACCOUNT : preset.accountId ?? AUTO_ACCOUNT,
                  options: accountOptionsFor(preset, accounts),
                  onChange: (value) => update(preset.id, { accountId: value === AUTO_ACCOUNT ? null : value }),
                }}
                model={{ value: preset.model, options: modelOptions, onChange: (value) => handleModelChange(preset, value) }}
                effort={{ value: preset.effort, options: PRESET_EFFORT_OPTIONS, onChange: (value) => update(preset.id, { effort: normalizePresetEffort(value) ?? preset.effort }) }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
