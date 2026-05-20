import React, { useEffect, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { createVSCodeRuntimeAPIs, type VSCodeRuntimeApiTransport } from "../../../src/runtime-api/vscode";
import type { RuntimeAPIs, RuntimeSubscription } from "../../../src/runtime-api/types";
import { t, useI18nSnapshot } from "../../../src/lib/i18n";

declare const acquireVsCodeApi: () => { postMessage(message: unknown): void };

type VSCodeBootstrap = {
  serverUrl: string;
  workspacePath: string | null;
};

declare global {
  interface Window {
    __OMNI_VSCODE_BOOTSTRAP__?: VSCodeBootstrap;
  }
}

type RunSummary = {
  id: string;
  title?: string | null;
  status?: string | null;
  projectPath?: string | null;
};

type PanelStatusKey =
  | "vscode.panel.status.loading"
  | "vscode.panel.status.loadingConversations"
  | "vscode.panel.status.connected"
  | "vscode.panel.status.disconnected"
  | "vscode.panel.status.starting";

type PanelSnapshot = {
  statusKey: PanelStatusKey;
  error: string;
  prompt: string;
  runs: RunSummary[];
};

const bootstrap = window.__OMNI_VSCODE_BOOTSTRAP__ ?? {
  serverUrl: "http://localhost:3035",
  workspacePath: null,
};

function makeTransport(): VSCodeRuntimeApiTransport {
  const vscode = acquireVsCodeApi();
  return {
    postMessage(message) {
      vscode.postMessage(message);
    },
    addMessageListener(listener) {
      const handleMessage = (event: MessageEvent) => listener(event.data);
      window.addEventListener("message", handleMessage);
      return () => window.removeEventListener("message", handleMessage);
    },
  };
}

function normalizeRuns(value: unknown): RunSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const run = item as {
      id?: unknown;
      title?: unknown;
      status?: unknown;
      projectPath?: unknown;
    };
    if (typeof run.id !== "string") {
      return [];
    }
    return [{
      id: run.id,
      title: typeof run.title === "string" ? run.title : null,
      status: typeof run.status === "string" ? run.status : null,
      projectPath: typeof run.projectPath === "string" ? run.projectPath : null,
    }];
  });
}

function runsFromBootstrap(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const state = (payload as { initialEventState?: unknown }).initialEventState;
  if (!state || typeof state !== "object") {
    return [];
  }
  return normalizeRuns((state as { runs?: unknown }).runs);
}

class VSCodePanelManager {
  private snapshot: PanelSnapshot = {
    statusKey: "vscode.panel.status.loading",
    error: "",
    prompt: "",
    runs: [],
  };
  private readonly listeners = new Set<() => void>();
  private eventSubscription: RuntimeSubscription | null = null;

  constructor(private readonly apis: RuntimeAPIs) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  setPrompt(prompt: string) {
    this.commit({ prompt });
  }

  async refresh() {
    this.commit({ statusKey: "vscode.panel.status.loadingConversations", error: "" });
    try {
      const payload = await this.apis.bootstrap.load({
        draftProjectPath: bootstrap.workspacePath,
      });
      this.commit({
        statusKey: "vscode.panel.status.connected",
        runs: runsFromBootstrap(payload),
      });
      this.ensureEventsOpen();
    } catch (error) {
      this.commit({
        statusKey: "vscode.panel.status.disconnected",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async startConversation() {
    const command = this.snapshot.prompt.trim();
    if (!command) {
      return;
    }
    this.commit({ statusKey: "vscode.panel.status.starting", error: "" });
    try {
      await this.apis.conversations.create({
        mode: "implementation",
        command,
        projectPath: bootstrap.workspacePath,
      });
      this.commit({ prompt: "" });
      await this.refresh();
    } catch (error) {
      this.commit({
        statusKey: "vscode.panel.status.connected",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  openExternal() {
    void this.apis.native?.openExternal({ url: bootstrap.serverUrl });
  }

  dispose() {
    this.eventSubscription?.close();
    this.eventSubscription = null;
  }

  private ensureEventsOpen() {
    if (this.eventSubscription) {
      return;
    }
    this.eventSubscription = this.apis.events.open({ snapshot: false }, {
      onEvent: (event) => this.applyEvent(event),
      onError: (error) => {
        this.commit({ error: error.message });
      },
    });
  }

  private applyEvent(event: unknown) {
    if (!event || typeof event !== "object") {
      return;
    }
    const payload = (event as { payload?: unknown }).payload;
    if (!payload || typeof payload !== "object") {
      return;
    }
    const runs = normalizeRuns((payload as { runs?: unknown }).runs);
    if (runs.length > 0 || Array.isArray((payload as { runs?: unknown }).runs)) {
      this.commit({ runs, statusKey: "vscode.panel.status.connected" });
    }
  }

  private commit(patch: Partial<PanelSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) {
      listener();
    }
  }
}

function RunList({ runs }: { runs: RunSummary[] }) {
  if (runs.length === 0) {
    return <div className="omni-muted">{t("vscode.panel.noConversations")}</div>;
  }

  return (
    <>
      {runs.slice(0, 12).map((run) => (
        <div className="omni-run" key={run.id}>
          <div className="omni-run-title">{run.title || run.id}</div>
          <div className="omni-muted">
            {run.status || t("common.unknown")} {" - "} {run.projectPath || t("vscode.panel.noProject")}
          </div>
        </div>
      ))}
    </>
  );
}

function Panel({ manager }: { manager: VSCodePanelManager }) {
  useI18nSnapshot();
  const snapshot = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getSnapshot);

  useEffect(() => {
    const handleCommand = (event: MessageEvent) => {
      const message = event.data as { type?: unknown; command?: unknown };
      if (message?.type === "command" && message.command === "refresh") {
        void manager.refresh();
      }
    };
    window.addEventListener("message", handleCommand);
    void manager.refresh();
    return () => {
      window.removeEventListener("message", handleCommand);
      manager.dispose();
    };
  }, [manager]);

  return (
    <main className="omni-panel">
      <section>
        <div className="omni-muted">{t("vscode.panel.server")}</div>
        <div>{bootstrap.serverUrl}</div>
        <div className="omni-muted">
          {t("vscode.panel.workspace", { path: bootstrap.workspacePath || t("vscode.panel.noWorkspace") })}
        </div>
      </section>
      <section className="omni-row">
        <button type="button" onClick={() => void manager.refresh()}>{t("fileViewer.menu.refresh")}</button>
        <button type="button" className="secondary" onClick={() => manager.openExternal()}>
          {t("vscode.panel.openInBrowser")}
        </button>
      </section>
      <div className="omni-muted">{t(snapshot.statusKey)}</div>
      {snapshot.error ? <div className="omni-error">{snapshot.error}</div> : null}
      <textarea
        value={snapshot.prompt}
        placeholder={t("vscode.panel.promptPlaceholder")}
        onChange={(event) => manager.setPrompt(event.currentTarget.value)}
      />
      <button type="button" onClick={() => void manager.startConversation()}>
        {t("vscode.panel.startConversation")}
      </button>
      <section className="omni-panel" style={{ padding: 0 }}>
        <RunList runs={snapshot.runs} />
      </section>
    </main>
  );
}

const apis = createVSCodeRuntimeAPIs({ transport: makeTransport() });
const manager = new VSCodePanelManager(apis);
const root = document.getElementById("root");

if (root) {
  createRoot(root).render(<Panel manager={manager} />);
}
