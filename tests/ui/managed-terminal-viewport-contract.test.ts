import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("managed authentication terminal viewport", () => {
  it("attaches to the supplied terminal without creating or killing its server-owned process", () => {
    const source = readFileSync("src/components/ManagedTerminalViewport.tsx", "utf8");

    expect(source).toContain("openStream({ terminalId }");
    expect(source).toContain('terminals.input({ terminalId');
    expect(source).toContain('terminals.resize({ terminalId');
    expect(source).not.toContain("terminals.create(");
    expect(source).not.toContain("terminals.close(");
  });
});
