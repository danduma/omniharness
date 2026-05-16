import { useEffect, useMemo } from "react";
import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  COLLAPSIBLE_PANEL_CLOSED_CLASS,
  COLLAPSIBLE_PANEL_OPEN_CLASS,
  COLLAPSIBLE_PANEL_TRANSITION_CLASS,
} from "@/components/ui/collapsible";
import {
  LLM_DEFAULT_MODEL,
  LLM_PROVIDER_MODEL_CATALOG,
  LLM_PROVIDER_OPTIONS,
  LLM_THINKING_EFFORT_OPTIONS,
  type LlmProviderId,
} from "@/app/home/constants";
import type { LlmFieldPrefix } from "@/app/home/types";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { StateManager } from "@/lib/state-manager";
import { shallowEqualRecord, useManagerSelector } from "@/lib/use-manager-snapshot";
import { cn } from "@/lib/utils";

interface ModelProfileFormProps {
  prefix: LlmFieldPrefix;
  title: string;
  settings: Record<string, string>;
  setSetting: (key: string, value: string) => void;
  secretStates?: Record<string, { configured: boolean; updatedAt: string; preview?: string }>;
}

const PROVIDER_VALUES = new Set<string>(LLM_PROVIDER_OPTIONS.map((option) => option.value));

type ModelProfileUiState = Record<string, {
  apiKeyEditing: boolean;
  advancedOpen: boolean;
}>;

class ModelProfileUiManager extends StateManager<ModelProfileUiState> {
  constructor() {
    super({});
  }

  private getProfile(prefix: LlmFieldPrefix) {
    return this.getSnapshot()[prefix] ?? { apiKeyEditing: false, advancedOpen: false };
  }

  setApiKeyEditing(prefix: LlmFieldPrefix, apiKeyEditing: boolean) {
    this.update((current) => ({
      ...current,
      [prefix]: { ...this.getProfile(prefix), apiKeyEditing },
    }));
  }

  setAdvancedOpen(prefix: LlmFieldPrefix, advancedOpen: boolean) {
    this.update((current) => ({
      ...current,
      [prefix]: { ...this.getProfile(prefix), advancedOpen },
    }));
  }
}

const modelProfileUiManager = new ModelProfileUiManager();

