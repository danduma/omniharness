import fs from "fs";
import path from "path";
import { test, expect } from "vitest";
import {
  getTerminalActivityVersion,
  shouldTerminalConnectorExtend,
  shouldTerminalFollowLatest,
  shouldTerminalKeepFollowingLatest,
  resolveTerminalPrependedScrollTop,
  shouldTerminalRequestMoreHistoryFromWheel,
  shouldTerminalResetInitialPosition,
} from "@/components/Terminal";

const terminalSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/Terminal.tsx"),
  "utf8"
);
const terminalScrollSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/terminal/scroll-state.ts"),
  "utf8"
);
const terminalPreferenceSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/interface/home/AppearancePreferencesManager.ts"),
  "utf8"
);
const globalCssSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/interface/styles/globals.css"),
  "utf8"
);
const homeAppSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/interface/home/HomeApp.tsx"),
  "utf8"
);

test("terminal can render in native conversation mode without window chrome", () => {
  expect(terminalSource).toContain('variant = "terminal"');
  expect(terminalSource).toContain('variant?: "terminal" | "native"');
  expect(terminalSource).toContain('variant === "native"');
  expect(terminalSource).toContain('bg-transparent text-foreground');
  expect(terminalSource).toContain("text-[length:var(--terminal-pane-size)]");
  expect(terminalSource).not.toContain("text-[var(--terminal-pane-size)]");
});

test("terminal uses localized loading copy for empty structured output", () => {
  expect(terminalSource).toContain('t("terminal.empty.loadingSession")');
  expect(terminalSource).not.toContain("Waiting for structured agent output");
});

test("terminal renders a structured activity feed instead of replaying xterm text", () => {
  expect(terminalSource).toContain("buildAgentOutputActivity");
  expect(terminalSource).toContain('activity.kind === "thinking"');
  expect(terminalSource).toContain('activity.kind === "tool"');
  expect(terminalSource).not.toContain('activity.kind === "history_gap"');
  expect(terminalSource).not.toContain("Live payload summary");
  expect(terminalSource).not.toContain("@xterm/xterm");
});

test("terminal intercepts project file links from agent output", () => {
  expect(terminalSource).toContain("parseProjectFileReference");
  expect(terminalSource).toContain("projectRoot?: string | null");
  expect(terminalSource).toContain("onOpenProjectFile?: (file: ProjectFileReference) => void");
  expect(terminalSource).toContain("handleProjectFileReferenceClick");
  expect(terminalSource).toContain("ProjectFileReferenceText");
  expect(terminalSource).toContain("onOpenProjectFile(reference)");
  expect(terminalSource).toContain("projectRoot={projectRoot}");
  expect(terminalSource).toContain("onOpenProjectFile={onOpenProjectFile}");
});

test("terminal renders thoughts behind a collapsible thinking summary", () => {
  expect(terminalSource).toContain("ThoughtActivity");
  expect(terminalSource).toContain("Thinking");
  expect(terminalSource).toContain("Thought for");
  expect(terminalSource).toContain('return duration ? `Thought for ${duration}` : "Thought";');
  expect(terminalSource).not.toContain('return "<1s";');
  expect(terminalSource).toContain("animate-pulse");
  expect(terminalSource).toContain("const open = (thoughtOpenById[activity.id] ?? thoughtsDefaultOpen) || activity.inProgress;");
});

test("terminal renders model thoughts as markdown while preserving thought tone", () => {
  expect(terminalSource).toContain("<MarkdownContent");
  expect(terminalSource).toContain("content={thought}");
  expect(terminalSource).toContain("inheritTextColor");
  expect(terminalSource).toContain("text-[length:var(--terminal-thought-size)] leading-[1.5]");
  expect(terminalSource).toContain('variant === "native"\n                    ? "text-muted-foreground');
  expect(terminalSource).toContain(': "text-muted-foreground');
  expect(terminalSource).toContain('dark:text-zinc-500');
  expect(terminalSource).not.toContain("leading-[1.5] italic");
});

