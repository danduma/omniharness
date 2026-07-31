import { StateManager } from "@/lib/state-manager";
import type {
  RunnerConnectionSnapshot,
  RunnerConnectionStatus,
} from "./RunnerConnection";

export type RunnerUiDialog =
  | "closed"
  | "add"
  | "edit"
  | "forget"
  | "sessions"
  | "rename"
  | "tls"
  | "identity";

export type RunnerUiSnapshot = {
  dialog: RunnerUiDialog;
  profileId: string | null;
  label: string;
  baseUrl: string;
  password: string;
  fingerprint: string | null;
  expectedIdentity: string | null;
  observedIdentity: string | null;
  returnFocusId: string | null;
  busy: boolean;
  errorCode: string | null;
  sessions: Array<{
    id: string;
    label?: string | null;
    clientKind?: string | null;
    lastSeenAt?: string | null;
    expiresAt?: string | null;
    current?: boolean;
  }>;
};

const initialSnapshot: RunnerUiSnapshot = {
  dialog: "closed",
  profileId: null,
  label: "",
  baseUrl: "",
  password: "",
  fingerprint: null,
  expectedIdentity: null,
  observedIdentity: null,
  returnFocusId: null,
  busy: false,
  errorCode: null,
  sessions: [],
};

export function runnerStatusMessageKey(status: RunnerConnectionStatus) {
  return ({
    connecting: "runner.status.connecting",
    online: "runner.status.online",
    offline: "runner.status.offline",
    deferred: "runner.status.deferred",
    "needs-reauth": "runner.status.needsReauth",
    "tls-untrusted": "runner.status.tlsUntrusted",
    "identity-mismatch": "runner.status.identityMismatch",
    incompatible: "runner.status.incompatible",
    resync: "runner.status.resync",
    degraded: "runner.status.degraded",
    "runner-stopping": "runner.status.stopping",
  } satisfies Record<RunnerConnectionStatus, string>)[status];
}

export function countRunnerActivity(
  snapshot: RunnerConnectionSnapshot["snapshot"],
) {
  const runs = Array.isArray(snapshot?.runs)
    ? snapshot.runs as Array<{ status?: unknown }>
    : [];
  return runs.reduce((counts, run) => {
    const status = typeof run.status === "string"
      ? run.status.trim().toLowerCase()
      : "";
    if (status === "awaiting_user" || status === "needs_input") {
      counts.needsInput += 1;
    } else if (
      status === "running"
      || status === "planning"
      || status === "implementation"
    ) {
      counts.running += 1;
    }
    return counts;
  }, { needsInput: 0, running: 0 });
}

export class RunnerUiManager extends StateManager<RunnerUiSnapshot> {
  private readonly focusElement: (id: string) => void;

  constructor(options: {
    focusElement?: (id: string) => void;
  } = {}) {
    super(initialSnapshot);
    this.focusElement = options.focusElement ?? ((id) => {
      if (typeof document !== "undefined") {
        document.getElementById(id)?.focus();
      }
    });
  }

  openAdd(returnFocusId: string) {
    this.update({ ...initialSnapshot, dialog: "add", returnFocusId });
  }

  openEdit(
    profile: {
      id: string;
      label: string;
      baseUrl: string;
      savedPassword?: string | null;
    },
    returnFocusId: string,
  ) {
    this.update({
      ...initialSnapshot,
      dialog: "edit",
      profileId: profile.id,
      label: profile.label,
      baseUrl: profile.baseUrl,
      password: profile.savedPassword ?? "",
      returnFocusId,
    });
  }

  openForget(profileId: string, returnFocusId: string) {
    this.openProfileDialog("forget", profileId, returnFocusId);
  }

  openSessions(profileId: string, returnFocusId: string) {
    this.openProfileDialog("sessions", profileId, returnFocusId);
  }

  openRename(
    profileId: string,
    runnerName: string,
    returnFocusId: string,
  ) {
    this.update({
      ...initialSnapshot,
      dialog: "rename",
      profileId,
      label: runnerName,
      returnFocusId,
    });
  }

  openTlsConfirmation(
    profileId: string,
    fingerprint: string,
    returnFocusId: string,
  ) {
    this.update({
      ...initialSnapshot,
      dialog: "tls",
      profileId,
      fingerprint,
      returnFocusId,
    });
  }

  openIdentityMismatch(
    profileId: string,
    expectedIdentity: string,
    observedIdentity: string,
    returnFocusId: string,
  ) {
    this.update({
      ...initialSnapshot,
      dialog: "identity",
      profileId,
      expectedIdentity,
      observedIdentity,
      returnFocusId,
    });
  }

  setDraft(patch: { label?: string; baseUrl?: string; password?: string }) {
    this.patch(patch);
  }

  setBusy(busy: boolean) {
    this.patch({ busy, ...(busy ? { errorCode: null } : {}) });
  }

  setError(errorCode: string) {
    this.patch({ busy: false, errorCode });
  }

  setSessions(sessions: RunnerUiSnapshot["sessions"]) {
    this.patch({ sessions, busy: false, errorCode: null });
  }

  close() {
    const returnFocusId = this.getSnapshot().returnFocusId;
    this.update(initialSnapshot);
    if (returnFocusId) {
      queueMicrotask(() => this.focusElement(returnFocusId));
    }
  }

  private openProfileDialog(
    dialog: RunnerUiDialog,
    profileId: string,
    returnFocusId: string,
  ) {
    this.update({
      ...initialSnapshot,
      dialog,
      profileId,
      returnFocusId,
    });
  }
}

export const runnerUiManager = new RunnerUiManager();
