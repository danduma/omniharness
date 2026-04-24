import fs from "fs";
import path from "path";
import { test, expect } from "vitest";

const terminalSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/Terminal.tsx"),
  "utf8"
);

test("terminal can render in native conversation mode without window chrome", () => {
  expect(terminalSource).toContain('variant = "terminal"');
  expect(terminalSource).toContain('variant?: "terminal" | "native"');
  expect(terminalSource).toContain('variant === "native"');
  expect(terminalSource).toContain('bg-transparent text-foreground');
  expect(terminalSource).toContain('variant === "native" ? "text-sm leading-6" : "text-[9px] leading-[1.55]"');
});

test("terminal renders a structured activity feed instead of replaying xterm text", () => {
  expect(terminalSource).toContain("buildAgentOutputActivity");
  expect(terminalSource).toContain('activity.kind === "thought"');
  expect(terminalSource).toContain('activity.kind === "tool"');
  expect(terminalSource).not.toContain("@xterm/xterm");
});

test("terminal keeps tool output compact and expandable", () => {
  expect(terminalSource).toContain("const TOOL_OUTPUT_PREVIEW_LINES = 3");
  expect(terminalSource).toContain("isTerminalToolStatus(activity.status)");
  expect(terminalSource).toContain("setDetailsOpen(false)");
  expect(terminalSource).toContain("setOutputExpanded(false)");
  expect(terminalSource).toContain("onClick={() => setDetailsOpen((open) => {");
  expect(terminalSource).toContain("line-clamp-[3]");
  expect(terminalSource).toContain("Click to expand full output");
});

test("terminal aligns timeline markers with row text and connects the rail", () => {
  expect(terminalSource).toContain("items-start gap-3");
  expect(terminalSource).toContain("mt-[0.32rem]");
  expect(terminalSource).toContain("absolute left-2 top-0 h-full w-px");
  expect(terminalSource).not.toContain("space-y-3");
});

test("terminal surfaces fetch failures in the frontend instead of silently dropping them", () => {
  expect(terminalSource).not.toContain('action: `Load terminal output for ${agentName}`');
  expect(terminalSource).not.toContain("useQuery({");
  expect(terminalSource).not.toContain("refetchInterval: 2000");
  expect(terminalSource).not.toContain("normalizeAppError(error).message");
});