test("terminal keeps tool output compact and expandable", () => {
  expect(terminalSource).toContain("const TOOL_OUTPUT_PREVIEW_LINES = 3");
  expect(terminalSource).toContain("isTerminalToolStatus(activity.status)");
  expect(terminalSource).toContain("toolDetailsOpenById[activity.id] ?? !isDone");
  expect(terminalSource).toContain('const outputIsDiff = activity.outputPane?.kind === "diff";');
  expect(terminalSource).toContain("toolOutputExpandedById[activity.id] ?? outputIsDiff");
  expect(terminalSource).toContain("terminalUiManager.setToolOutputExpanded(activity.id, true)");
  expect(terminalSource).not.toContain("isDone ? false : toolDetailsOpenById[activity.id]");
  expect(terminalSource).not.toContain("isDone ? false : toolOutputExpandedById[activity.id]");
  expect(terminalSource).toContain("shouldShowToolStatusBadge(activity.status)");
  expect(terminalSource).toContain("shouldShowToolSpinner(activity.status)");
  expect(terminalSource).toContain('return !["completed", "done", "in_progress", "working"].includes(status);');
  expect(terminalSource).toContain('return ["in_progress", "working"].includes(status);');
  expect(terminalSource).toContain("<LoaderCircle");
  expect(terminalSource).toContain('"h-3 w-3 shrink-0 animate-spin"');
  expect(terminalSource).toContain("terminalUiManager.setToolDetailsOpen(activity.id, nextDetailsOpen)");
  expect(terminalSource).toContain("line-clamp-[3]");
  expect(terminalSource).toContain("Click to expand full output");
  expect(terminalSource).toContain("ChevronDown");
  expect(terminalSource).toContain('variant === "native"\n          ? "rounded border border-border/60 bg-muted/25"\n          : "rounded border border-border/70 bg-background shadow-sm dark:border-white/10 dark:bg-[#111318]');
  expect(terminalSource).not.toContain('rounded-[0.85rem] border border-white/10 bg-[#111318]');
  expect(terminalSource).not.toContain('rounded-lg border border-border/60 bg-muted/25');
  expect(terminalSource).toContain('{shouldShowToolSpinner(activity.status) ? (');
  expect(terminalSource).toContain('{formatActivityStatus(activity.status)}\n          </span>\n        ) : null}\n        <ChevronDown');
  expect(terminalSource).toContain('{activity.inProgress ? <ThinkingDots variant={variant} /> : null}\n        <ChevronDown');
  expect(terminalSource).toContain("TERMINAL_REVEAL_CLASS");
});

test("terminal renders edit diffs with dedicated red and green lines", () => {
  const diffPaneSource = terminalSource.slice(
    terminalSource.indexOf("function DiffPane"),
    terminalSource.indexOf("function ThinkingDots"),
  );

  expect(terminalSource).toContain("function DiffPane");
  expect(terminalSource).toContain("function parseDiffPane");
  expect(terminalSource).toContain("function diffRowClass");
  expect(terminalSource).toContain('activity.outputPane?.kind === "diff"');
  expect(terminalSource).toContain("Copy");
  expect(terminalSource).toContain('t("terminal.diff.copyAria")');
  expect(terminalSource).toContain('t("terminal.diff.unknownFile")');
  expect(diffPaneSource).toContain("flex min-h-8 items-center gap-1.5 border-b px-2.5 py-1");
  expect(diffPaneSource).toContain("inline-flex h-6 w-6");
  expect(terminalSource).toContain("bg-emerald-500/13 text-emerald-900");
  expect(terminalSource).toContain("bg-red-500/13 text-red-900");
  expect(diffPaneSource).toContain("grid grid-cols-[4px_5.5rem_minmax(0,1fr)]");
  expect(diffPaneSource).toContain("tabular-nums");
  expect(diffPaneSource).toContain("whitespace-pre px-4");
  expect(terminalSource).not.toContain("<DiffPane\n                  label=");
  expect(diffPaneSource).not.toContain("label,");
  expect(diffPaneSource).not.toContain("label: string;");
  expect(terminalSource).toContain("parseHunkStart");
  expect(terminalSource).toContain("line.startsWith(\"+\")");
  expect(terminalSource).toContain("line.startsWith(\"-\")");
  expect(terminalSource).toContain("visible: line.slice(1)");
  expect(terminalSource).toContain("lineNumber: newLine");
  expect(terminalSource).toContain("lineNumber: oldLine");
});

