import fs from "fs";
import path from "path";
import { expect, test } from "vitest";

const readSource = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
const settingsSource = [
  "src/components/home/SettingsDialog.tsx",
  "src/components/LanguageSelect.tsx",
  "src/components/ui/select.tsx",
  "src/components/settings/SettingsDialog.tsx",
  "src/components/settings/GeneralSettingsPanel.tsx",
  "src/components/settings/AppearanceSettingsPanel.tsx",
  "src/components/settings/ModelsSettingsPanel.tsx",
  "src/components/settings/ModelProfileForm.tsx",
  "src/components/settings/AgentsSettingsPanel.tsx",
  "src/components/settings/RuntimeSettingsPanel.tsx",
  "src/app/home/SettingsDraftManager.ts",
  "src/app/home/AppearancePreferencesManager.ts",
  "src/app/home/constants.ts",
  "src/app/home/HomeApp.tsx",
  "src/app/home/useHomeMutations.ts",
  "src/app/home/HomeUiStateManager.ts",
  "src/app/home/types.ts",
].map(readSource).join("\n");
const generalSettingsSource = [
  "src/components/settings/GeneralSettingsPanel.tsx",
  "src/components/settings/AppearanceSettingsPanel.tsx",
].map(readSource).join("\n");

test("settings dialog exposes General, Models, Agents, and Runtime tabs in order", () => {
  expect(settingsSource).toContain('const SETTINGS_TABS: Array<{ value: SettingsTab; labelKey: string }> = [');
  expect(settingsSource).toContain('{ value: "general", labelKey: "settings.tabs.general" }');
  expect(settingsSource).toContain('{ value: "models", labelKey: "settings.tabs.models" }');
  expect(settingsSource).toContain('{ value: "agents", labelKey: "settings.tabs.agents" }');
  expect(settingsSource).toContain('{ value: "runtime", labelKey: "settings.tabs.runtime" }');
  expect(settingsSource).not.toContain("Configure browser preferences, model routing, worker agents, and runtime behavior for this workspace.");
  expect(settingsSource.indexOf('{ value: "general", labelKey: "settings.tabs.general" }')).toBeLessThan(settingsSource.indexOf('{ value: "models", labelKey: "settings.tabs.models" }'));
  expect(settingsSource.indexOf('{ value: "models", labelKey: "settings.tabs.models" }')).toBeLessThan(settingsSource.indexOf('{ value: "agents", labelKey: "settings.tabs.agents" }'));
  expect(settingsSource.indexOf('{ value: "agents", labelKey: "settings.tabs.agents" }')).toBeLessThan(settingsSource.indexOf('{ value: "runtime", labelKey: "settings.tabs.runtime" }'));
  expect(settingsSource).toContain('export type SettingsTab = "general" | "models" | "agents" | "runtime"');
  expect(settingsSource).not.toContain('activeSettingsTab === "llm"');
  expect(settingsSource).not.toContain('activeSettingsTab === "workers"');
});

