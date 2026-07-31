import type { OmniHttpHandler } from "@/runtime/http/registry";
import {
  handleAccountsRequest,
  handleAgentDetailRequest,
  handleAgentsCatalogRequest,
  handleAttachmentsRequest,
  handleAuthLoginRequest,
  handleAuthLogoutRequest,
  handleAuthPairRedeemRequest,
  handleAuthPairRequest,
  handleBrowserAuthorizationApproveRequest,
  handleBrowserAuthorizationExchangeRequest,
  handleAuthStreamTicketRequest,
  handleAuthSessionRequest,
  handleBrowseFilesystemRequest,
  handleClaudeModelGatewayRequest,
  handleCodexAuthStatusRequest,
  handleConversationMessagesRequest,
  handleConversationTranscriptRequest,
  handleConversationsRequest,
  handleEventsLogRequest,
  handleEventsRequest,
  handleGitRequest,
  handleLlmModelsRequest,
  handleMessagesRequest,
  handleNotificationsRequest,
  handlePlanningPromoteRequest,
  handlePlanningReviewRequest,
  handlePlansRequest,
  handleProjectFilesRequest,
  handleProjectMemoryRequest,
  handleQueuedConversationMessageInterruptNextRequest,
  handleQueuedConversationMessageInterruptRequest,
  handleQueuedConversationMessageRequest,
  handleRunAnswerRequest,
  handleRunDeleteRequest,
  handleRunPatchRequest,
  handleRunPostRequest,
  handleRunResumeRequest,
  handleRuntimeBootstrapRequest,
  handleRunnerRekeyRequest,
  handleRunnerSettingsRequest,
  handleSettingsRequest,
  handleSupervisorRequest,
  handleWorkerEntriesRequest,
} from "@/runtime/http/routes";

type LegacyRouteContext = {
  params?: Promise<Record<string, string>> | Record<string, string>;
};

function testRoute(handler: OmniHttpHandler) {
  return async (request: Request, context: LegacyRouteContext = {}) => {
    const params = context.params ? await context.params : {};
    return handler(request, { surface: "test", params });
  };
}

export const agentDetailRoute = testRoute(handleAgentDetailRequest);
export const agentsCatalogRoute = testRoute(handleAgentsCatalogRequest);
export const attachmentsGetRoute = testRoute(handleAttachmentsRequest);
export const attachmentsPostRoute = testRoute(handleAttachmentsRequest);
export const authLoginRoute = testRoute(handleAuthLoginRequest);
export const authLogoutRoute = testRoute(handleAuthLogoutRequest);
export const authPairCreateRoute = testRoute(handleAuthPairRequest);
export const authPairRedeemRoute = testRoute(handleAuthPairRedeemRequest);
export const authPairStatusRoute = testRoute(handleAuthPairRequest);
export const browserAuthorizationApproveRoute = testRoute(
  handleBrowserAuthorizationApproveRequest,
);
export const browserAuthorizationExchangeRoute = testRoute(
  handleBrowserAuthorizationExchangeRequest,
);
export const authStreamTicketRoute = testRoute(handleAuthStreamTicketRequest);
export const authSessionDeleteRoute = testRoute(handleAuthSessionRequest);
export const authSessionGetRoute = testRoute(handleAuthSessionRequest);
export const claudeModelGatewayRoute = testRoute(handleClaudeModelGatewayRequest);
export const codexAuthStatusRoute = testRoute(handleCodexAuthStatusRequest);
export const conversationMessagesRoute = testRoute(handleConversationMessagesRequest);
export const conversationTranscriptRoute = testRoute(handleConversationTranscriptRequest);
export const conversationsRoute = testRoute(handleConversationsRequest);
export const eventsLogRoute = testRoute(handleEventsLogRequest);
export const eventsRoute = testRoute(handleEventsRequest);
export const gitRoute = testRoute(handleGitRequest);
export const llmModelsRoute = testRoute(handleLlmModelsRequest);
export const notificationsDeleteRoute = testRoute(handleNotificationsRequest);
export const notificationsGetRoute = testRoute(handleNotificationsRequest);
export const notificationsPostRoute = testRoute(handleNotificationsRequest);
export const planningPromoteRoute = testRoute(handlePlanningPromoteRequest);
export const planningReviewRoute = testRoute(handlePlanningReviewRequest);
export const queuedMessageInterruptNextRoute = testRoute(
  handleQueuedConversationMessageInterruptNextRequest,
);
export const queuedMessageInterruptRoute = testRoute(
  handleQueuedConversationMessageInterruptRequest,
);
export const queuedMessageSendNowRoute = testRoute(handleQueuedConversationMessageRequest);
export const readAccountsRoute = testRoute(handleAccountsRequest);
export const readFilesystemRoute = testRoute(handleBrowseFilesystemRequest);
export const readMessagesRoute = testRoute(handleMessagesRequest);
export const readPlansRoute = testRoute(handlePlansRequest);
export const readProjectFilesRoute = testRoute(handleProjectFilesRequest);
export const readProjectMemoryRoute = testRoute(handleProjectMemoryRequest);
export const runAnswerRoute = testRoute(handleRunAnswerRequest);
export const runDeleteRoute = testRoute(handleRunDeleteRequest);
export const runPatchRoute = testRoute(handleRunPatchRequest);
export const runPostRoute = testRoute(handleRunPostRequest);
export const runResumeRoute = testRoute(handleRunResumeRequest);
export const runtimeBootstrapRoute = testRoute(handleRuntimeBootstrapRequest);
export const runnerRekeyRoute = testRoute(handleRunnerRekeyRequest);
export const runnerSettingsRoute = testRoute(handleRunnerSettingsRequest);
export const settingsGetRoute = testRoute(handleSettingsRequest);
export const settingsPostRoute = testRoute(handleSettingsRequest);
export const supervisorRoute = testRoute(handleSupervisorRequest);
export const updateProjectMemoryRoute = testRoute(handleProjectMemoryRequest);
export const workerEntriesRoute = testRoute(handleWorkerEntriesRequest);

export const eventsRouteModule = { GET: eventsRoute };
export const conversationsRouteModule = { POST: conversationsRoute };
export const conversationMessagesRouteModule = { POST: conversationMessagesRoute };
export const planningReviewRouteModule = { POST: planningReviewRoute };
export const runRouteModule = {
  PATCH: runPatchRoute,
  POST: runPostRoute,
  DELETE: runDeleteRoute,
};
export const claudeModelGatewayRouteModule = {
  GET: claudeModelGatewayRoute,
  POST: claudeModelGatewayRoute,
  OPTIONS: claudeModelGatewayRoute,
};