test("terminal uses a measured v0-style expansion animation for tool call details", () => {
  expect(terminalSource).toContain("const TOOL_OUTPUT_COLLAPSED_MAX_HEIGHT = \"calc(var(--terminal-pane-size) * 4.65 + 1rem)\"");
  expect(terminalSource).toContain("grid transition-[grid-template-rows,opacity,transform]");
  expect(terminalSource).toContain("grid-rows-[1fr] opacity-100 translate-y-0");
  expect(terminalSource).toContain("grid-rows-[0fr] opacity-0 -translate-y-1 pointer-events-none");
  expect(terminalSource).toContain("ease-[cubic-bezier(0.16,1,0.3,1)]");
  expect(terminalSource).toContain('aria-hidden={!detailsOpen}');
  expect(terminalSource).toContain('maxHeight: clipped ? TOOL_OUTPUT_COLLAPSED_MAX_HEIGHT : TOOL_OUTPUT_EXPANDED_MAX_HEIGHT');
  expect(terminalSource).toContain("transition-[max-height,background-color,border-color,box-shadow]");
  expect(terminalSource).toContain("motion-reduce:transition-none");
});

test("terminal removes hidden animated tool panes from keyboard interaction", () => {
  expect(terminalSource).toContain("interactive = true");
  expect(terminalSource).toContain("const canInteract = canExpand && interactive");
  expect(terminalSource).toContain('tabIndex={canInteract ? 0 : undefined}');
  expect(terminalSource).toContain("interactive={detailsOpen}");
});

test("terminal uses the same measured expansion animation for thoughts", () => {
  expect(terminalSource).toContain("const TERMINAL_REVEAL_CLASS = \"grid transition-[grid-template-rows,opacity,transform]");
  expect(terminalSource).toContain("const TERMINAL_REVEAL_OPEN_CLASS = \"grid-rows-[1fr] opacity-100 translate-y-0\"");
  expect(terminalSource).toContain("const TERMINAL_REVEAL_CLOSED_CLASS = \"grid-rows-[0fr] opacity-0 -translate-y-1 pointer-events-none\"");
  expect(terminalSource).toContain("open ? TERMINAL_REVEAL_OPEN_CLASS : TERMINAL_REVEAL_CLOSED_CLASS");
  expect(terminalSource).toContain('aria-hidden={!open}');
  expect(terminalSource).toContain("min-h-0 overflow-hidden");
  expect(terminalSource).not.toContain("space-y-1 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1");
});

test("terminal displays a thought snippet and duration on the same line as the Thought label", () => {
  expect(terminalSource).toContain('activity.thoughts.length > 0 && (');
  expect(terminalSource).toContain('truncate text-[length:var(--terminal-thought-size)] font-normal text-muted-foreground/60');
  expect(terminalSource).toContain('activity.thoughts.join(" ").replace(/\\s+/g, " ").trim()');
  expect(terminalSource).toContain('{formatThoughtLabel(activity)}');
});

