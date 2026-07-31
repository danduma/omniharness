export type RuntimeSurface = "web" | "electron" | "vscode" | "capacitor";

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

export type RuntimeCallOptions = {
  signal?: AbortSignal;
};

export type RuntimeSnapshotResult = {
  data: unknown;
  lastEventId: string | null;
};

export type EventStreamHandlers = {
  onOpen?(): void;
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
    snapshot(input: {
      runId?: string | null;
      persisted?: boolean;
      checksum?: string | null;
    }, options?: RuntimeCallOptions): Promise<RuntimeSnapshotResult>;
    open(input: {
      snapshot: boolean;
      runId?: string | null;
      lastEventId?: string | null;
    }, handlers: EventStreamHandlers): RuntimeSubscription;
    fetchLog(input: { since?: string; runId?: string | null }): Promise<unknown>;
  };
  auth: {
    session(options?: RuntimeCallOptions): Promise<unknown>;
    login(input: unknown, options?: RuntimeCallOptions): Promise<unknown>;
    logout(options?: RuntimeCallOptions): Promise<unknown>;
    createPair(input?: unknown, options?: RuntimeCallOptions): Promise<unknown>;
    getPair(input: { id: string }, options?: RuntimeCallOptions): Promise<unknown>;
    redeemPair(input: unknown, options?: RuntimeCallOptions): Promise<unknown>;
    approveBrowserAuthorization(input: unknown, options?: RuntimeCallOptions): Promise<unknown>;
    exchangeBrowserAuthorization(input: unknown, options?: RuntimeCallOptions): Promise<unknown>;
    revokeSession(input: { sessionId: string }, options?: RuntimeCallOptions): Promise<unknown>;
    revokeAllSessions(options?: RuntimeCallOptions): Promise<unknown>;
    createStreamTicket(input: { path: string }, options?: RuntimeCallOptions): Promise<{
      ticket: string;
      expiresAt: string;
    }>;
  };
  runner: {
    rename(input: { name: string }, options?: RuntimeCallOptions): Promise<unknown>;
    rekey(input?: {
      confirmRunnerInstanceId?: string;
    }, options?: RuntimeCallOptions): Promise<unknown>;
  };
  runs: {
    get(input: { runId: string }, options?: RuntimeCallOptions): Promise<unknown>;
    act(input: { runId: string; body: unknown }, options?: RuntimeCallOptions): Promise<unknown>;
    update(input: { runId: string; patch: unknown }, options?: RuntimeCallOptions): Promise<unknown>;
    remove(input: { runId: string; body?: unknown }, options?: RuntimeCallOptions): Promise<unknown>;
    resume(input: { runId: string; body?: unknown }, options?: RuntimeCallOptions): Promise<unknown>;
    answer(input: { runId: string; body: unknown }, options?: RuntimeCallOptions): Promise<unknown>;
  };
  conversations: {
    create(input: unknown, options?: RuntimeCallOptions): Promise<unknown>;
    sendMessage(input: unknown, options?: RuntimeCallOptions): Promise<unknown>;
    sendTo(input: { runId: string; body: unknown }, options?: RuntimeCallOptions): Promise<unknown>;
    transcript(input: {
      runId: string;
      beforeSeq?: number;
      afterSeq?: number;
      beforeToken?: string;
      afterToken?: string;
      limit?: number;
    }, options?: RuntimeCallOptions): Promise<unknown>;
    updateQueuedMessage(input: {
      runId: string;
      messageId: string;
      body: unknown;
    }, options?: RuntimeCallOptions): Promise<unknown>;
    removeQueuedMessage(input: {
      runId: string;
      messageId: string;
    }, options?: RuntimeCallOptions): Promise<unknown>;
    interruptQueuedMessage(input: {
      runId: string;
      messageId: string;
      body?: unknown;
    }, options?: RuntimeCallOptions): Promise<unknown>;
    interruptNextQueuedMessage(input: {
      runId: string;
      body?: unknown;
    }, options?: RuntimeCallOptions): Promise<unknown>;
    listExternalSessions(input: {
      projectPath?: string | null;
    }, options?: RuntimeCallOptions): Promise<unknown>;
  };
  workers: {
    listEntries(input: {
      runId?: string;
      workerId: string;
      afterSeq?: number;
      beforeSeq?: number;
      limit?: number;
    }, options?: RuntimeCallOptions): Promise<unknown>;
    get(input: { workerId: string; history?: "full" }, options?: RuntimeCallOptions): Promise<unknown>;
    prewarm(input?: unknown, options?: RuntimeCallOptions): Promise<unknown>;
    answerElicitation(input: {
      workerId: string;
      body: unknown;
    }, options?: RuntimeCallOptions): Promise<unknown>;
    answerPermission(input: {
      workerId: string;
      body: unknown;
    }, options?: RuntimeCallOptions): Promise<unknown>;
    catalog(input?: {
      refresh?: boolean;
    }, options?: RuntimeCallOptions): Promise<unknown>;
  };
  files: {
    browse(input?: { path?: string | null }, options?: RuntimeCallOptions): Promise<unknown>;
    list(input: {
      root: string;
      file?: string;
    }, options?: RuntimeCallOptions): Promise<unknown>;
    upload(input: FormData, options?: RuntimeCallOptions): Promise<unknown>;
    attachment(input: {
      path: string;
      mimeType?: string;
    }, options?: RuntimeCallOptions): Promise<Blob>;
  };
  git: {
    execute(input: unknown, options?: RuntimeCallOptions): Promise<unknown>;
  };
  planning: {
    list(options?: RuntimeCallOptions): Promise<unknown>;
    promote(input: {
      runId: string;
      body: unknown;
    }, options?: RuntimeCallOptions): Promise<unknown>;
    review(input: {
      runId: string;
      body: unknown;
    }, options?: RuntimeCallOptions): Promise<unknown>;
  };
  settings: {
    load(options?: RuntimeCallOptions): Promise<unknown>;
    save(input: unknown, options?: RuntimeCallOptions): Promise<unknown>;
    projectMemory: {
      load(input: {
        projectPath: string;
        path?: string | null;
      }, options?: RuntimeCallOptions): Promise<unknown>;
      save(input: unknown, options?: RuntimeCallOptions): Promise<unknown>;
    };
    claudeGateway: {
      load(options?: RuntimeCallOptions): Promise<unknown>;
      execute(input: unknown, options?: RuntimeCallOptions): Promise<unknown>;
    };
  };
  accounts: {
    list(options?: RuntimeCallOptions): Promise<unknown>;
    create(input: unknown, options?: RuntimeCallOptions): Promise<unknown>;
    update(input: { accountId: string; body: unknown }, options?: RuntimeCallOptions): Promise<unknown>;
    remove(input: { accountId: string }, options?: RuntimeCallOptions): Promise<unknown>;
    refreshStatus(input: { accountId: string }, options?: RuntimeCallOptions): Promise<unknown>;
    codexStatus(options?: RuntimeCallOptions): Promise<unknown>;
  };
  notifications: {
    load(options?: RuntimeCallOptions): Promise<unknown>;
    subscribe(input: unknown, options?: RuntimeCallOptions): Promise<unknown>;
    unsubscribe(input: unknown, options?: RuntimeCallOptions): Promise<unknown>;
  };
  terminals: {
    create(input: unknown, options?: RuntimeCallOptions): Promise<unknown>;
    input(input: { terminalId: string; body: unknown }, options?: RuntimeCallOptions): Promise<unknown>;
    resize(input: { terminalId: string; body: unknown }, options?: RuntimeCallOptions): Promise<unknown>;
    close(input: { terminalId: string }, options?: RuntimeCallOptions): Promise<unknown>;
    openStream(input: {
      terminalId: string;
      lastEventId?: string | null;
    }, handlers: EventStreamHandlers): RuntimeSubscription;
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
