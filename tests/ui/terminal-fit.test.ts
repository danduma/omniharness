import fs from "fs";
import path from "path";
import { test, expect } from "vitest";
import { shouldTerminalFollowLatest } from "@/components/Terminal";

const terminalSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/Terminal.tsx"),
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

test("terminal renders a structured activity feed instead of replaying xterm text", () => {
  expect(terminalSource).toContain("buildAgentOutputActivity");
  expect(terminalSource).toContain('activity.kind === "thinking"');
  expect(terminalSource).toContain('activity.kind === "tool"');
  expect(terminalSource).not.toContain("@xterm/xterm");
});

test("terminal renders thoughts behind a collapsible thinking summary", () => {
  expect(terminalSource).toContain("ThoughtActivity");
  expect(terminalSource).toContain("Thinking");
  expect(terminalSource).toContain("Thought for");
  expect(terminalSource).toContain('return duration ? `Thought for ${duration}` : "Thought";');
  expect(terminalSource).not.toContain('return "<1s";');
  expect(terminalSource).toContain("animate-pulse");
  expect(terminalSource).toContain("thoughtOpenById[activity.id] ?? activity.inProgress");
});

test("terminal renders model thoughts as markdown while preserving thought tone", () => {
  expect(terminalSource).toContain("<MarkdownContent");
  expect(terminalSource).toContain("content={thought}");
  expect(terminalSource).toContain("inheritTextColor");
  expect(terminalSource).toContain("text-[length:var(--terminal-thought-size)] leading-[1.5]");
  expect(terminalSource).toContain('variant === "native"\n                    ? "text-muted-foreground');
  expect(terminalSource).toContain(': "text-zinc-500');
  expect(terminalSource).not.toContain("leading-[1.5] italic");
});

test("terminal keeps tool output compact and expandable", () => {
  expect(terminalSource).toContain("const TOOL_OUTPUT_PREVIEW_LINES = 3");
  expect(terminalSource).toContain("isTerminalToolStatus(activity.status)");
  expect(terminalSource).toContain("toolDetailsOpenById[activity.id] ?? !isDone");
  expect(terminalSource).toContain("toolOutputExpandedById[activity.id] ?? false");
  expect(terminalSource).not.toContain("isDone ? false : toolDetailsOpenById[activity.id]");
  expect(terminalSource).not.toContain("isDone ? false : toolOutputExpandedById[activity.id]");
  expect(terminalSource).toContain("shouldShowToolStatusBadge(activity.status)");
  expect(terminalSource).toContain("shouldShowToolSpinner(activity.status)");
  expect(terminalSource).toContain('return !["completed", "done", "in_progress", "working"].includes(status);');
  expect(terminalSource).toContain('return ["in_progress", "working"].includes(status);');
  expect(terminalSource).toContain("<LoaderCircle");
  expect(terminalSource).toContain('"h-3 w-3 shrink-0 animate-spin"');
  expect(terminalSource).toContain("terminalUiManager.setToolDetailsOpen(activity.id, !detailsOpen)");
  expect(terminalSource).toContain("line-clamp-[3]");
  expect(terminalSource).toContain("Click to expand full output");
  expect(terminalSource).toContain("ChevronDown");
  expect(terminalSource).toContain('variant === "native"\n          ? "rounded border border-border/60 bg-muted/25"\n          : "rounded border border-white/10 bg-[#111318]');
  expect(terminalSource).not.toContain('rounded-[0.85rem] border border-white/10 bg-[#111318]');
  expect(terminalSource).not.toContain('rounded-lg border border-border/60 bg-muted/25');
  expect(terminalSource).toContain('{shouldShowToolSpinner(activity.status) ? (');
  expect(terminalSource).toContain('{formatActivityStatus(activity.status)}\n          </span>\n        ) : null}\n        <ChevronDown');
  expect(terminalSource).toContain('{activity.inProgress ? <ThinkingDots variant={variant} /> : null}\n        <ChevronDown');
  expect(terminalSource).toContain("TERMINAL_REVEAL_CLASS");
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

test("terminal exposes a three dot text zoom menu with tiny through three notches larger", () => {
  expect(terminalSource).toContain("TERMINAL_ZOOM_LEVELS");
  expect(terminalSource).toContain('value: "tiny"');
  expect(terminalSource).toContain('value: "largest"');
  expect(terminalSource).toContain("notch: 3");
  expect(terminalSource).toContain('aria-label="Terminal text size"');
  expect(terminalSource).toContain("<MoreHorizontal");
  expect(terminalSource).toContain("<DropdownMenuGroup>");
  expect(terminalSource).toContain("<DropdownMenuLabel>Text size</DropdownMenuLabel>");
  expect(terminalSource).toContain("</DropdownMenuGroup>");
  expect(terminalSource).toContain("setTerminalZoom(level.value)");
  expect(terminalSource).toContain("--terminal-message-size");
  expect(terminalSource).toContain("text-[length:var(--terminal-message-size)]");
  expect(terminalSource).not.toContain("text-[var(--terminal-message-size)]");
});

test("terminal aligns timeline markers with row text and connects the rail", () => {
  expect(terminalSource).toContain("items-start gap-3");
  expect(terminalSource).toContain("mt-[0.32rem]");
  expect(terminalSource).toContain("absolute left-2 top-0 h-full w-px");
  expect(terminalSource).not.toContain("space-y-3");
});

test("terminal user messages render as left-indented transcript blocks outside the rail", () => {
  expect(terminalSource).toContain('if (activity.kind === "user_message")');
  expect(terminalSource).toContain('relative z-10 pl-4 sm:pl-6');
  expect(terminalSource).toContain('rounded-lg bg-[#3a3a3a]');
  expect(terminalSource).toContain('text-[#d8d8d8]');
  expect(terminalSource).not.toContain('>You</div>');
});

test("terminal surfaces fetch failures in the frontend instead of silently dropping them", () => {
  expect(terminalSource).not.toContain('action: `Load terminal output for ${agentName}`');
  expect(terminalSource).not.toContain("useQuery({");
  expect(terminalSource).not.toContain("refetchInterval: 2000");
  expect(terminalSource).not.toContain("normalizeAppError(error).message");
});

test("terminal only follows live output while the viewport is already near the bottom", () => {
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
});
