import fs from "fs";
import path from "path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  getMobileComposerSettingDescriptors,
  MobileComposerSettings,
  type MobileComposerSettingDescriptorArgs,
} from "@/components/composer/MobileComposerSettings";
import type { ComposerWorkerOption } from "@/interface/home/types";

const sourcePath = path.resolve(process.cwd(), "src/components/composer/MobileComposerSettings.tsx");

const baseArgs: MobileComposerSettingDescriptorArgs = {
  shouldLockDirectWorker: false,
  lockedDirectWorkerLabel: "Claude Code",
  selectedCliAgent: "codex",
  setSelectedCliAgent: () => undefined,
  composerWorkerOptions: [
    { value: "codex", label: "Codex" },
    { value: "claude", label: "Claude Code" },
  ],
  selectedWorkerAccountId: "auto",
  setSelectedWorkerAccountId: () => undefined,
  composerAccountOptions: [{ value: "auto", label: "Auto account" }],
  selectedModel: "gpt-5.6-sol",
  setSelectedModel: () => undefined,
  activeWorkerModelOptions: [{ value: "gpt-5.6-sol", label: "gpt-5.6-sol" }],
  selectedEffort: "High",
  setSelectedEffort: () => undefined,
  disabled: false,
};

function renderSettings(overrides: Partial<React.ComponentProps<typeof MobileComposerSettings>> = {}) {
  return renderToStaticMarkup(
    <MobileComposerSettings
      {...baseArgs}
      selectedRunId="run-1"
      workspaceProjectPath={null}
      themeMode="night"
      settingsOpen={false}
      onSettingsOpenChange={() => undefined}
      {...overrides}
    />,
  );
}

describe("mobile composer settings", () => {
  it("renders one unlabeled settings chip without account in its summary", () => {
    const html = renderSettings();

    expect(fs.existsSync(sourcePath)).toBe(true);
    expect(html).toContain('data-composer-settings-chip="true"');
    expect(html).toContain('aria-label="Settings"');
    expect(html).toContain("Codex");
    expect(html).toContain("gpt-5.6-sol");
    expect(html).toContain("High");
    expect(html).not.toContain("Auto account");
    expect(html).not.toContain(">CLI<");
    expect(html).not.toContain(">Model<");
    expect(html).not.toContain(">Effort<");
    expect(html).not.toContain(">Account<");
    expect(html).not.toContain('data-composer-workspace="true"');
  });

  it("renders the workspace chip only for a new conversation", () => {
    const html = renderToStaticMarkup(
      <MobileComposerSettings
        {...baseArgs}
        selectedRunId={null}
        workspaceProjectPath={null}
        themeMode="night"
        settingsOpen={false}
        onSettingsOpenChange={() => undefined}
      />,
    );

    expect(html).toContain('data-composer-settings-chip="true"');
  });

  it("opens the existing labeled settings dialog from the single chip", () => {
    const html = renderSettings({ settingsOpen: true });
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(html).toContain('aria-label="Settings"');
    expect(source).toContain('data-composer-settings-dialog="true"');
    expect(source).toContain('t("conversation.composer.settings.agent")');
    expect(source).toContain('t("conversation.composer.settings.effort")');
    expect(source).toContain('t("conversation.composer.workerModelAria")');
    expect(source).toContain("settingsOpen");
  });

  it("keeps locked CLI and disabled states visible while retaining account in settings descriptors", () => {
    const source = fs.readFileSync(sourcePath, "utf8");
    expect(source).toContain("{descriptors.map((descriptor) => (");

    const lockedHtml = renderSettings({
      shouldLockDirectWorker: true,
      disabled: true,
    });
    expect(lockedHtml).toContain("Claude Code");
    expect(lockedHtml).not.toContain('aria-label="Agent"');
    expect(lockedHtml).toContain('title="Claude Code · gpt-5.6-sol · High"');

    const gatewayHtml = renderSettings({
      composerAccountOptions: [{ value: "auto", label: "Gateway provider connection" }],
    });
    expect(gatewayHtml).not.toContain("Gateway provider connection");
    const descriptors = getMobileComposerSettingDescriptors({
      ...baseArgs,
      composerAccountOptions: [
        { value: "auto", label: "Auto account" },
        { value: "gateway", label: "Gateway provider connection" },
      ],
    });
    const account = descriptors.find((descriptor) => descriptor.key === "account");
    if (!account || account.kind !== "select") {
      throw new Error("Expected the account setting descriptor to remain selectable");
    }
    expect(account.options).toEqual([
      { value: "auto", label: "Auto account" },
      { value: "gateway", label: "Gateway provider connection" },
    ]);
  });

  it("wires every selectable descriptor to the existing setter", () => {
    const selected: Record<string, string> = {};
    const descriptors = getMobileComposerSettingDescriptors({
      ...baseArgs,
      setSelectedCliAgent: (value: ComposerWorkerOption) => { selected.cli = value; },
      setSelectedWorkerAccountId: (value: string) => { selected.account = value; },
      setSelectedModel: (value: string) => { selected.model = value; },
      setSelectedEffort: (value: string) => { selected.effort = value; },
    });

    const cli = descriptors.find((descriptor) => descriptor.key === "cli");
    const model = descriptors.find((descriptor) => descriptor.key === "model");
    const effort = descriptors.find((descriptor) => descriptor.key === "effort");
    const account = descriptors.find((descriptor) => descriptor.key === "account");
    if (cli?.kind === "select") cli.onChange("claude");
    if (model?.kind === "model") model.onChange("gpt-5.5");
    if (effort?.kind === "select") effort.onChange("Max");
    if (account?.kind === "select") account.onChange("account-1");

    expect(selected).toEqual({ cli: "claude", model: "gpt-5.5", effort: "Max", account: "account-1" });
  });
});
