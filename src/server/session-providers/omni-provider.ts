import { createConversation } from "@/server/conversations/create";
import { sendConversationMessage } from "@/server/conversations/send-message";
import { getDefaultCapabilities } from "./capabilities";
import type {
  CreateSessionInput,
  CreateSessionResult,
  ProviderSessionRecord,
  SendSessionInput,
  SendSessionInputResult,
  SessionProvider,
  StopSessionInput,
  StopSessionResult,
} from "./types";

export const omniSessionProvider: SessionProvider = {
  type: "omni",

  create(input: CreateSessionInput): Promise<CreateSessionResult> {
    return createConversation({
      mode: input.mode,
      command: input.command,
      projectPath: input.projectPath,
      gitWorkspaceTarget: input.gitWorkspaceTarget as never,
      gitWorkspaceLaunch: input.gitWorkspaceLaunch as never,
      preferredWorkerType: input.preferredWorkerType,
      preferredWorkerModel: input.preferredWorkerModel,
      preferredWorkerEffort: input.preferredWorkerEffort,
      allowedWorkerTypes: input.allowedWorkerTypes,
      requestedRunId: input.requestedRunId,
      attachments: input.attachments,
      externalClaudeSessionId: input.externalClaudeSessionId,
    });
  },

  sendInput(input: SendSessionInput): Promise<SendSessionInputResult> {
    return sendConversationMessage(input) as Promise<SendSessionInputResult>;
  },

  async stop(_input: StopSessionInput): Promise<StopSessionResult> {
    throw Object.assign(new Error("Omni stop actions are handled by run action routes."), { status: 400 });
  },

  getCapabilities(session: ProviderSessionRecord) {
    return getDefaultCapabilities({ ...session, sessionType: "omni" });
  },

  serialize(session: ProviderSessionRecord) {
    return {
      id: session.runId,
      runId: session.runId,
      sessionType: "omni",
      status: session.status,
      capabilities: this.getCapabilities(session),
      primaryActorId: session.primaryActorId ?? null,
      title: session.title ?? null,
      projectPath: session.projectPath ?? null,
      providerMetadata: session.providerMetadata ?? null,
    };
  },
};
