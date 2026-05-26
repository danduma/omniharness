import { createOmniHttpRegistry } from "@/runtime/http/registry";
import { handleAuthSessionRequest } from "./auth-session";
import { handleAuthLoginRequest } from "./auth-login";
import { handleAuthLogoutRequest } from "./auth-logout";
import { handleAuthPairRequest } from "./auth-pair";
import { handleAuthPairRedeemRequest } from "./auth-pair-redeem";
import { handleSettingsRequest } from "./settings";
import { handleAccountsRequest } from "./accounts";
import { handleAgentsRequest } from "./agents";
import { handleAgentsCatalogRequest } from "./agents-catalog";
import { handleAgentDetailRequest } from "./agent-detail";
import { handlePrewarmWorkerRequest } from "./prewarm-worker";
import { handleLlmModelsRequest } from "./llm-models";
import { handleCodexAuthStatusRequest } from "./codex-auth-status";
import { handleRuntimeBootstrapRequest } from "./runtime-bootstrap";
import { handleNotificationsRequest } from "./notifications";
import { handlePlansRequest } from "./plans";
import { handleProjectMemoryRequest } from "./project-memory";
import { handleAttachmentsRequest } from "./attachments";
import { handlePlanningPromoteRequest, handlePlanningReviewRequest } from "./planning";
import { handleBrowseFilesystemRequest, handleProjectFilesRequest } from "./filesystem";
import { handleGitRequest } from "./git";
import { handleMessagesRequest } from "./messages";
import { handleConversationsRequest } from "./conversations";
import {
  handleConversationMessagesRequest,
  handleQueuedConversationMessageRequest,
} from "./conversation-messages";
import { handleWorkerEntriesRequest } from "./worker-entries";
import { handleConversationTranscriptRequest } from "./conversation-transcript";
import { handleEventsLogRequest } from "./events-log";
import { handleEventsRequest } from "./events";
import { handleSupervisorRequest } from "./supervisor";
import { handleRunAnswerRequest } from "./run-answer";
import { handleRunResumeRequest } from "./run-resume";
import { handleRunDeleteRequest, handleRunPatchRequest, handleRunPostRequest } from "./runs";

export function createOmniRuntimeHttpRegistry() {
  return createOmniHttpRegistry()
    .route("GET", "/api/runtime/bootstrap", handleRuntimeBootstrapRequest)
    .route("GET", "/api/auth/session", handleAuthSessionRequest)
    .route("DELETE", "/api/auth/session", handleAuthSessionRequest)
    .route("POST", "/api/auth/login", handleAuthLoginRequest)
    .route("POST", "/api/auth/logout", handleAuthLogoutRequest)
    .route("GET", "/api/auth/pair", handleAuthPairRequest)
    .route("POST", "/api/auth/pair", handleAuthPairRequest)
    .route("POST", "/api/auth/pair/redeem", handleAuthPairRedeemRequest)
    .route("GET", "/api/settings", handleSettingsRequest)
    .route("POST", "/api/settings", handleSettingsRequest)
    .route("GET", "/api/accounts", handleAccountsRequest)
    .route("GET", "/api/agents", handleAgentsRequest)
    .route("GET", "/api/agents/:name", handleAgentDetailRequest)
    .route("GET", "/api/agents/catalog", handleAgentsCatalogRequest)
    .route("POST", "/api/agents/prewarm-worker", handlePrewarmWorkerRequest)
    .route("POST", "/api/llm-models", handleLlmModelsRequest)
    .route("GET", "/api/codex-auth/status", handleCodexAuthStatusRequest)
    .route("GET", "/api/notifications", handleNotificationsRequest)
    .route("POST", "/api/notifications", handleNotificationsRequest)
    .route("DELETE", "/api/notifications", handleNotificationsRequest)
    .route("GET", "/api/plans", handlePlansRequest)
    .route("GET", "/api/projects/memory", handleProjectMemoryRequest)
    .route("POST", "/api/projects/memory", handleProjectMemoryRequest)
    .route("GET", "/api/attachments", handleAttachmentsRequest)
    .route("POST", "/api/attachments", handleAttachmentsRequest)
    .route("POST", "/api/planning/:id/review", handlePlanningReviewRequest)
    .route("POST", "/api/planning/:id/promote", handlePlanningPromoteRequest)
    .route("GET", "/api/fs", handleBrowseFilesystemRequest)
    .route("GET", "/api/fs/files", handleProjectFilesRequest)
    .route("POST", "/api/git", handleGitRequest)
    .route("GET", "/api/messages", handleMessagesRequest)
    .route("POST", "/api/conversations", handleConversationsRequest)
    .route("POST", "/api/conversations/:id/messages", handleConversationMessagesRequest)
    .route("PATCH", "/api/conversations/:id/queued-messages/:messageId", handleQueuedConversationMessageRequest)
    .route("DELETE", "/api/conversations/:id/queued-messages/:messageId", handleQueuedConversationMessageRequest)
    .route("GET", "/api/workers/:workerId/entries", handleWorkerEntriesRequest)
    .route("GET", "/api/conversations/:id/transcript", handleConversationTranscriptRequest)
    .route("GET", "/api/events/log", handleEventsLogRequest)
    .route("GET", "/api/events", handleEventsRequest)
    .route("POST", "/api/supervisor", handleSupervisorRequest)
    .route("PATCH", "/api/runs/:id", handleRunPatchRequest)
    .route("POST", "/api/runs/:id", handleRunPostRequest)
    .route("DELETE", "/api/runs/:id", handleRunDeleteRequest)
    .route("POST", "/api/runs/:id/answer", handleRunAnswerRequest)
    .route("POST", "/api/runs/:id/resume", handleRunResumeRequest);
}

export { handleAuthSessionRequest } from "./auth-session";
export { handleAuthLoginRequest } from "./auth-login";
export { handleAuthLogoutRequest } from "./auth-logout";
export { handleAuthPairRequest } from "./auth-pair";
export { handleAuthPairRedeemRequest } from "./auth-pair-redeem";
export { handleSettingsRequest } from "./settings";
export { handleAccountsRequest } from "./accounts";
export { handleAgentsRequest } from "./agents";
export { handleAgentsCatalogRequest } from "./agents-catalog";
export { handleAgentDetailRequest } from "./agent-detail";
export { handlePrewarmWorkerRequest } from "./prewarm-worker";
export { handleLlmModelsRequest } from "./llm-models";
export { handleCodexAuthStatusRequest } from "./codex-auth-status";
export { handleRuntimeBootstrapRequest } from "./runtime-bootstrap";
export { handleNotificationsRequest } from "./notifications";
export { handlePlansRequest } from "./plans";
export { handleProjectMemoryRequest } from "./project-memory";
export { handleAttachmentsRequest } from "./attachments";
export { handlePlanningPromoteRequest, handlePlanningReviewRequest } from "./planning";
export { handleBrowseFilesystemRequest, handleProjectFilesRequest } from "./filesystem";
export { handleGitRequest } from "./git";
export { handleMessagesRequest } from "./messages";
export { handleConversationsRequest } from "./conversations";
export {
  handleConversationMessagesRequest,
  handleQueuedConversationMessageRequest,
} from "./conversation-messages";
export { handleWorkerEntriesRequest } from "./worker-entries";
export { handleEventsLogRequest } from "./events-log";
export { handleEventsRequest } from "./events";
export { handleSupervisorRequest } from "./supervisor";
export { handleRunAnswerRequest } from "./run-answer";
export { handleRunResumeRequest } from "./run-resume";
export { handleRunDeleteRequest, handleRunPatchRequest, handleRunPostRequest } from "./runs";
