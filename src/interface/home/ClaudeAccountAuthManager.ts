import { StateManager } from "@/lib/state-manager";

export type ClaudeAccountAuthPhase =
  | "idle"
  | "authenticating"
  | "verifying"
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted";

type AccountAuthOperation = {
  id: string;
  accountId: string;
  phase: Exclude<ClaudeAccountAuthPhase, "idle">;
  startedAt: string;
  deadlineAt: string;
  error: { code: string; message: string } | null;
  terminal: { id: string } | null;
};

type AccountAuthResponse = {
  account?: { id: string; status?: string | null };
  operation?: AccountAuthOperation | null;
};

export type ClaudeAccountAuthApi = {
  connectClaude(input: { label: string; email?: string | null; sso?: boolean }): Promise<unknown>;
  getAuthOperation(input: { accountId: string }): Promise<unknown>;
  actOnAuthOperation(input: { accountId: string; action: "retry" | "cancel" }): Promise<unknown>;
  logout(input: { accountId: string }): Promise<unknown>;
  remove(input: { accountId: string }): Promise<unknown>;
  purge(input: { accountId: string; confirmAccountId: string }): Promise<unknown>;
  refreshStatus(input: { accountId: string }): Promise<unknown>;
};

export type ClaudeAccountAuthState = {
  runnerScope: string | null;
  open: boolean;
  label: string;
  email: string;
  sso: boolean;
  accountId: string | null;
  operationId: string | null;
  phase: ClaudeAccountAuthPhase;
  terminalId: string | null;
  error: unknown;
  operationError: AccountAuthOperation["error"];
  pending: boolean;
  purgeAccountId: string | null;
  purgeConfirmation: string;
  removeAccountId: string | null;
};

const INITIAL_STATE: ClaudeAccountAuthState = {
  runnerScope: null,
  open: false,
  label: "",
  email: "",
  sso: false,
  accountId: null,
  operationId: null,
  phase: "idle",
  terminalId: null,
  error: null,
  operationError: null,
  pending: false,
  purgeAccountId: null,
  purgeConfirmation: "",
  removeAccountId: null,
};

function parseResponse(value: unknown): AccountAuthResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Claude account sign-in returned an invalid response.");
  }
  return value as AccountAuthResponse;
}

/**
 * Owns the entire Claude account sign-in draft and operation lifecycle.
 * Requests are fenced by both runner scope and monotonic request id so a
 * response from a runner the user has left can never attach its terminal.
 */
export class ClaudeAccountAuthManager extends StateManager<ClaudeAccountAuthState> {
  private requestId = 0;

  constructor(
    private readonly accounts: ClaudeAccountAuthApi,
    private readonly wait: (milliseconds: number) => Promise<void> = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ) {
    super(INITIAL_STATE);
  }

  configureScope(runnerScope: string) {
    if (this.getSnapshot().runnerScope === runnerScope) return;
    this.requestId += 1;
    this.update({ ...INITIAL_STATE, runnerScope });
  }

  patchDraft(patch: Partial<Pick<ClaudeAccountAuthState, "label" | "email" | "sso">>) {
    this.patch(patch);
  }

  openConnect() {
    this.patch({
      open: true,
      accountId: null,
      operationId: null,
      phase: "idle",
      terminalId: null,
      error: null,
      operationError: null,
    });
  }

  setOpen(open: boolean) {
    this.setKey("open", open);
  }

  async begin() {
    const state = this.getSnapshot();
    return this.runRequest(
      () => this.accounts.connectClaude({
        label: state.label.trim(),
        email: state.email.trim() || null,
        sso: state.sso,
      }),
      { open: true },
    );
  }

  async resume(accountId: string) {
    return this.runRequest(
      async () => {
        const current = parseResponse(await this.accounts.getAuthOperation({ accountId }));
        if (!current.operation && current.account?.status !== "available") {
          return this.accounts.actOnAuthOperation({ accountId, action: "retry" });
        }
        return current;
      },
      { open: true, accountId },
    );
  }

  async retry() {
    const accountId = this.getSnapshot().accountId;
    if (!accountId) return false;
    return this.runRequest(
      () => this.accounts.actOnAuthOperation({ accountId, action: "retry" }),
      { open: true, accountId },
    );
  }

