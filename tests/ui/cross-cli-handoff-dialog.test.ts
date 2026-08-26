import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const sourcePath = path.resolve(process.cwd(), "src/components/home/CrossCliHandoffDialog.tsx");

describe("cross CLI handoff dialog", () => {
  it("uses the composer selectors instead of free-text target option fields", () => {
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source).toContain("ComposerModelPicker");
    expect(source).toContain("ComposerSelect");
    expect(source).not.toContain('<Input id="handoff-model"');
    expect(source).not.toContain('<Input id="handoff-effort"');
    expect(source).not.toContain('<Input id="handoff-account"');
  });

  it("uses one responsive selector layout for desktop and mobile", () => {
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source).toContain('data-handoff-target-controls="true"');
    expect(source).toContain("sm:grid-cols-2");
    expect(source).toContain("getWorkerModelOptions");
    expect(source).toContain("formatAccountOptionLabel");
  });

  it("keeps the packet preview and editor off the mobile dialog", () => {
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source).toContain('data-handoff-packet-preview="true"');
    expect(source).toContain('className="hidden rounded-lg border bg-muted/25 p-4 sm:block"');
  });
});