test("general settings owns language and local text-size preferences without theme controls", () => {
  expect(settingsSource).toContain("LanguageSelect");
  expect(settingsSource).toContain("inline-grid max-w-full space-y-1.5");
  expect(settingsSource).toContain("w-auto min-w-40 max-w-full");
  expect(settingsSource).toContain('labelKey="settings.appearance.uiFontSize"');
  expect(settingsSource).toContain('descriptionKey="settings.appearance.uiFontSizeDescription"');
  expect(settingsSource).toContain('labelKey="settings.appearance.conversationFontSize"');
  expect(settingsSource).toContain('descriptionKey="settings.appearance.conversationFontSizeDescription"');
  expect(settingsSource).toContain('labelKey="settings.appearance.terminalFontSize"');
  expect(settingsSource).toContain('descriptionKey="settings.appearance.terminalFontSizeDescription"');
  expect(settingsSource).toContain("sm:grid-cols-[minmax(9rem,0.9fr)_minmax(14rem,1.35fr)]");
  expect(settingsSource).toContain("style={{ left: `${(index / (levels.length - 1)) * 100}%` }}");
  expect(settingsSource).toContain("UI_TEXT_SIZE_STORAGE_KEY");
  expect(settingsSource).toContain('"omni-ui-font-size"');
  expect(settingsSource).toContain("CONVERSATION_TEXT_SIZE_STORAGE_KEY");
  expect(settingsSource).toContain('"omni-conversation-font-size"');
  expect(settingsSource).toContain("TERMINAL_TEXT_SIZE_STORAGE_KEY");
  expect(settingsSource).toContain('"omni-terminal-text-size"');
  expect(settingsSource).toContain('type="range"');
  expect(settingsSource).not.toContain("settings.language.current");
  expect(settingsSource).not.toContain("Current language:");
  expect(settingsSource).not.toContain("Theme stays in the header");
  expect(settingsSource).not.toContain("Configure browser-local preferences.");
  expect(settingsSource).not.toContain("Personal readability preferences apply immediately in this browser.");
  expect(generalSettingsSource).not.toContain("Theme Mode");
  expect(generalSettingsSource).not.toContain("setThemeMode");
});

test("models, agents, and runtime panels preserve server-backed settings", () => {
  expect(settingsSource).toContain('t("settings.models.supervisorTitle")');
  expect(settingsSource).toContain('t("settings.models.fallbackTitle")');
  expect(settingsSource).toContain('t("settings.models.creditStrategy.label")');
  expect(settingsSource).toContain("SUPERVISOR_LLM_PROVIDER");
  expect(settingsSource).toContain("SUPERVISOR_LLM_MODEL");
  expect(settingsSource).toContain("SUPERVISOR_LLM_BASE_URL");
  expect(settingsSource).toContain("SUPERVISOR_LLM_API_KEY");
  expect(settingsSource).toContain("SUPERVISOR_FALLBACK_LLM_PROVIDER");
  expect(settingsSource).toContain("SUPERVISOR_FALLBACK_LLM_MODEL");
  expect(settingsSource).toContain("SUPERVISOR_FALLBACK_LLM_BASE_URL");
  expect(settingsSource).toContain("SUPERVISOR_FALLBACK_LLM_API_KEY");
  expect(settingsSource).toContain("LLM_PROVIDER_MODEL_CATALOG");
  expect(settingsSource).toContain("SUPERVISOR_LLM_THINKING_EFFORT");
  expect(settingsSource).toContain("settings.models.creditStrategy.explanation.");
  expect(settingsSource).toContain('t("settings.models.advanced")');
  expect(settingsSource).toContain('t("settings.agents.workerAvailability")');
  expect(settingsSource).toContain('t("settings.agents.autoPriority")');
  expect(settingsSource).toContain('t("settings.agents.autoPriorityHelp")');
  expect(settingsSource).toContain('t("settings.agents.moveWorkerUp"');
  expect(settingsSource).toContain('t("settings.agents.moveWorkerDown"');
  expect(settingsSource).toContain('t("settings.agents.monthlyTokens")');
  expect(settingsSource).toContain('t("settings.agents.defaultWorker")');
  expect(settingsSource).toContain('t("settings.agents.dangerouslySkipPermissions")');
  expect(settingsSource).toContain('t("settings.agents.toggleDangerouslySkipPermissions")');
  expect(settingsSource).toContain('className="flex items-center gap-3"');
  expect(settingsSource.indexOf('t("settings.agents.defaultWorker")')).toBeLessThan(settingsSource.indexOf('t("settings.agents.dangerouslySkipPermissions")'));
  expect(settingsSource.indexOf('t("settings.agents.dangerouslySkipPermissions")')).toBeLessThan(settingsSource.indexOf('t("settings.agents.workerAvailability")'));
  expect(settingsSource).not.toContain("Tune availability, allowed workers, default agent selection, and permission posture.");
  expect(settingsSource).not.toContain("permission posture");
  expect(settingsSource).not.toContain("Ready to spawn");
  expect(settingsSource).toContain("<Switch");
  expect(settingsSource).toContain('t("settings.agents.installedDir")');
  expect(settingsSource).not.toContain('t("settings.agents.version")');
  expect(settingsSource).toContain('t("settings.tabs.models")');
  expect(settingsSource).toContain("sm:grid-cols-[max-content_minmax(0,1fr)]");
  expect(settingsSource).toContain("whitespace-nowrap");
  expect(settingsSource).toContain("truncate");
  expect(settingsSource).toContain("workerModels={workerCatalogQuery.data?.workerModels}");
  expect(settingsSource).toContain("WORKER_ALLOWED_TYPES");
  expect(settingsSource).toContain("WORKER_DEFAULT_TYPE");
  expect(settingsSource).toContain("WORKER_YOLO_MODE");
  expect(settingsSource).toContain('t("settings.runtime.defaultSendBehaviour")');
  expect(settingsSource).toContain('role="radiogroup" aria-label={t("settings.runtime.defaultSendBehaviour")}');
  expect(settingsSource).toContain('["steer", t("settings.runtime.steer")]');
  expect(settingsSource).toContain('["queue", t("settings.runtime.queue")]');
  expect(settingsSource).toContain("BUSY_MESSAGE_ACTION");
  expect(settingsSource).toContain('type="radio"');
  expect(settingsSource).not.toContain("Busy-message behavior");
  expect(settingsSource).not.toContain("Send behaviour");
  expect(settingsSource).not.toContain("Only currently available bridge workers can be enabled for new conversations.");
  expect(settingsSource).not.toContain("Default new workers to the runtime");
  expect(settingsSource).not.toContain('type="checkbox"');
  expect(settingsSource).not.toContain("<select");
  expect(settingsSource).not.toContain("<option");
  expect(settingsSource).not.toContain("Queue messages until the next safe turn");
  expect(settingsSource).not.toContain("Steer immediately, queue if the worker is busy");
  expect(settingsSource).not.toContain("Control how OmniHarness handles active work.");
  expect(settingsSource).not.toContain("Controls automatic rescue for disconnected workers and stale running conversations.");
  expect(settingsSource).not.toContain("Configure the provider, model, endpoint, and credentials used first for supervisor turns.");
  expect(settingsSource).not.toContain("Use a second provider profile if the primary supervisor credentials are unavailable.");
});