function isProvider(value: string): value is LlmProviderId {
  return PROVIDER_VALUES.has(value);
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
  const thinkingEffortKey = `${prefix}_THINKING_EFFORT`;
  const temperatureKey = `${prefix}_TEMPERATURE`;
  const maxOutputTokensKey = `${prefix}_MAX_OUTPUT_TOKENS`;

  const defaultProvider: LlmProviderId = prefix === "SUPERVISOR_LLM" ? "gemini" : "openai";
  const rawProvider = settings[providerKey] || defaultProvider;
  const provider: LlmProviderId = isProvider(rawProvider) ? rawProvider : defaultProvider;
  const currentModel = settings[modelKey] || "";
  const apiKeySecret = secretStates?.[apiKeyKey];
  const apiKeyConfigured = apiKeySecret?.configured ?? false;
  const apiKeyPreview = apiKeySecret?.preview ?? "";
  const apiKeyDraftValue = settings[apiKeyKey] || "";
  const { apiKeyEditing, advancedOpen } = useManagerSelector(
    modelProfileUiManager,
    (state) => state[prefix] ?? { apiKeyEditing: false, advancedOpen: false },
    shallowEqualRecord,
  );
  const showEditMode = apiKeyEditing || !apiKeyConfigured || apiKeyDraftValue.length > 0;
  useEffect(() => {
    if (!apiKeyConfigured) modelProfileUiManager.setApiKeyEditing(prefix, false);
  }, [apiKeyConfigured, prefix]);

  const catalog = LLM_PROVIDER_MODEL_CATALOG[provider] ?? [];
  const modelOptions: SelectOption[] = useMemo(() => {
    const options = catalog.map((model) => ({ value: model.value, label: model.label }));
    if (currentModel && !options.some((option) => option.value === currentModel)) {
      options.push({ value: currentModel, label: currentModel });
    }
    return options;
  }, [catalog, currentModel]);

  useEffect(() => {
    if (currentModel) return;
    const fallback = LLM_DEFAULT_MODEL[provider] || catalog[0]?.value || "";
    if (fallback) {
      setSetting(modelKey, fallback);
    }
  }, [catalog, currentModel, modelKey, provider, setSetting]);

  const handleProviderChange = (value: string) => {
    if (value === provider) return;
    setSetting(providerKey, value);
    if (isProvider(value)) {
      const nextDefault = LLM_DEFAULT_MODEL[value] || LLM_PROVIDER_MODEL_CATALOG[value]?.[0]?.value || "";
      setSetting(modelKey, nextDefault);
    }
  };

  const thinkingEffortOptions: SelectOption[] = LLM_THINKING_EFFORT_OPTIONS.map((option) => ({
    value: option.value,
    label: t(`settings.models.thinkingEffort.${option.value}`),
  }));
  const isCustomEndpoint = provider === "openai-compatible";

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
      <div className="space-y-1">
        <div className="text-sm font-semibold">{title}</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field htmlFor={providerKey} label={t("settings.models.provider")}>
          <Select
            id={providerKey}
            value={provider}
            options={LLM_PROVIDER_OPTIONS as readonly SelectOption[]}
            onValueChange={handleProviderChange}
          />
        </Field>
        <Field htmlFor={modelKey} label={t("settings.models.model")}>
          {modelOptions.length > 0 ? (
            <Select
              id={modelKey}
              value={currentModel}
              options={modelOptions}
              onValueChange={(value) => setSetting(modelKey, value)}
              placeholder={t("settings.models.selectModel")}
            />
          ) : (
            <Input
              id={modelKey}
              value={currentModel}
              onChange={(event) => setSetting(modelKey, event.target.value)}
              placeholder={t("settings.models.customModelPlaceholder")}
              className="h-8 bg-background text-xs"
            />
          )}
        </Field>
        <Field htmlFor={baseUrlKey} label={t("settings.models.endpoint")}>
          <Input
            id={baseUrlKey}
            value={settings[baseUrlKey] || ""}
            onChange={(event) => setSetting(baseUrlKey, event.target.value)}
            placeholder={isCustomEndpoint ? t("settings.models.requiredBaseUrl") : t("settings.models.optionalBaseUrl")}
            className="h-8 bg-background text-xs"
          />
        </Field>
        <Field htmlFor={apiKeyKey} label={t("settings.models.apiKey")}>
          {showEditMode ? (
            <div className="flex items-center gap-1.5">
              <Input
                id={apiKeyKey}
                type="password"
                value={apiKeyDraftValue}
                onChange={(event) => setSetting(apiKeyKey, event.target.value)}
                onBlur={() => {
                  if (apiKeyConfigured && apiKeyDraftValue.length === 0) {
                    modelProfileUiManager.setApiKeyEditing(prefix, false);
                  }
                }}
                spellCheck={false}
                autoComplete="off"
                placeholder={apiKeyConfigured
                  ? t("settings.models.credentialReplaceHint")
                  : t("settings.models.providerCredential")}
                className="h-8 flex-1 bg-background text-xs"
              />
              {apiKeyConfigured ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-[11px]"
                  onClick={() => {
                    setSetting(apiKeyKey, "");
                    modelProfileUiManager.setApiKeyEditing(prefix, false);
                  }}
                >
                  {t("common.cancel")}
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Input
                id={apiKeyKey}
                type="text"
                value={apiKeyPreview}
                readOnly
                aria-readonly
                spellCheck={false}
                autoComplete="off"
                className="h-8 flex-1 bg-background/60 font-mono text-xs text-muted-foreground"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2 text-[11px]"
                onClick={() => {
                  modelProfileUiManager.setApiKeyEditing(prefix, true);
                  requestAnimationFrame(() => {
                    const el = document.getElementById(apiKeyKey) as HTMLInputElement | null;
                    el?.focus();
                  });
                }}
              >
                {t("settings.models.replaceCredential")}
              </Button>
            </div>
          )}
        </Field>
      </div>

      <Collapsible open={advancedOpen} onOpenChange={(open) => modelProfileUiManager.setAdvancedOpen(prefix, open)} className="border-t border-border/60 pt-3">
        <CollapsibleTrigger
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-md text-left text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground",
          )}
        >
          <span>{t("settings.models.advanced")}</span>
          <ChevronDownIcon
            className={cn("size-3.5 transition-transform", advancedOpen ? "rotate-180" : "rotate-0")}
            aria-hidden="true"
          />
        </CollapsibleTrigger>
        <CollapsibleContent
          className={cn(
            COLLAPSIBLE_PANEL_TRANSITION_CLASS,
            advancedOpen ? COLLAPSIBLE_PANEL_OPEN_CLASS : COLLAPSIBLE_PANEL_CLOSED_CLASS,
          )}
        >
          <div className="min-h-0 pt-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field htmlFor={thinkingEffortKey} label={t("settings.models.thinkingEffort.label")}>
                <Select
                  id={thinkingEffortKey}
                  value={settings[thinkingEffortKey] || "medium"}
                  options={thinkingEffortOptions}
                  onValueChange={(value) => setSetting(thinkingEffortKey, value)}
                />
              </Field>
              <Field htmlFor={temperatureKey} label={t("settings.models.temperature")}>
                <Input
                  id={temperatureKey}
                  value={settings[temperatureKey] || ""}
                  onChange={(event) => setSetting(temperatureKey, event.target.value)}
                  placeholder={t("settings.models.temperaturePlaceholder")}
                  inputMode="decimal"
                  className="h-8 bg-background text-xs"
                />
              </Field>
              <Field htmlFor={maxOutputTokensKey} label={t("settings.models.maxOutputTokens")}>
                <Input
                  id={maxOutputTokensKey}
                  value={settings[maxOutputTokensKey] || ""}
                  onChange={(event) => setSetting(maxOutputTokensKey, event.target.value)}
                  placeholder={t("settings.models.maxOutputTokensPlaceholder")}
                  inputMode="numeric"
                  className="h-8 bg-background text-xs"
                />
              </Field>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function Field({
  htmlFor,
  label,
  children,
}: {
  htmlFor: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}
