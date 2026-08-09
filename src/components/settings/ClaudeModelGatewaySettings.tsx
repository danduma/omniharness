"use client";

import React, { useEffect } from "react";
import { ChevronDown, ExternalLink, RefreshCw } from "lucide-react";
import { claudeModelGatewayManager } from "@/interface/home/ClaudeModelGatewayManager";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useRuntimeAPIs } from "@/runtime-api/provider";

type Props = {
  settings: Record<string, string>;
  setSetting: (key: string, value: string) => void;
  dirtyKeys?: Set<string>;
  secretStates?: Record<string, { configured: boolean }>;
};

function customModelLines(value: string | undefined) {
  if (!value?.trim()) return "gpt-5.6-sol";
  try {
    const parsed = JSON.parse(value) as Array<{ id?: unknown }>;
    return parsed.flatMap((model) => typeof model?.id === "string" ? [model.id] : []).join("\n");
  } catch {
    return value;
  }
}

export function ClaudeModelGatewaySettings({ settings, setSetting, dirtyKeys, secretStates }: Props) {
  useI18nSnapshot();
  const runtimeApis = useRuntimeAPIs();
  claudeModelGatewayManager.configure(runtimeApis.settings.claudeGateway);
  const state = useManagerSnapshot(claudeModelGatewayManager);
  useEffect(() => { void claudeModelGatewayManager.refresh(); }, [runtimeApis.settings.claudeGateway]);
  const status = state.status;
  const mode = settings.CLAUDE_MODEL_GATEWAY_MODE === "external" ? "external" : "managed";
  const serverMode = status?.mode ?? mode;
  const gatewaySettingsDirty = [...(dirtyKeys ?? [])].some((key) => key.startsWith("CLAUDE_MODEL_GATEWAY_"));
  const pending = state.pendingAction !== null;
  const actionsDisabled = pending || status === null || gatewaySettingsDirty;
  const statusKey = status
    ? `settings.claudeGateway.status.${status.service}`
    : "settings.claudeGateway.status.loading";

  const setCustomModels = (value: string) => {
    const models = value.split(/\r?\n|,/).map((id) => id.trim()).filter(Boolean).map((id) => ({ id }));
    setSetting("CLAUDE_MODEL_GATEWAY_MODELS", JSON.stringify(models));
  };

  const connect = async () => {
    await claudeModelGatewayManager.runAction("connect");
    const url = claudeModelGatewayManager.getSnapshot().oauthUrl;
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Collapsible defaultOpen={false}>
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/70 p-4 text-left">
        <h3 id="claude-model-gateway-title" className="text-sm font-semibold">{t("settings.claudeGateway.title")}</h3>
        <span className="flex items-center gap-2">
          <Badge variant="outline" aria-live="polite">{t(statusKey)}</Badge>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[panel-open]:rotate-180" aria-hidden="true" />
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <section className="space-y-4 rounded-b-xl border-x border-b border-border/60 bg-background/70 p-4" aria-labelledby="claude-model-gateway-title">
          <p className="max-w-xl text-xs text-muted-foreground">{t("settings.claudeGateway.description")}</p>

          <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-xs font-medium">
          <span>{t("settings.claudeGateway.mode")}</span>
          <Select
            value={mode}
            options={[
              { value: "managed", label: t("settings.claudeGateway.modeManaged") },
              { value: "external", label: t("settings.claudeGateway.modeExternal") },
            ]}
            onValueChange={(value) => setSetting("CLAUDE_MODEL_GATEWAY_MODE", value)}
          />
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          <span>{t("settings.claudeGateway.baseUrl")}</span>
          <Input
            value={settings.CLAUDE_MODEL_GATEWAY_BASE_URL ?? "http://127.0.0.1:8317"}
            onChange={(event) => setSetting("CLAUDE_MODEL_GATEWAY_BASE_URL", event.target.value)}
            placeholder={t("settings.claudeGateway.baseUrlPlaceholder")}
          />
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          <span>{t("settings.claudeGateway.apiToken")}</span>
          <Input
            type="password"
            value={settings.CLAUDE_MODEL_GATEWAY_API_TOKEN ?? ""}
            onChange={(event) => setSetting("CLAUDE_MODEL_GATEWAY_API_TOKEN", event.target.value)}
            placeholder={secretStates?.CLAUDE_MODEL_GATEWAY_API_TOKEN?.configured ? t("settings.claudeGateway.secretConfigured") : t("settings.claudeGateway.secretPlaceholder")}
          />
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          <span>{t("settings.claudeGateway.managementToken")}</span>
          <Input
            type="password"
            value={settings.CLAUDE_MODEL_GATEWAY_MANAGEMENT_TOKEN ?? ""}
            onChange={(event) => setSetting("CLAUDE_MODEL_GATEWAY_MANAGEMENT_TOKEN", event.target.value)}
            placeholder={secretStates?.CLAUDE_MODEL_GATEWAY_MANAGEMENT_TOKEN?.configured ? t("settings.claudeGateway.secretConfigured") : t("settings.claudeGateway.secretPlaceholder")}
          />
        </label>
          </div>

          <label className="block space-y-1.5 text-xs font-medium">
        <span>{t("settings.claudeGateway.customModels")}</span>
        <Textarea
          rows={3}
          value={customModelLines(settings.CLAUDE_MODEL_GATEWAY_MODELS)}
          onChange={(event) => setCustomModels(event.target.value)}
          placeholder={t("settings.claudeGateway.customModelsPlaceholder")}
        />
        <span className="block text-[11px] font-normal text-muted-foreground">{t("settings.claudeGateway.customModelsHelp")}</span>
          </label>

          <div className="flex flex-wrap gap-2">
        {serverMode === "managed" && status?.installation !== "installed" ? (
          <Button type="button" disabled={actionsDisabled} onClick={() => void claudeModelGatewayManager.installAndStart()}>
            {t("settings.claudeGateway.installAndStart")}
          </Button>
        ) : null}
        {(serverMode === "external" || status?.installation === "installed") && status?.service !== "running" ? (
          <Button type="button" disabled={actionsDisabled} onClick={() => void claudeModelGatewayManager.runAction("start")}>
            {serverMode === "external" ? t("settings.claudeGateway.checkConnection") : t("settings.claudeGateway.start")}
          </Button>
        ) : null}
        {status?.service === "running" && status.oauth !== "connected" ? (
          <Button type="button" disabled={actionsDisabled} onClick={() => void connect()}>{t("settings.claudeGateway.connect")}</Button>
        ) : null}
        {status?.service === "running" ? (
          <Button type="button" variant="outline" disabled={actionsDisabled} onClick={() => void claudeModelGatewayManager.runAction("refresh_models")}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {t("settings.claudeGateway.refreshModels")}
          </Button>
        ) : null}
        {serverMode === "managed" && status?.service === "running" ? (
          <Button type="button" variant="outline" disabled={actionsDisabled} onClick={() => void claudeModelGatewayManager.runAction("stop")}>
            {t("settings.claudeGateway.stop")}
          </Button>
        ) : null}
          </div>

          {gatewaySettingsDirty ? (
            <p className="text-xs text-muted-foreground">{t("settings.claudeGateway.saveBeforeActions")}</p>
          ) : null}

          {state.oauthUrl ? (
        <a className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline" href={state.oauthUrl} target="_blank" rel="noopener noreferrer">
          {t("settings.claudeGateway.openSignIn")}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
          ) : null}
          {state.error ? <p className="text-xs text-destructive" role="alert">{state.error}</p> : null}
          {status?.operation?.error?.message && status.operation.error.message !== state.error ? (
            <p className="text-xs text-destructive" role="alert">{status.operation.error.message}</p>
          ) : null}
          {status?.models.discovered.length ? (
            <p className="text-xs text-muted-foreground">{t("settings.claudeGateway.discoveredCount", { count: status.models.discovered.length })}</p>
          ) : null}
        </section>
      </CollapsibleContent>
    </Collapsible>
  );
}