test("settings save and cancel use draft semantics for server-backed values", () => {
  expect(settingsSource).toContain("class SettingsDraftManager");
  expect(settingsSource).toContain("dirtyKeys");
  expect(settingsSource).toContain("discardDraft()");
  expect(settingsSource).toContain("getSavePayload()");
  expect(settingsSource).toContain("settingsDraftManager.getSavePayload()");
  expect(settingsSource).toContain("settingsDraftManager.markSaved(savedSettings)");
  expect(settingsSource).not.toContain("Local preferences are saved in this browser. Save persists workspace and runtime settings.");
  expect(settingsSource).toContain('disabled={saveSettings.isPending || !isDirty}');
});

test("appearance preference edits participate in settings save and cancel controls", () => {
  expect(settingsSource).toContain("appearancePreferencesManager.saveDraft()");
  expect(settingsSource).toContain("appearancePreferencesManager.discardDraft()");
  expect(settingsSource).toContain("appearancePreferences.dirtyKeys.size > 0");
  expect(settingsSource).toContain("const isDirty = serverSettingsDirty || localPreferencesDirty");
  expect(settingsSource).toContain("const handleSave = () => {");
  expect(settingsSource).toContain("const isServerDirty = settingsDraft.dirtyKeys.size > 0");
  expect(settingsSource).toContain("appearancePreferencesManager.saveDraft()");
});
