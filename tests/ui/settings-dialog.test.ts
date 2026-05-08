import fs from "fs";
import path from "path";
import { expect, test } from "vitest";

const readSource = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
const settingsSource = [
  "src/components/home/SettingsDialog.tsx",
  "src/components/LanguageSelect.tsx",
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
  "src/app/home/HomeUiStateManager.ts",
  "src/app/home/types.ts",
].map(readSource).join("\n");
const generalSettingsSource = [
  "src/components/settings/GeneralSettingsPanel.tsx",
  "src/components/settings/AppearanceSettingsPanel.tsx",
].map(readSource).join("\n");

test("settings dialog exposes General, Models, Agents, and Runtime tabs in order", () => {
  expect(settingsSource).toContain('const SETTINGS_TABS: Array<{ value: SettingsTab; label: string }> = [');
  expect(settingsSource).toContain('{ value: "general", label: "General" }');
  expect(settingsSource).toContain('{ value: "models", label: "Models" }');
  expect(settingsSource).toContain('{ value: "agents", label: "Agents" }');
  expect(settingsSource).toContain('{ value: "runtime", label: "Runtime" }');
  expect(settingsSource.indexOf('{ value: "general", label: "General" }')).toBeLessThan(settingsSource.indexOf('{ value: "models", label: "Models" }'));
  expect(settingsSource.indexOf('{ value: "models", label: "Models" }')).toBeLessThan(settingsSource.indexOf('{ value: "agents", label: "Agents" }'));
  expect(settingsSource.indexOf('{ value: "agents", label: "Agents" }')).toBeLessThan(settingsSource.indexOf('{ value: "runtime", label: "Runtime" }'));
  expect(settingsSource).toContain('export type SettingsTab = "general" | "models" | "agents" | "runtime"');
  expect(settingsSource).not.toContain('activeSettingsTab === "llm"');
  expect(settingsSource).not.toContain('activeSettingsTab === "workers"');
});

test("general settings owns language and local text-size preferences without theme controls", () => {
  expect(settingsSource).toContain("LanguageSelect");
  expect(settingsSource).toContain("inline-grid max-w-full space-y-1.5");
  expect(settingsSource).toContain("h-8 w-auto min-w-40 max-w-full");
  expect(settingsSource).toContain("Direct-control text size");
  expect(settingsSource).toContain("Terminal / agent-output text size");
  expect(settingsSource).toContain("DIRECT_TEXT_SIZE_STORAGE_KEY");
  expect(settingsSource).toContain('"omni-direct-text-size"');
  expect(settingsSource).toContain("TERMINAL_TEXT_SIZE_STORAGE_KEY");
  expect(settingsSource).toContain('"omni-terminal-text-size"');
  expect(settingsSource).toContain("Theme stays in the header");
  expect(generalSettingsSource).not.toContain("Theme Mode");
  expect(generalSettingsSource).not.toContain("setThemeMode");
});

test("models, agents, and runtime panels preserve server-backed settings", () => {
  expect(settingsSource).toContain("Supervisor LLM");
  expect(settingsSource).toContain("Fallback LLM");
  expect(settingsSource).toContain("Credit / failover strategy");
  expect(settingsSource).toContain("SUPERVISOR_LLM_PROVIDER");
  expect(settingsSource).toContain("SUPERVISOR_LLM_MODEL");
  expect(settingsSource).toContain("SUPERVISOR_LLM_BASE_URL");
  expect(settingsSource).toContain("SUPERVISOR_LLM_API_KEY");
  expect(settingsSource).toContain("SUPERVISOR_FALLBACK_LLM_PROVIDER");
  expect(settingsSource).toContain("SUPERVISOR_FALLBACK_LLM_MODEL");
  expect(settingsSource).toContain("SUPERVISOR_FALLBACK_LLM_BASE_URL");
  expect(settingsSource).toContain("SUPERVISOR_FALLBACK_LLM_API_KEY");
  expect(settingsSource).toContain("/api/llm-models");
  expect(settingsSource).toContain("Worker availability status");
  expect(settingsSource).toContain("Default Worker Agent");
  expect(settingsSource).toContain("YOLO / permission posture");
  expect(settingsSource).toContain("WORKER_ALLOWED_TYPES");
  expect(settingsSource).toContain("WORKER_DEFAULT_TYPE");
  expect(settingsSource).toContain("WORKER_YOLO_MODE");
  expect(settingsSource).toContain("Busy-message behavior");
  expect(settingsSource).toContain("BUSY_MESSAGE_ACTION");
  expect(settingsSource).toContain('<option value="queue">Queue</option>');
  expect(settingsSource).toContain('<option value="steer">Steer immediately</option>');
  expect(settingsSource).not.toContain("Queue messages until the next safe turn");
  expect(settingsSource).not.toContain("Steer immediately, queue if the worker is busy");
});

test("settings save and cancel use draft semantics for server-backed values only", () => {
  expect(settingsSource).toContain("class SettingsDraftManager");
  expect(settingsSource).toContain("dirtyKeys");
  expect(settingsSource).toContain("discardDraft()");
  expect(settingsSource).toContain("getSavePayload()");
  expect(settingsSource).toContain("settingsDraftManager.getSavePayload()");
  expect(settingsSource).toContain("settingsDraftManager.markSaved(savedSettings)");
  expect(settingsSource).toContain("Local preferences apply immediately. Save persists only workspace and runtime settings.");
  expect(settingsSource).toContain('disabled={saveSettings.isPending || !isDirty}');
});
