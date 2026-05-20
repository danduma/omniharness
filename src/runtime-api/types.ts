export type RuntimeSurface = "web" | "electron" | "vscode";

export type RuntimeApiError = {
  code: string;
  message: string;
  details?: unknown;
  surface?: RuntimeSurface | string;
  runId?: string;
  workerId?: string;
  conversationId?: string;
};

export type RuntimeSubscription = {
  close(): void;
};

export type EventStreamHandlers = {
  onEvent(event: unknown): void;
  onError?(error: RuntimeApiError): void;
};

export interface RuntimeAPIs {
  runtime: {
    surface: RuntimeSurface;
    label: string;
    supportsNativeNotifications: boolean;
    supportsEditorActions: boolean;
  };
  bootstrap: {
    load(input: {
      selectedRunId?: string | null;
      draftProjectPath?: string | null;
      pairToken?: string | null;
    }): Promise<unknown>;
  };
  events: {
    open(input: {
      snapshot: boolean;
      runId?: string | null;
      lastEventId?: string | null;
    }, handlers: EventStreamHandlers): RuntimeSubscription;
    fetchLog(input: { since?: string; runId?: string | null }): Promise<unknown>;
  };
  conversations: {
    create(input: unknown): Promise<unknown>;
    sendMessage(input: unknown): Promise<unknown>;
  };
  workers: {
    listEntries(input: { runId: string; workerId: string; afterSeq?: number }): Promise<unknown>;
  };
  settings: {
    load(): Promise<unknown>;
    save(input: unknown): Promise<unknown>;
  };
  native?: {
    openExternal(input: { url: string }): Promise<{ ok: true }>;
    chooseFolder?(): Promise<{ path: string | null }>;
    notify?(input: { title: string; body?: string }): Promise<{ ok: boolean }>;
  };
  editor?: {
    openFile(input: { path: string; line?: number; column?: number }): Promise<{ ok: true }>;
    openDiff(input: { originalPath: string; modifiedPath: string; title?: string }): Promise<{ ok: true }>;
  };
}