test("terminal exposes a text size icon menu with tiny through huge", () => {
  expect(terminalSource).toContain("TERMINAL_TEXT_SIZE_LEVELS");
  expect(terminalPreferenceSource).toContain('value: "tiny"');
  expect(terminalPreferenceSource).toContain('value: "huge"');
  expect(terminalPreferenceSource).toContain('labelKey: "settings.textSize.huge"');
  expect(terminalSource).toContain('aria-label={t("settings.appearance.terminalFontSize")}');
  expect(terminalSource).toContain("<ALargeSmall");
  expect(terminalSource).toContain("<DropdownMenuGroup>");
  expect(terminalSource).toContain('<DropdownMenuLabel>{t("settings.appearance.terminalFontSize")}</DropdownMenuLabel>');
  expect(terminalSource).toContain("</DropdownMenuGroup>");
  expect(terminalSource).toContain("appearancePreferencesManager.setTerminalTextSize(level.value)");
  expect(terminalSource).toContain("--terminal-message-size");
  expect(terminalSource).toContain("text-[length:var(--terminal-message-size)]");
  expect(terminalSource).not.toContain("text-[var(--terminal-message-size)]");
});

test("terminal can use conversation text sizing separately from terminal output sizing", () => {
  expect(terminalSource).toContain('textSizeScope?: "terminal" | "conversation"');
  expect(terminalSource).toContain('textSizeScope = "terminal"');
  expect(terminalSource).toContain('textSizeScope === "conversation"');
  expect(terminalSource).toContain('textSizeScope === "conversation" && "omni-conversation-text-scale"');
  expect(terminalSource).toContain("getConversationTerminalTextSizeStyle(conversationTextSize)");
  expect(terminalSource).toContain("getTerminalTextSizeStyle(terminalTextSize)");
  expect(globalCssSource).toContain(".omni-app-text-scale .omni-conversation-text-scale .text-\\[12px\\]");
  expect(globalCssSource).toContain(".omni-app-text-scale .omni-conversation-text-scale .text-\\[13px\\]");
  expect(globalCssSource).toContain(".omni-app-text-scale .omni-conversation-text-scale .text-base");
});

test("UI text size scales control tap targets through the Tailwind spacing scale", () => {
  expect(terminalPreferenceSource).toContain('"--spacing": `calc(0.25rem * ${textSize.uiScale})`');
  expect(terminalPreferenceSource).toContain('"--omni-ui-scale": textSize.uiScale');
  expect(homeAppSource).toContain('body.classList.add("omni-app-text-scale")');
  expect(homeAppSource).toContain("body.style.setProperty(property, String(value))");
});

test("composer input text follows the conversation text size", () => {
  expect(globalCssSource).toContain("font-size: var(--omni-composer-font-size, 15px)");
  expect(globalCssSource).toContain("line-height: var(--omni-composer-line-height, 20px)");
  expect(terminalPreferenceSource).toContain('"--omni-composer-font-size"');
});

test("terminal aligns timeline markers with row text and connects the rail", () => {
  expect(terminalSource).toContain("items-start gap-3");
  expect(terminalSource).toContain("mt-[0.43rem]");
  expect(terminalSource).toContain("absolute left-2 top-0 h-[0.68rem] w-px");
  expect(terminalSource).toContain("absolute -bottom-2 left-2 top-[0.68rem] w-px");
  expect(terminalSource).toContain("shouldTerminalConnectorExtend(entry.kind, previousEntry?.kind)");
  expect(terminalSource).toContain("shouldTerminalConnectorExtend(entry.kind, nextEntry?.kind)");
  expect(terminalSource).not.toContain('previousEntry?.kind !== "user_message"');
  expect(terminalSource).not.toContain('nextEntry?.kind !== "user_message"');
  expect(terminalSource).not.toContain("space-y-3");
});

test("terminal rail connectors only extend toward an existing rail item", () => {
  expect(shouldTerminalConnectorExtend("message", "tool")).toBe(true);
  expect(shouldTerminalConnectorExtend("tool", "thinking")).toBe(true);
  expect(shouldTerminalConnectorExtend("message", undefined)).toBe(false);
  expect(shouldTerminalConnectorExtend("message", "user_message")).toBe(false);
  expect(shouldTerminalConnectorExtend("user_message", "tool")).toBe(false);
});

