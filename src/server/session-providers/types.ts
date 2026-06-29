import type { ChatAttachment } from "@/lib/chat-attachments";
import type { BusyMessageAction } from "@/app/home/busy-message-behavior";

export type SessionType = "omni" | "process";

export type SessionCapability =
  | "send_input"
  | "stop"
  | "retry_from_message"
  | "edit_message"
  | "fork_session"
  | "fork_message"
  | "queue_input"
  | "approve_permission"
  | "open_project_file"
  | "use_git_workspace";

export type SessionStatus =
  | "starting"
  | "running"
  | "working"
  | "awaiting_user"
  | "done"
  | "exited"
  | "cancelled"
  | "failed"
  | "orphaned"
  | "needs_recovery";

export type SessionRecord = {
  id: string;
  runId: string;
  sessionType: SessionType;
  status: string;
  capabilities: SessionCapability[];
  primaryActorId: string | null;
  title: string | null;
  projectPath: string | null;
  providerMetadata?: Record<string, unknown> | null;
};

export type ProviderSessionRecord = {
  runId: string;
  sessionType: SessionType;
  mode?: string | null;
  status: string;
  projectPath?: string | null;
  title?: string | null;
  primaryActorId?: string | null;
  providerMetadata?: Record<string, unknown> | null;
};

export type CreateSessionInput = {
  sessionType?: SessionType;
  command: string;
  projectPath?: string | null;
  mode?: unknown;
  gitWorkspaceTarget?: unknown;
  gitWorkspaceLaunch?: unknown;
  preferredWorkerType?: string | null;
  preferredWorkerModel?: string | null;
  preferredWorkerEffort?: string | null;
  preferredWorkerAccountId?: string | null;
  allowedWorkerTypes?: string[] | string | null;
  requestedRunId?: string | null;
  attachments?: ChatAttachment[];
  externalClaudeSessionId?: string | null;
  process?: {
    argv?: string[];
    command?: string;
    cwd?: string | null;
    envPolicy?: "minimal" | "inherit_safe";
  } | null;
};

export type CreateSessionResult = Record<string, unknown> & {
  runId?: string;
};

export type SendSessionInput = {
  runId: string;
  content: string;
  attachments?: ChatAttachment[];
  busyAction?: BusyMessageAction | null;
};

export type SendSessionInputResult = Record<string, unknown> & {
  ok: true;
};

export type StopSessionInput = {
  runId: string;
  reason?: string;
};

export type StopSessionResult = {
  ok: true;
  runId: string;
  alreadyStopped?: boolean;
  status?: string;
};

export type DeleteSessionInput = {
  runId: string;
};

export type DeleteSessionResult = {
  ok: true;
  runId: string;
};

export interface SessionProvider {
  readonly type: SessionType;
  create(input: CreateSessionInput): Promise<CreateSessionResult>;
  sendInput(input: SendSessionInput): Promise<SendSessionInputResult>;
  stop(input: StopSessionInput): Promise<StopSessionResult>;
  delete?(input: DeleteSessionInput): Promise<DeleteSessionResult>;
  getCapabilities(session: ProviderSessionRecord): SessionCapability[];
  serialize(session: ProviderSessionRecord): SessionRecord;
}
