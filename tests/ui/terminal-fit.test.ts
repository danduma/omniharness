import fs from "fs";
import path from "path";
import { test, expect } from "vitest";

const terminalSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/Terminal.tsx"),
  "utf8"
);

test("terminal refits when its container changes size, not just on window resize", () => {
  expect(terminalSource).toContain("const resizeObserver = new ResizeObserver");
  expect(terminalSource).toContain("resizeObserver.observe(terminalRef.current)");
  expect(terminalSource).toContain("window.addEventListener(\"resize\", handleResize)");
  expect(terminalSource).toContain("fitAddon.fit()");
  expect(terminalSource).toContain("resizeObserver.disconnect()");
});

test("terminal surfaces fetch failures in the frontend instead of silently dropping them", () => {
  expect(terminalSource).toContain('action: `Load terminal output for ${agentName}`');
  expect(terminalSource).toContain("normalizeAppError(error).message");
  expect(terminalSource).toContain("border-t border-destructive/30");
});
