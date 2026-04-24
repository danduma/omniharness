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
});

test("terminal renders a structured activity feed instead of replaying xterm text", () => {
  expect(terminalSource).toContain("buildAgentOutputActivity");
  expect(terminalSource).toContain('activity.kind === "thought"');
  expect(terminalSource).toContain('activity.kind === "tool"');
  expect(terminalSource).not.toContain("@xterm/xterm");
});

test("terminal surfaces fetch failures in the frontend instead of silently dropping them", () => {
  expect(terminalSource).not.toContain('action: `Load terminal output for ${agentName}`');
  expect(terminalSource).not.toContain("useQuery({");
  expect(terminalSource).not.toContain("refetchInterval: 2000");
  expect(terminalSource).not.toContain("normalizeAppError(error).message");
});
