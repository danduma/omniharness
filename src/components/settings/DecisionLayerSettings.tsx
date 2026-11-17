import React from "react";
import { CircleCheck, CircleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { parseBooleanSetting } from "@/interface/home/utils";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  DECISION_POINT_IDS,
  DECISION_SETTING_KEYS,
  DECISION_TEXT_TASK_IDS,
  DEFAULT_DECISION_MODEL,
  parseDecisionPoints,
  parseDecisionTextTasks,
  type DecisionTextTaskId,
  type DecisionLayerStatus,
  type DecisionPointId,
} from "@/shared/decision-layer";

interface DecisionLayerSettingsProps {
  settings: Record<string, string>;
  setSetting: (key: string, value: string) => void;
  status?: DecisionLayerStatus;
}

/**
 * Decision layer controls. The AI Gateway key is deliberately not editable
 * here: it lives only in the runner environment (AI_GATEWAY_API_KEY), so this
 * section only reports whether the server has one.
 */
export function DecisionLayerSettings({ settings, setSetting, status }: DecisionLayerSettingsProps) {
  useI18nSnapshot();
  const enabled = parseBooleanSetting(settings[DECISION_SETTING_KEYS.enabled], false);
  const enabledPoints = parseDecisionPoints(settings[DECISION_SETTING_KEYS.points]);
  const actingPoints = parseDecisionPoints(settings[DECISION_SETTING_KEYS.actingPoints]);
  const setPoint = (point: DecisionPointId, on: boolean) => {
    const next = DECISION_POINT_IDS.filter((id) => (id === point ? on : enabledPoints.includes(id)));
    setSetting(DECISION_SETTING_KEYS.points, JSON.stringify(next));
    if (!on && actingPoints.includes(point)) {
      // Turning a point off also withdraws its permission to act.
      setSetting(DECISION_SETTING_KEYS.actingPoints, JSON.stringify(actingPoints.filter((id) => id !== point)));
    }
  };
  const setActing = (point: DecisionPointId, on: boolean) => {
    const next = DECISION_POINT_IDS.filter((id) => (id === point ? on : actingPoints.includes(id)));
    setSetting(DECISION_SETTING_KEYS.actingPoints, JSON.stringify(next));
  };
  const textTasks = parseDecisionTextTasks(settings[DECISION_SETTING_KEYS.textTasks]);
  const setTextTask = (task: DecisionTextTaskId, on: boolean) => {
    const next = DECISION_TEXT_TASK_IDS.filter((id) => (id === task ? on : textTasks.includes(id)));
    setSetting(DECISION_SETTING_KEYS.textTasks, JSON.stringify(next));
  };
  const textModel = settings[DECISION_SETTING_KEYS.textModel]?.trim() ?? "";
  const zeroDataRetention = parseBooleanSetting(settings[DECISION_SETTING_KEYS.zeroDataRetention], false);
  const keyConfigured = Boolean(status?.gatewayKeyConfigured);
  const StatusIcon = keyConfigured ? CircleCheck : CircleAlert;

  const toggle = (key: string, id: string, label: string, help: string, checked: boolean, disabled = false) => (
    <div className="flex items-start gap-3">
      <Switch
        id={id}
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => setSetting(key, next ? "true" : "false")}
      />
      <div className="min-w-0 space-y-0.5">
        <label htmlFor={id} className="text-sm font-medium">{label}</label>
        <p className="text-xs text-muted-foreground">{help}</p>
      </div>
    </div>
  );

  return (
    <section className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4" aria-labelledby="decision-layer-title">
      <div className="space-y-1">
        <h3 id="decision-layer-title" className="text-sm font-semibold">{t("settings.decisionLayer.title")}</h3>
        <p className="text-xs text-muted-foreground">{t("settings.decisionLayer.description")}</p>
      </div>

      <div
        role="status"
        className={cn(
          "flex items-start gap-2 rounded-lg border p-2.5 text-xs",
          keyConfigured ? "border-border/60 bg-background/60" : "border-amber-500/40 bg-amber-500/5",
        )}
      >
        <StatusIcon aria-hidden="true" className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", keyConfigured ? "text-muted-foreground" : "text-amber-600")} />
        <span>{keyConfigured ? t("settings.decisionLayer.keyFromEnv") : t("settings.decisionLayer.keyMissing")}</span>
      </div>

      {toggle(
        DECISION_SETTING_KEYS.enabled,
        "decision-layer-enabled",
        t("settings.decisionLayer.enabled"),
        t("settings.decisionLayer.enabledHelp"),
        enabled,
      )}
      <p className="rounded-lg border border-border/50 bg-background/50 p-2.5 text-xs text-muted-foreground">
        {t("settings.decisionLayer.shadowByDefault")}
      </p>
      {toggle(
        DECISION_SETTING_KEYS.zeroDataRetention,
        "decision-layer-zdr",
        t("settings.decisionLayer.zeroDataRetention"),
        t("settings.decisionLayer.zeroDataRetentionHelp"),
        zeroDataRetention,
        !enabled,
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="decision-layer-model">
            {t("settings.decisionLayer.model")}
          </label>
          <Input
            id="decision-layer-model"
            value={settings[DECISION_SETTING_KEYS.model] ?? ""}
            placeholder={DEFAULT_DECISION_MODEL}
            onChange={(event) => setSetting(DECISION_SETTING_KEYS.model, event.target.value)}
            className="h-8 bg-background text-xs"
            disabled={!enabled}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="decision-layer-escalation-model">
            {t("settings.decisionLayer.escalationModel")}
          </label>
          <Input
            id="decision-layer-escalation-model"
            value={settings[DECISION_SETTING_KEYS.escalationModel] ?? ""}
            placeholder={t("settings.decisionLayer.escalationModelPlaceholder")}
            onChange={(event) => setSetting(DECISION_SETTING_KEYS.escalationModel, event.target.value)}
            className="h-8 bg-background text-xs"
            disabled={!enabled}
          />
        </div>
      </div>
      <fieldset className="space-y-2" disabled={!enabled}>
        <legend className="text-xs font-semibold text-muted-foreground">{t("settings.decisionLayer.points")}</legend>
        {DECISION_POINT_IDS.map((point) => (
          <div key={point} className="flex items-start gap-3">
            <Switch
              id={`decision-point-${point}`}
              aria-label={t(`settings.decisionLayer.point.${point}`)}
              checked={enabledPoints.includes(point)}
              disabled={!enabled}
              onCheckedChange={(next) => setPoint(point, next)}
            />
            <div className="min-w-0 flex-1 space-y-1">
              <label htmlFor={`decision-point-${point}`} className="text-sm font-medium">{t(`settings.decisionLayer.point.${point}`)}</label>
              <p className="text-xs text-muted-foreground">{t(`settings.decisionLayer.point.${point}Help`)}</p>
              <div className="flex items-start gap-2 pt-1">
                <Switch
                  id={`decision-acting-${point}`}
                  aria-label={t("settings.decisionLayer.actingLabel", { point: t(`settings.decisionLayer.point.${point}`) })}
                  checked={actingPoints.includes(point)}
                  disabled={!enabled || !enabledPoints.includes(point)}
                  onCheckedChange={(next) => setActing(point, next)}
                />
                <div className="min-w-0 space-y-0.5">
                  <label htmlFor={`decision-acting-${point}`} className="text-xs font-medium">{t("settings.decisionLayer.acting")}</label>
                  <p className="text-xs text-muted-foreground">{t(`settings.decisionLayer.point.${point}Acting`)}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </fieldset>

      <fieldset className="space-y-2" disabled={!enabled}>
        <legend className="text-xs font-semibold text-muted-foreground">{t("settings.decisionLayer.textLane")}</legend>
        <p className="text-xs text-muted-foreground">{t("settings.decisionLayer.textLaneHelp")}</p>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="decision-layer-text-model">
            {t("settings.decisionLayer.textModel")}
          </label>
          <Input
            id="decision-layer-text-model"
            value={settings[DECISION_SETTING_KEYS.textModel] ?? ""}
            placeholder={t("settings.decisionLayer.textModelPlaceholder")}
            onChange={(event) => setSetting(DECISION_SETTING_KEYS.textModel, event.target.value)}
            className="h-8 bg-background text-xs"
            disabled={!enabled}
          />
        </div>
        {DECISION_TEXT_TASK_IDS.map((task) => (
          <div key={task} className="flex items-start gap-3">
            <Switch
              id={`decision-text-task-${task}`}
              aria-label={t(`settings.decisionLayer.textTask.${task}`)}
              checked={textTasks.includes(task)}
              disabled={!enabled || !textModel}
              onCheckedChange={(next) => setTextTask(task, next)}
            />
            <div className="min-w-0 space-y-0.5">
              <label htmlFor={`decision-text-task-${task}`} className="text-sm font-medium">{t(`settings.decisionLayer.textTask.${task}`)}</label>
              <p className="text-xs text-muted-foreground">{t(`settings.decisionLayer.textTask.${task}Help`)}</p>
            </div>
          </div>
        ))}
      </fieldset>
    </section>
  );
}