test("terminal user messages render as right-aligned transcript blocks outside the rail", () => {
  expect(terminalSource).toContain('if (activity.kind === "user_message")');
  expect(terminalSource).toContain('relative z-10 flex w-full flex-col items-end');
  expect(terminalSource).toContain('mt-1 flex items-center justify-end gap-1 pr-1');
  expect(terminalSource).toContain('max-w-[min(72ch,calc(100%-1rem))] rounded-[1.55rem]');
  expect(terminalSource).toContain('dark:bg-[#3a3a3a]');
  expect(terminalSource).toContain('dark:text-[#d8d8d8]');
  expect(terminalSource).not.toContain('>You</div>');
});

test("terminal surfaces fetch failures in the frontend instead of silently dropping them", () => {
  expect(terminalSource).not.toContain('action: `Load terminal output for ${agentName}`');
  expect(terminalSource).not.toContain("useQuery({");
  expect(terminalSource).not.toContain("refetchInterval: 2000");
  expect(terminalSource).not.toContain("normalizeAppError(error).message");
});

test("native conversation scrolling requests older history from the actual viewport", () => {
  expect(terminalSource).toContain('variant === "native"\n        && hasMoreHistory\n        && shouldTerminalRequestMoreHistory(scrollContainer)');
  expect(terminalSource).toContain('scrollContainer.addEventListener("scroll", handleScroll, { passive: true });');
});

test("an upward wheel gesture at the top requests older history even when scrollTop cannot change", () => {
  expect(shouldTerminalRequestMoreHistoryFromWheel({ scrollTop: 0 }, -24)).toBe(true);
  expect(shouldTerminalRequestMoreHistoryFromWheel({ scrollTop: 12 }, -24)).toBe(false);
  expect(shouldTerminalRequestMoreHistoryFromWheel({ scrollTop: 0 }, 24)).toBe(false);
  expect(terminalSource).toContain('scrollContainer.addEventListener("wheel", handleWheel, { passive: true });');
});

test("terminal only follows live output while the viewport is already near the bottom", () => {
  expect(terminalScrollSource).toContain("const TERMINAL_BOTTOM_THRESHOLD_PX = 1");
  expect(terminalSource).not.toContain("shouldForceFollowPendingAssistant");
  expect(terminalSource).toContain("const activityChanged = previousActivityVersionRef.current !== activityVersion;");
  expect(terminalSource).toContain("const isFirstRenderedActivity = filteredActivity.length > 0 && !hasPositionedFirstActivityRef.current;");
  expect(terminalSource).toContain("shouldTerminalResetInitialPosition");
  expect(terminalSource).toContain('const scrollBehavior: ScrollBehavior = isFirstRenderedActivity ? "auto" : "smooth";');
  expect(terminalSource).toContain('scrollTerminalToBottom(container, "auto")');

  expect(shouldTerminalFollowLatest({
    scrollTop: 700,
    clientHeight: 300,
    scrollHeight: 1000,
  })).toBe(true);

  expect(shouldTerminalFollowLatest({
    scrollTop: 690,
    clientHeight: 300,
    scrollHeight: 1000,
  })).toBe(false);

  expect(shouldTerminalFollowLatest({
    scrollTop: 650,
    clientHeight: 300,
    scrollHeight: 1000,
  })).toBe(false);

  expect(shouldTerminalKeepFollowingLatest({
    scrollTop: 699.5,
    clientHeight: 300,
    scrollHeight: 1000,
  }, 700)).toBe(false);

  expect(shouldTerminalResetInitialPosition({
    previousFirstActivityId: "entry-20",
    nextFirstActivityId: "entry-1",
    scrollAnchorChanged: false,
  })).toBe(false);

  expect(shouldTerminalResetInitialPosition({
    previousFirstActivityId: null,
    nextFirstActivityId: "entry-20",
    scrollAnchorChanged: false,
  })).toBe(true);

  expect(shouldTerminalResetInitialPosition({
    previousFirstActivityId: "entry-20",
    nextFirstActivityId: "entry-20",
    scrollAnchorChanged: true,
  })).toBe(true);
});

