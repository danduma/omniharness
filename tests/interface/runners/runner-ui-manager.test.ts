import { describe, expect, it, vi } from "vitest";
import {
  RunnerUiManager,
  countRunnerActivity,
  runnerStatusMessageKey,
} from "@/interface/runners/RunnerUiManager";

describe("RunnerUiManager", () => {
  it("covers every runner connection status with a stable translation key", () => {
    expect(([
      "connecting",
      "online",
      "offline",
      "deferred",
      "needs-reauth",
      "tls-untrusted",
      "identity-mismatch",
      "incompatible",
      "resync",
      "degraded",
      "runner-stopping",
    ] as const).map(runnerStatusMessageKey)).toEqual([
      "runner.status.connecting",
      "runner.status.online",
      "runner.status.offline",
      "runner.status.deferred",
      "runner.status.needsReauth",
      "runner.status.tlsUntrusted",
      "runner.status.identityMismatch",
      "runner.status.incompatible",
      "runner.status.resync",
      "runner.status.degraded",
      "runner.status.stopping",
    ]);
  });

  it("keeps add, edit, forget, sessions, rename, TLS, and identity prompts in one Manager", () => {
    const manager = new RunnerUiManager();

    manager.openAdd("runner-switcher");
    manager.setDraft({ label: "Studio", baseUrl: "https://studio.example.test" });
    expect(manager.getSnapshot()).toMatchObject({
      dialog: "add",
      label: "Studio",
      baseUrl: "https://studio.example.test",
      returnFocusId: "runner-switcher",
    });

    manager.openEdit({
      id: "studio",
      label: "Studio",
      baseUrl: "https://studio.example.test",
    }, "runner-studio-menu");
    expect(manager.getSnapshot()).toMatchObject({ dialog: "edit", profileId: "studio" });

    manager.openSessions("studio", "runner-studio-menu");
    expect(manager.getSnapshot()).toMatchObject({ dialog: "sessions", profileId: "studio" });

    manager.openRename("studio", "Studio Runner", "runner-studio-menu");
    expect(manager.getSnapshot()).toMatchObject({
      dialog: "rename",
      profileId: "studio",
      label: "Studio Runner",
    });

    manager.openTlsConfirmation("studio", "sha256:abc", "runner-studio-menu");
    expect(manager.getSnapshot()).toMatchObject({
      dialog: "tls",
      fingerprint: "sha256:abc",
    });

    manager.openIdentityMismatch("studio", "expected", "observed", "runner-studio-menu");
    expect(manager.getSnapshot()).toMatchObject({
      dialog: "identity",
      expectedIdentity: "expected",
      observedIdentity: "observed",
    });

    manager.openForget("studio", "runner-studio-menu");
    expect(manager.getSnapshot()).toMatchObject({ dialog: "forget", profileId: "studio" });
  });

  it("restores focus after closing a runner dialog", async () => {
    const focus = vi.fn();
    const manager = new RunnerUiManager({
      focusElement: (id) => focus(id),
    });
    manager.openAdd("runner-switcher");
    manager.close();
    await Promise.resolve();

    expect(focus).toHaveBeenCalledWith("runner-switcher");
  });

  it("bounds inactive activity to actionable and running counts", () => {
    expect(countRunnerActivity({
      runs: [
        { status: "awaiting_user" },
        { status: "running" },
        { status: "running" },
        { status: "done" },
      ],
    })).toEqual({ needsInput: 1, running: 2 });
    expect(countRunnerActivity(null)).toEqual({ needsInput: 0, running: 0 });
  });
});
