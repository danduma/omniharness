import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { LLM_PROVIDER_OPTIONS } from "@/app/home/constants";
import type { LlmFieldPrefix } from "@/app/home/types";
import { requestJson } from "@/lib/app-errors";

interface ModelProfileFormProps {
  prefix: LlmFieldPrefix;
  title: string;
  description: string;
  settings: Record<string, string>;
  setSetting: (key: string, value: string) => void;
  secretStates?: Record<string, { configured: boolean; updatedAt: string }>;
}

export function ModelProfileForm({
  prefix,
  title,
  description,
  settings,
  setSetting,
  secretStates,
}: ModelProfileFormProps) {
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
        source: "LLM Settings",
        action: "Fetch available models",
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
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor={providerKey}>
            Provider
          </label>
          <select
            id={providerKey}
            className="h-8 w-full rounded border bg-muted/50 px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
            value={provider}
            onChange={(event) => setSetting(providerKey, event.target.value)}
          >
            {LLM_PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor={modelKey}>
            Model
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
                aria-label="Model"
                placeholder={
                  !apiKey.trim()
                    ? "Enter API key first"
                    : geminiModelsQuery.isPending
                      ? "Loading models..."
                      : "Search Gemini models"
                }
                className="w-full"
              />
              <ComboboxContent className="w-[var(--anchor-width)]">
                <ComboboxEmpty>
                  {!apiKey.trim()
                    ? "Enter API key first"
                    : geminiModelsQuery.isPending
                      ? "Loading models..."
                      : "No Gemini models available"}
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
              {geminiModelsQuery.error instanceof Error ? geminiModelsQuery.error.message : "Unable to fetch available models."}
            </p>
          ) : null}
          {provider === "gemini" ? (
            <p className="text-[11px] text-muted-foreground">
              Gemini model ids load automatically from the API key and appear in a searchable dropdown.
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor={baseUrlKey}>
            Endpoint
          </label>
          <Input
            id={baseUrlKey}
            value={settings[baseUrlKey] || ""}
            onChange={(event) => setSetting(baseUrlKey, event.target.value)}
            placeholder="Optional custom base URL"
            className="h-8 bg-muted/50 text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor={apiKeyKey}>
            API Key
          </label>
          <Input
            id={apiKeyKey}
            type="password"
            value={settings[apiKeyKey] || ""}
            onChange={(event) => setSetting(apiKeyKey, event.target.value)}
            placeholder={apiKeyConfigured ? "Saved credential" : "Provider credential"}
            className="h-8 bg-muted/50 text-xs"
          />
          {apiKeyConfigured && !settings[apiKeyKey]?.trim() ? (
            <p className="text-[11px] text-muted-foreground">
              Credential saved. Enter a new value to replace it.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