  async cancel() {
    const accountId = this.getSnapshot().accountId;
    if (!accountId) return false;
    return this.runRequest(
      () => this.accounts.actOnAuthOperation({ accountId, action: "cancel" }),
      { accountId },
    );
  }

  async refreshAfterTerminalExit() {
    const accountId = this.getSnapshot().accountId;
    if (!accountId) return false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (attempt > 0) await this.wait(250);
      await this.resume(accountId);
      const phase = this.getSnapshot().phase;
      if (phase !== "authenticating" && phase !== "verifying") return true;
    }
    return false;
  }

  async logout(accountId: string) {
    return this.runRequest(() => this.accounts.logout({ accountId }), { accountId });
  }

  async refreshStatus(accountId: string) {
    return this.runPlainRequest(() => this.accounts.refreshStatus({ accountId }));
  }

  async remove(accountId: string) {
    return this.runPlainRequest(() => this.accounts.remove({ accountId }));
  }

  openRemove(accountId: string) {
    this.patch({ removeAccountId: accountId, error: null });
  }

  closeRemove() {
    this.patch({ removeAccountId: null, error: null });
  }

  async confirmRemove() {
    const accountId = this.getSnapshot().removeAccountId;
    if (!accountId) return false;
    const completed = await this.remove(accountId);
    if (completed) this.setKey("removeAccountId", null);
    return completed;
  }

  async purge(accountId: string, confirmAccountId: string) {
    return this.runPlainRequest(() => this.accounts.purge({ accountId, confirmAccountId }));
  }

  openPurge(accountId: string) {
    this.patch({ purgeAccountId: accountId, purgeConfirmation: "", error: null });
  }

  closePurge() {
    this.patch({ purgeAccountId: null, purgeConfirmation: "", error: null });
  }

  setPurgeConfirmation(value: string) {
    this.setKey("purgeConfirmation", value);
  }

  async confirmPurge() {
    const { purgeAccountId, purgeConfirmation } = this.getSnapshot();
    if (!purgeAccountId) return false;
    const completed = await this.purge(purgeAccountId, purgeConfirmation);
    if (completed) this.patch({ purgeAccountId: null, purgeConfirmation: "" });
    return completed;
  }

  private async runPlainRequest(request: () => Promise<unknown>) {
    const token = this.beginRequest();
    try {
      await request();
      if (!this.isCurrent(token)) return false;
      this.patch({ pending: false, error: null });
      return true;
    } catch (error) {
      if (!this.isCurrent(token)) return false;
      this.patch({ pending: false, error });
      return false;
    }
  }

  private async runRequest(request: () => Promise<unknown>, optimistic: Partial<ClaudeAccountAuthState>) {
    const token = this.beginRequest(optimistic);
    try {
      const response = parseResponse(await request());
      if (!this.isCurrent(token)) return false;
      const operation = response.operation ?? null;
      this.patch({
        open: optimistic.open ?? this.getSnapshot().open,
        accountId: response.account?.id ?? operation?.accountId ?? optimistic.accountId ?? this.getSnapshot().accountId,
        operationId: operation?.id ?? null,
        phase: operation?.phase ?? this.phaseFromAccountStatus(response.account?.status),
        terminalId: operation?.terminal?.id ?? null,
        operationError: operation?.error ?? null,
        error: null,
        pending: false,
      });
      return true;
    } catch (error) {
      if (!this.isCurrent(token)) return false;
      this.patch({ error, pending: false });
      return false;
    }
  }

  private phaseFromAccountStatus(status: string | null | undefined): ClaudeAccountAuthPhase {
    if (status === "available") return "completed";
    if (status === "authenticating" || status === "verifying" || status === "login_required") {
      return status === "login_required" ? "cancelled" : status;
    }
    return this.getSnapshot().phase;
  }

  private beginRequest(optimistic: Partial<ClaudeAccountAuthState> = {}) {
    const token = { id: ++this.requestId, scope: this.getSnapshot().runnerScope };
    this.patch({ ...optimistic, pending: true, error: null });
    return token;
  }

  private isCurrent(token: { id: number; scope: string | null }) {
    return token.id === this.requestId && token.scope === this.getSnapshot().runnerScope;
  }
}
