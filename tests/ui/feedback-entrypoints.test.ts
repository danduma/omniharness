import fs from "fs";
import path from "path";
import { expect, test } from "vitest";

const readSource = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const homeHeaderSource = readSource("src/components/home/HomeHeader.tsx");
const settingsDialogSource = readSource("src/components/settings/SettingsDialog.tsx");
const englishLocaleSource = readSource("shared/locales/en.json");

test("home header exposes feedback as a normal persistent app control", () => {
  expect(homeHeaderSource).toContain('import { requestBugDropOpen } from "@/components/BugDropBootstrap"');
  expect(homeHeaderSource).toContain("<Bug ");
  expect(homeHeaderSource).toContain("onClick={requestBugDropOpen}");
  expect(homeHeaderSource).toContain('aria-label={t("mainMenu.reportBug")}');
  expect(homeHeaderSource).toContain('title={t("mainMenu.reportBug")}');
  expect(homeHeaderSource).toContain('sm:hidden');
  expect(homeHeaderSource).toContain('hidden sm:inline-flex');
});

test("mobile header prioritizes feedback and workspace over commit and theme controls", () => {
  expect(homeHeaderSource).toContain('<ButtonGroup aria-label={t("commit.menu.label")} className="hidden sm:flex">');
  expect(homeHeaderSource).toContain('<div className="hidden sm:block">');
  expect(homeHeaderSource).toContain('<ThemeModeToggle themeMode={themeMode} setThemeMode={setThemeMode} />');
});

test("settings dialog exposes feedback without closing the settings context", () => {
  expect(settingsDialogSource).toContain('import { Bug } from "lucide-react"');
  expect(settingsDialogSource).toContain('import { requestBugDropOpen } from "@/components/BugDropBootstrap"');
  expect(settingsDialogSource).toContain('onClick={requestBugDropOpen}');
  expect(settingsDialogSource).toContain('t("settings.feedback.reportIssue")');
  expect(englishLocaleSource).toContain('"settings.feedback.reportIssue": "Report issue"');
});