test("terminal activity version ignores pending assistant timestamp churn", () => {
  expect(getTerminalActivityVersion([
    { id: "pending-assistant", kind: "pending_assistant", status: "thinking", timestamp: "2026-05-09T00:00:00.000Z" },
  ])).toBe(getTerminalActivityVersion([
    { id: "pending-assistant", kind: "pending_assistant", status: "thinking", timestamp: "2026-05-09T00:00:01.000Z" },
  ]));

  expect(getTerminalActivityVersion([
    { id: "message-1", kind: "message", text: "hello", timestamp: "2026-05-09T00:00:00.000Z" },
  ])).not.toBe(getTerminalActivityVersion([
    { id: "message-1", kind: "message", text: "hello again", timestamp: "2026-05-09T00:00:00.000Z" },
  ]));
});

test("prepended history pays for its own height so the top boundary stops re-triggering", () => {
  // Reading at the top boundary, then a 900px page of older rows arrives above
  // the viewport. Without the shift the reader stays at scrollTop 0 — still on
  // the trigger — and the next page loads immediately, and the next, until the
  // whole transcript is in memory.
  expect(resolveTerminalPrependedScrollTop({
    previousFirstActivityId: "entry-20",
    nextFirstActivityId: "entry-1",
    isPreviousFirstActivityStillRendered: true,
    previousScrollHeight: 1000,
    nextScrollHeight: 1900,
    scrollTop: 0,
  })).toBe(900);

  // Mid-transcript reading position is preserved the same way.
  expect(resolveTerminalPrependedScrollTop({
    previousFirstActivityId: "entry-20",
    nextFirstActivityId: "entry-1",
    isPreviousFirstActivityStillRendered: true,
    previousScrollHeight: 1000,
    nextScrollHeight: 1900,
    scrollTop: 120,
  })).toBe(1020);

  // A different first row whose predecessor is gone is a replaced transcript —
  // switching conversations, or a rewind dropping rows — not a prepend.
  expect(resolveTerminalPrependedScrollTop({
    previousFirstActivityId: "entry-20",
    nextFirstActivityId: "entry-90",
    isPreviousFirstActivityStillRendered: false,
    previousScrollHeight: 1000,
    nextScrollHeight: 1900,
    scrollTop: 0,
  })).toBeNull();

  // First render has nothing to anchor to.
  expect(resolveTerminalPrependedScrollTop({
    previousFirstActivityId: null,
    nextFirstActivityId: "entry-20",
    isPreviousFirstActivityStillRendered: false,
    previousScrollHeight: 0,
    nextScrollHeight: 1900,
    scrollTop: 0,
  })).toBeNull();

  // Same first row: appended output at the bottom must not move the reader.
  expect(resolveTerminalPrependedScrollTop({
    previousFirstActivityId: "entry-20",
    nextFirstActivityId: "entry-20",
    isPreviousFirstActivityStillRendered: true,
    previousScrollHeight: 1000,
    nextScrollHeight: 1900,
    scrollTop: 0,
  })).toBeNull();

  // Content that shrank cannot have been prepended.
  expect(resolveTerminalPrependedScrollTop({
    previousFirstActivityId: "entry-20",
    nextFirstActivityId: "entry-1",
    isPreviousFirstActivityStillRendered: true,
    previousScrollHeight: 1900,
    nextScrollHeight: 1000,
    scrollTop: 400,
  })).toBeNull();

  // The correction has to land before paint, ahead of the follow-latest pass.
  expect(terminalSource).toContain("resolveTerminalPrependedScrollTop({");
  expect(terminalSource).toContain("container.scrollTop = anchoredScrollTop;");
  expect(terminalSource).toContain("previousScrollHeightRef.current = container?.scrollHeight ?? 0;");
});
