import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LLM_PROVIDER_OPTIONS } from "@/app/home/constants";
import type { LlmFieldPrefix } from "@/app/home/types";
import { requestJson } from "@/lib/app-errors";
import { t, useI18nSnapshot } from "@/lib/i18n";

interface ModelProfileFormProps {
  prefix: LlmFieldPrefix;
  title: string;
  settings: Record<string, string>;
  setSetting: (key: string, value: string) => void;
  secretStates?: Record<string, { configured: boolean; updatedAt: string }>;
}

export function ModelProfileForm({
  prefix,
  title,
  settings,
  setSetting,
  secretStates,
}: ModelProfileFormProps) {
  useI18nSnapshot();
  const providerKey = `${prefix}_PROVIDER`;
  const modelKey = `${prefix}_MODEL`;
  const baseUrlKey = `${prefix}_BASE_URL`;
  const apiKeyKey = `${prefix}_API_KEY`;
  const defaultProvider = prefix === "SUPERVISOR_LLM" ? "gemini" : "openai";
  const provider = settings[providerKey] || defaultProvider;
  const apiKey = settings[apiKeyKey] || "";
  const currentModel = settings[modelKey] || "";
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
        source: t("settings.models.errorSource"),
        action: t("settings.models.fetchAvailableModels"),
      });
    },
  });
  const availableModels = useMemo(() => geminiModelsQuery.data?.models ?? [], [geminiModelsQuery.data?.models]);

  useEffect(() => {
    if (provider !== "gemini" || !availableModels.length || currentModel.trim()) {
      return;
    }

    setSetting(modelKey, availableModels[0].id);
  }, [availableModels, currentModel, modelKey, provider, setSetting]);

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
      <div className="space-y-1">
        <div className="text-sm font-semibold">{title}</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor={providerKey}>
            {t("settings.models.provider")}
          </label>
          <Select
            id={providerKey}
            value={provider}
            options={LLM_PROVIDER_OPTIONS}
            onValueChange={(value) => setSetting(providerKey, value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor={modelKey}>
            {t("settings.models.model")}
          </label>
          {provider === "gemini" ? (
            <Combobox
              items={availableModels}
              value={availableModels.find((model) => model.id === currentModel) ?? null}
              itemToStringValue={(model) => model.label}
              onValueChange={(model) => setSetting(modelKey, model?.id ?? "")}
              disabled={!apiKey.trim() || geminiModelsQuery.isPending}
            >
              <ComboboxInput
                id={modelKey}
                aria-label={t("settings.models.model")}
                placeholder={
                  !apiKey.trim()
                    ? t("settings.models.enterApiKeyFirst")
                    : geminiModelsQuery.isPending
                      ? t("settings.models.loadingModels")
                      : t("settings.models.searchGeminiModels")
                }
                className="w-full"
              />
              <ComboboxContent className="w-[var(--anchor-width)]">
                <ComboboxEmpty>
                  {!apiKey.trim()
                    ? t("settings.models.enterApiKeyFirst")
                    : geminiModelsQuery.isPending
                      ? t("settings.models.loadingModels")
                      : t("settings.models.noGeminiModels")}
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
              onChange={(event) => setSetting(modelKey, event.target.value)}
              placeholder={prefix === "SUPERVISOR_LLM" ? "gemini-3.1-pro-preview" : "gpt-5.4-mini"}
              className="h-8 bg-muted/50 text-xs"
            />
          )}
          {geminiModelsQuery.isError ? (
            <p className="text-[11px] text-destructive">
              {geminiModelsQuery.error instanceof Error ? geminiModelsQuery.error.message : t("settings.models.unableToFetchModels")}
            </p>
          ) : null}
          {provider === "gemini" ? (
            <p className="text-[11px] text-muted-foreground">
              {t("settings.models.geminiModelHelp")}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor={baseUrlKey}>
            {t("settings.models.endpoint")}
          </label>
          <Input
            id={baseUrlKey}
            value={settings[baseUrlKey] || ""}
            onChange={(event) => setSetting(baseUrlKey, event.target.value)}
            placeholder={t("settings.models.optionalBaseUrl")}
            className="h-8 bg-muted/50 text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor={apiKeyKey}>
            {t("settings.models.apiKey")}
          </label>
          <Input
            id={apiKeyKey}
            type="password"
            value={settings[apiKeyKey] || ""}
            onChange={(event) => setSetting(apiKeyKey, event.target.value)}
            placeholder={apiKeyConfigured ? t("settings.models.savedCredential") : t("settings.models.providerCredential")}
            className="h-8 bg-muted/50 text-xs"
          />
          {apiKeyConfigured && !settings[apiKeyKey]?.trim() ? (
            <p className="text-[11px] text-muted-foreground">
              {t("settings.models.credentialSaved")}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
