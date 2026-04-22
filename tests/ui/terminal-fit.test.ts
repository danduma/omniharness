import fs from "fs";
import path from "path";
import { test, expect } from "vitest";

const terminalSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/Terminal.tsx"),
  "utf8"
);

test("terminal renders a structured activity feed instead of replaying xterm text", () => {
  expect(terminalSource).toContain("buildAgentOutputActivity");
  expect(terminalSource).toContain('activity.kind === "thought"');
  expect(terminalSource).toContain('activity.kind === "tool"');
  expect(terminalSource).not.toContain("@xterm/xterm");
});

test("terminal surfaces fetch failures in the frontend instead of silently dropping them", () => {
  expect(terminalSource).toContain('action: `Load terminal output for ${agentName}`');
  expect(terminalSource).toContain("normalizeAppError(error).message");
  expect(terminalSource).toContain("border-t border-destructive/30");
});
