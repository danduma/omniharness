import fs from "fs";
import path from "path";
import { test, expect } from "vitest";

const read = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const homeAppSource = read("src/app/home/HomeApp.tsx");
const homeHeaderSource = read("src/components/home/HomeHeader.tsx");
const stateManagerSource = read("src/app/home/HomeUiStateManager.ts");
const constantsSource = read("src/app/home/constants.ts");
const layoutControllerSource = read("src/app/home/useHomeLayoutController.ts");
const terminalComponentSource = read("src/components/InteractiveTerminal.tsx");
const routesIndexSource = read("src/runtime/http/routes/index.ts");
const enLocaleSource = read("shared/locales/en.json");

test("terminal panel state is wired through the home UI state manager", () => {
  expect(stateManagerSource).toContain("terminalPanelOpen: boolean;");
  expect(stateManagerSource).toContain("terminalPanelWidth: number;");
  expect(stateManagerSource).toContain("isResizingTerminalPanel: boolean;");
  expect(stateManagerSource).toContain("mobileTerminalOpen: boolean;");
  expect(stateManagerSource).toContain("terminalPanelOpen: false,");
  expect(stateManagerSource).toContain("terminalPanelWidth: DEFAULT_TERMINAL_PANEL_WIDTH,");
  expect(stateManagerSource).toContain('setTerminalPanelOpen: homeUiStateManager.createSetter("terminalPanelOpen")');
  expect(stateManagerSource).toContain('setTerminalPanelWidth: homeUiStateManager.createSetter("terminalPanelWidth")');
  expect(stateManagerSource).toContain('setMobileTerminalOpen: homeUiStateManager.createSetter("mobileTerminalOpen")');
  expect(constantsSource).toContain("export const DEFAULT_TERMINAL_PANEL_WIDTH");
  expect(constantsSource).toContain("export function clampTerminalPanelWidth");
});

test("desktop renders a resizable terminal pane split from the conversation", () => {
  expect(homeAppSource).toContain("const InteractiveTerminal = dynamic(");
  expect(homeAppSource).toContain('import("@/components/InteractiveTerminal")');
  expect(homeAppSource).toContain("useTerminalPanelResize(isResizingTerminalPanel, terminalPaneRef)");
  expect(homeAppSource).toContain("style={{ width: terminalPanelOpen ? terminalPanelWidth : 0 }}");
  expect(homeAppSource).toContain("aria-hidden={!terminalPanelOpen}");
  expect(homeAppSource).toContain("inert={!terminalPanelOpen ? true : undefined}");
  expect(homeAppSource).toContain("onPointerDown={layout.handleTerminalPanelResizeStart}");
  expect(homeAppSource).toContain("<InteractiveTerminal conversationId={selectedRunId} />");
  expect(layoutControllerSource).toContain("handleTerminalPanelResizeStart");
  expect(layoutControllerSource).toContain("setIsResizingTerminalPanel(true)");
});

test("header exposes a terminal toggle and a full-screen mobile terminal sheet", () => {
  expect(homeHeaderSource).toContain("SquareTerminal");
  expect(homeHeaderSource).toContain("setTerminalPanelOpen(!terminalPanelOpen)");
  expect(homeHeaderSource).toContain('t("terminal.open")');
  // Mobile terminal takes the full viewport so the on-screen keyboard fits.
  expect(homeHeaderSource).toContain("<Sheet open={mobileTerminalOpen} onOpenChange={setMobileTerminalOpen}");
  expect(homeHeaderSource).toContain("h-[100dvh] !w-screen !max-w-none");
  expect(homeHeaderSource).toContain("<InteractiveTerminal conversationId={selectedRunId} />");
  expect(homeAppSource).toContain("terminalPanelOpen={terminalPanelOpen}");
  expect(homeAppSource).toContain("mobileTerminalOpen={mobileTerminalOpen}");
  expect(enLocaleSource).toContain('"terminal.title"');
  expect(enLocaleSource).toContain('"terminal.open"');
});

test("interactive terminal component streams over SSE and posts input back", () => {
  expect(terminalComponentSource).toContain('"use client"');
  expect(terminalComponentSource).toContain('import("@xterm/xterm")');
  expect(terminalComponentSource).toContain('import("@xterm/addon-fit")');
  expect(terminalComponentSource).toContain('fetch("/api/terminals"');
  expect(terminalComponentSource).toContain("new EventSource(`/api/terminals/${terminalId}/stream`)");
  expect(terminalComponentSource).toContain('eventSource.addEventListener("data"');
  expect(terminalComponentSource).toContain('post("/input"');
  expect(terminalComponentSource).toContain('post("/resize"');
  expect(terminalComponentSource).toContain('method: "DELETE"');
  expect(terminalComponentSource).toContain("new ResizeObserver");
});

test("terminal HTTP routes are registered", () => {
  expect(routesIndexSource).toContain('.route("POST", "/api/terminals", handleTerminalCreateRequest)');
  expect(routesIndexSource).toContain('.route("GET", "/api/terminals/:id/stream", handleTerminalStreamRequest)');
  expect(routesIndexSource).toContain('.route("POST", "/api/terminals/:id/input", handleTerminalInputRequest)');
  expect(routesIndexSource).toContain('.route("POST", "/api/terminals/:id/resize", handleTerminalResizeRequest)');
  expect(routesIndexSource).toContain('.route("DELETE", "/api/terminals/:id", handleTerminalDeleteRequest)');
});
