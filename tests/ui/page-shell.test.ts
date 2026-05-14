import fs from "fs";
import path from "path";
import { test, expect } from "vitest";

const readSource = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
const source = [
  "src/app/page.tsx",
  "src/app/layout.tsx",
  "src/app/home/HomeApp.tsx",
  "src/app/home/types.ts",
  "src/components/BugDropBootstrap.tsx",
  "src/components/home/ConversationSidebar.tsx",
  "src/components/home/ConversationMain.tsx",
  "src/components/home/HomeHeader.tsx",
  "src/components/home/OnboardingSetupDialog.tsx",
].map(readSource).join("\n");

test("page shell keeps connect-phone as a desktop-only menu action and trims route-only session chrome", () => {
  expect(source).toContain("mainMenu.connectPhone");
  expect(source).toContain("<Smartphone className=\"mr-2 h-4 w-4\" /> {t(\"mainMenu.connectPhone\")}");
  expect(source).toContain('className="hidden cursor-pointer whitespace-nowrap lg:flex" onClick={openPairDeviceDialog}');
  expect(source).toContain("<Bug className=\"mr-2 h-4 w-4\" /> {t(\"mainMenu.reportBug\")}");
  expect(source).toContain("<Settings className=\"mr-2 h-4 w-4\" /> {t(\"mainMenu.settings\")}");
  expect(source).toContain('aria-label="Root repository folder"');
  expect(source).not.toContain("Starting in {draftProjectPath}");
  expect(source).not.toContain('aria-label="Conversation route"');
});

test("bugdrop uses the sidebar menu trigger instead of a floating button", () => {
  expect(source).toContain("<BugDropBootstrap />");
  expect(source).toContain('script.dataset.button = "false"');
  expect(source).toContain('window.BugDrop?.open()');
  expect(source).toContain('window.localStorage.getItem(OMNI_THEME_MODE_STORAGE_KEY) === "night"');
  expect(source).toContain('style.id = BUGDROP_THEME_PATCH_ID');
  expect(source).toContain('document.addEventListener(BUGDROP_OPEN_EVENT, handleOpenRequest)');
  expect(source).toContain('observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })');
  expect(source).not.toContain('data-repo="danduma/omniharness"');
});

test("empty state includes CLI setup onboarding driven by worker authentication diagnostics", () => {
  expect(source).toContain("authentication?: WorkerAuthentication");
  expect(source).toContain("OnboardingSetupDialog");
  expect(source).toContain("settings.agents.onboarding.title");
  expect(source).toContain("settings.agents.onboarding.command");
  expect(source).toContain("worker.authentication?.status");
  expect(source).toContain("getWorkerSetupCommand(worker)");
});
