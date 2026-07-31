import React, { useEffect, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { createVSCodeRuntimeAPIs, type VSCodeRuntimeApiTransport } from "../../../src/runtime-api/vscode";
import type { RuntimeAPIs, RuntimeSubscription } from "../../../src/runtime-api/types";
import { t, useI18nSnapshot } from "../../../src/lib/i18n";

declare const acquireVsCodeApi: () => { postMessage(message: unknown): void };

type VSCodeBootstrap = {
  serverUrl: string;
  workspacePath: string | null;
  profiles?: {
    activeProfileId: string;
    profiles: Array<{
      id: string;
      label: string;
      baseUrl: string;
      requiresReauth: boolean;
      runnerInstanceId?: string | null;
    }>;
  };
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

type VSCodeProfileSummary = {
  id: string;
  label: string;
  baseUrl: string;
  requiresReauth: boolean;
  runnerInstanceId?: string | null;
};

type SessionSummary = {
  id: string;
  label?: string | null;
  clientKind?: string | null;
  expiresAt?: string | null;
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
  activeProfileId: string;
  connectionLabel: string;
  connectionUrl: string;
  connectionPassword: string;
  sessions: SessionSummary[];
  currentSessionId: string | null;
  identityExpected: string | null;
  identityObserved: string | null;
  profileStatuses: Record<string, PanelStatusKey>;
  profileErrors: Record<string, string>;
};

const bootstrap = window.__OMNI_VSCODE_BOOTSTRAP__ ?? {
  serverUrl: "http://localhost:3050",
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
    activeProfileId: bootstrap.profiles?.activeProfileId ?? "default",
    connectionLabel: "",
    connectionUrl: "",
    connectionPassword: "",
    sessions: [],
    currentSessionId: null,
    identityExpected: null,
    identityObserved: null,
    profileStatuses: {},
    profileErrors: {},
  };
  private readonly listeners = new Set<() => void>();
  private readonly eventSubscriptions = new Map<string, RuntimeSubscription>();
  private readonly apis = new Map<string, RuntimeAPIs>();
  private readonly runsByProfile = new Map<string, RunSummary[]>();
  readonly profiles: VSCodeProfileSummary[];

  constructor(
    private readonly transport: VSCodeRuntimeApiTransport,
    profiles = bootstrap.profiles?.profiles ?? [{
      id: "default",
      label: "Local runner",
      baseUrl: bootstrap.serverUrl,
      requiresReauth: true,
    }],
  ) {
    this.profiles = [...profiles];
    for (const profile of profiles) {
      this.apis.set(
        profile.id,
        createVSCodeRuntimeAPIs({ transport, profileId: profile.id }),
      );
    }
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  setPrompt(prompt: string) {
    this.commit({ prompt });
  }

  setConnectionDraft(patch: Partial<Pick<
    PanelSnapshot,
    "connectionLabel" | "connectionUrl" | "connectionPassword"
  >>) {
    this.commit(patch);
  }

  async connectRunner() {
    this.commit({ error: "", statusKey: "vscode.panel.status.loading" });
    try {
      const response = await this.requestHost<{
        success?: boolean;
        data?: {
          profile?: { id?: unknown };
          profiles?: {
            profiles?: VSCodeProfileSummary[];
          };
        };
        error?: { message?: unknown };
      }>({
        type: "vscode:login",
        payload: {
          label: this.snapshot.connectionLabel,
          baseUrl: this.snapshot.connectionUrl,
          password: this.snapshot.connectionPassword,
        },
      });
      if (!response.success) {
        throw new Error(
          typeof response.error?.message === "string"
            ? response.error.message
            : "Runner login failed.",
        );
      }
      const nextProfiles = response.data?.profiles?.profiles ?? [];
      this.profiles.splice(0, this.profiles.length, ...nextProfiles);
      const profileId = response.data?.profile?.id;
      if (typeof profileId !== "string") throw new Error("Runner profile was not returned.");
      this.apis.set(
        profileId,
        createVSCodeRuntimeAPIs({ transport: this.transport, profileId }),
      );
      this.commit({
        activeProfileId: profileId,
        connectionPassword: "",
        statusKey: "vscode.panel.status.connected",
      });
      await this.refresh();
    } catch (error) {
      this.commit({
        statusKey: "vscode.panel.status.disconnected",
        error: error instanceof Error ? error.message : String(error),
        connectionPassword: "",
      });
    }
  }

  setActiveProfile(activeProfileId: string) {
    if (!this.apis.has(activeProfileId)) return;
    this.commit({
      activeProfileId,
      runs: this.runsByProfile.get(activeProfileId) ?? [],
      error: this.snapshot.profileErrors[activeProfileId] ?? "",
      statusKey: this.snapshot.profileStatuses[activeProfileId]
        ?? "vscode.panel.status.loading",
      sessions: [],
      currentSessionId: null,
      identityExpected: null,
      identityObserved: null,
    });
    void this.loadSessions(activeProfileId);
  }

  async refresh() {
    this.commit({ statusKey: "vscode.panel.status.loadingConversations", error: "" });
    const profileStatuses = { ...this.snapshot.profileStatuses };
    const profileErrors = { ...this.snapshot.profileErrors };
    await Promise.all([...this.apis].map(async ([profileId, apis]) => {
      try {
        const payload = await apis.bootstrap.load({
          draftProjectPath: bootstrap.workspacePath,
        });
        const identityMismatch = await this.applyRunnerIdentity(profileId, payload);
        if (identityMismatch) {
          profileStatuses[profileId] = "vscode.panel.status.disconnected";
          profileErrors[profileId] = t("runner.identity.description");
          return;
        }
        this.runsByProfile.set(profileId, runsFromBootstrap(payload));
        this.ensureEventsOpen(profileId, apis);
        profileStatuses[profileId] = "vscode.panel.status.connected";
        delete profileErrors[profileId];
      } catch (error) {
        profileStatuses[profileId] = "vscode.panel.status.disconnected";
        profileErrors[profileId] = error instanceof Error
          ? error.message
          : String(error);
      }
    }));
    const activeProfileId = this.snapshot.activeProfileId;
    this.commit({
      profileStatuses,
      profileErrors,
      statusKey: profileStatuses[activeProfileId]
        ?? "vscode.panel.status.disconnected",
      error: profileErrors[activeProfileId] ?? "",
      runs: this.runsByProfile.get(activeProfileId) ?? [],
    });
    await this.loadSessions(activeProfileId);
  }

  async loadSessions(profileId = this.snapshot.activeProfileId) {
    try {
      const response = await this.apis.get(profileId)?.auth.session() as {
        sessions?: SessionSummary[];
        currentSession?: { id?: string } | null;
      } | undefined;
      if (profileId !== this.snapshot.activeProfileId) return;
      this.commit({
        sessions: response?.sessions ?? [],
        currentSessionId: response?.currentSession?.id ?? null,
      });
    } catch {
      if (profileId === this.snapshot.activeProfileId) {
        this.commit({ sessions: [], currentSessionId: null });
      }
    }
  }

  async revokeSession(sessionId: string) {
    try {
      await this.apis.get(this.snapshot.activeProfileId)?.auth.revokeSession({
        sessionId,
      });
      await this.loadSessions();
    } catch (error) {
      this.commit({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async acceptIdentity() {
    const profileId = this.snapshot.activeProfileId;
    const observed = this.snapshot.identityObserved;
    if (!observed) return;
    const response = await this.requestHost<{
      success?: boolean;
      error?: { message?: unknown };
    }>({
      type: "vscode:identity",
      payload: {
        profileId,
        runnerInstanceId: observed,
        confirmChange: true,
      },
    });
    if (!response.success) {
      this.commit({
        error: typeof response.error?.message === "string"
          ? response.error.message
          : t("runner.error.generic"),
      });
      return;
    }
    const profile = this.profiles.find((item) => item.id === profileId);
    if (profile) profile.runnerInstanceId = observed;
    this.commit({ identityExpected: null, identityObserved: null, error: "" });
    await this.refresh();
  }

  async startConversation() {
    const command = this.snapshot.prompt.trim();
    if (!command) {
      return;
    }
    this.commit({ statusKey: "vscode.panel.status.starting", error: "" });
    try {
      await this.apis.get(this.snapshot.activeProfileId)?.conversations.create({
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
    const profile = this.profiles.find(
      (item) => item.id === this.snapshot.activeProfileId,
    );
    const apis = this.apis.get(this.snapshot.activeProfileId);
    if (profile) void apis?.native?.openExternal({ url: profile.baseUrl });
  }

  dispose() {
    for (const subscription of this.eventSubscriptions.values()) {
      subscription.close();
    }
    this.eventSubscriptions.clear();
  }

  private ensureEventsOpen(profileId: string, apis: RuntimeAPIs) {
    if (this.eventSubscriptions.has(profileId)) {
      return;
    }
    this.eventSubscriptions.set(profileId, apis.events.open({ snapshot: false }, {
      onEvent: (event) => this.applyEvent(profileId, event),
      onError: (error) => {
        if (profileId === this.snapshot.activeProfileId) {
          this.commit({ error: error.message });
        }
      },
    }));
  }

  private async applyRunnerIdentity(profileId: string, payload: unknown) {
    const observed = payload && typeof payload === "object"
      ? (payload as {
          runner?: { runnerInstanceId?: unknown };
        }).runner?.runnerInstanceId
      : null;
    if (typeof observed !== "string" || !observed) return false;
    const profile = this.profiles.find((item) => item.id === profileId);
    if (!profile) return false;
    if (profile.runnerInstanceId && profile.runnerInstanceId !== observed) {
      if (profileId === this.snapshot.activeProfileId) {
        this.commit({
          identityExpected: profile.runnerInstanceId,
          identityObserved: observed,
        });
      }
      return true;
    }
    if (!profile.runnerInstanceId) {
      const response = await this.requestHost<{ success?: boolean }>({
        type: "vscode:identity",
        payload: {
          profileId,
          runnerInstanceId: observed,
          confirmChange: false,
        },
      });
      if (response.success) profile.runnerInstanceId = observed;
    }
    return false;
  }

  private requestHost<T>(message: {
    type: "vscode:login" | "vscode:identity";
    payload: unknown;
  }) {
    const id = `host-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return new Promise<T>((resolve) => {
      const unsubscribe = this.transport.addMessageListener((response) => {
        if ((response as { id?: unknown }).id === id) {
          unsubscribe();
          resolve(response as T);
        }
      });
      this.transport.postMessage({ id, ...message });
    });
  }

  private applyEvent(profileId: string, event: unknown) {
    if (!event || typeof event !== "object") {
      return;
    }
    const payload = (event as { payload?: unknown }).payload;
    if (!payload || typeof payload !== "object") {
      return;
    }
    const runs = normalizeRuns((payload as { runs?: unknown }).runs);
    if (runs.length > 0 || Array.isArray((payload as { runs?: unknown }).runs)) {
      this.runsByProfile.set(profileId, runs);
      if (profileId === this.snapshot.activeProfileId) {
        this.commit({ runs, statusKey: "vscode.panel.status.connected" });
      }
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
        <label className="omni-muted" htmlFor="runner-profile">
          {t("runner.switcher.label")}
        </label>
        <select
          id="runner-profile"
          value={snapshot.activeProfileId}
          onChange={(event) => manager.setActiveProfile(event.currentTarget.value)}
        >
          {manager.profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.label} — {t(
                snapshot.profileStatuses[profile.id]
                  ?? "vscode.panel.status.loading",
              )}
            </option>
          ))}
        </select>
        <div className="omni-muted">{t("vscode.panel.server")}</div>
        <div>
          {manager.profiles.find(
            (profile) => profile.id === snapshot.activeProfileId,
          )?.baseUrl ?? bootstrap.serverUrl}
        </div>
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
      <section className="omni-panel" style={{ padding: 0 }}>
        <input
          value={snapshot.connectionLabel}
          placeholder={t("runner.field.namePlaceholder")}
          aria-label={t("runner.field.name")}
          onChange={(event) => manager.setConnectionDraft({
            connectionLabel: event.currentTarget.value,
          })}
        />
        <input
          type="url"
          value={snapshot.connectionUrl}
          placeholder={t("runner.field.urlPlaceholder")}
          aria-label={t("runner.field.url")}
          onChange={(event) => manager.setConnectionDraft({
            connectionUrl: event.currentTarget.value,
          })}
        />
        <input
          type="password"
          value={snapshot.connectionPassword}
          placeholder={t("runner.field.passwordPlaceholder")}
          aria-label={t("runner.field.password")}
          onChange={(event) => manager.setConnectionDraft({
            connectionPassword: event.currentTarget.value,
          })}
        />
        <button
          type="button"
          disabled={!snapshot.connectionUrl || !snapshot.connectionPassword}
          onClick={() => void manager.connectRunner()}
        >
          {t("runner.action.connect")}
        </button>
      </section>
      <div className="omni-muted">{t(snapshot.statusKey)}</div>
      {snapshot.error ? <div className="omni-error">{snapshot.error}</div> : null}
      {snapshot.identityObserved ? (
        <section className="omni-panel" style={{ padding: 0 }}>
          <strong>{t("runner.identity.title")}</strong>
          <div className="omni-muted">{t("runner.identity.description")}</div>
          <div>{t("runner.identity.expected", {
            id: snapshot.identityExpected ?? t("common.unknown"),
          })}</div>
          <div>{t("runner.identity.observed", {
            id: snapshot.identityObserved,
          })}</div>
          <button type="button" onClick={() => void manager.acceptIdentity()}>
            {t("runner.identity.confirm")}
          </button>
        </section>
      ) : null}
      <section className="omni-panel" style={{ padding: 0 }}>
        <strong>{t("runner.sessions.title")}</strong>
        <div className="omni-muted">{t("runner.sessions.description")}</div>
        {snapshot.sessions.length === 0 ? (
          <div className="omni-muted">{t("runner.sessions.empty")}</div>
        ) : snapshot.sessions.map((session) => (
          <div className="omni-run" key={session.id}>
            <div className="omni-run-title">
              {session.label || session.clientKind || t("runner.sessions.unnamed")}
            </div>
            {session.id === snapshot.currentSessionId ? (
              <div className="omni-muted">{t("runner.sessions.current")}</div>
            ) : null}
            {session.expiresAt ? (
              <div className="omni-muted">{t("runner.sessions.expires", {
                date: new Date(session.expiresAt).toLocaleString(),
              })}</div>
            ) : null}
            <button
              type="button"
              className="secondary"
              onClick={() => void manager.revokeSession(session.id)}
            >
              {t("runner.sessions.revoke")}
            </button>
          </div>
        ))}
      </section>
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

const transport = makeTransport();
const manager = new VSCodePanelManager(transport);
const root = document.getElementById("root");

if (root) {
  createRoot(root).render(<Panel manager={manager} />);
}
