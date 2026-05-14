import type React from "react";
import dynamic from "next/dynamic";
import { useEffect, useMemo } from "react";
import { ArrowDown, Blocks, ChevronDown, CirclePlay, CircleStop, FolderGit2, GitBranch, Pencil, RotateCcw, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownContent } from "@/components/MarkdownContent";
import type { TerminalUserMessage } from "@/components/Terminal";
import { PlanningArtifactsPanel } from "@/components/PlanningArtifactsPanel";
import { conversationMainManager } from "@/components/component-state-managers";
import { type AppErrorDescriptor, appErrorKey } from "@/lib/app-errors";
import { extractLatestPlainTextTurn } from "@/lib/agent-output";
import { shouldShowPlanningTerminalActivity } from "@/lib/planning-output";
import type { AgentSnapshot, ExecutionEventRecord, MessageRecord, NoticeDescriptor, RunRecord, PlanningReviewRunRecord, PlanningReviewRoundRecord, PlanningReviewFindingRecord } from "@/app/home/types";
import type { RecoveryIncidentRecord, RunRecoveryState } from "@/app/home/types";
import { formatExecutionTimestamp, getExecutionEventDetailRows, summarizeExecutionEvent, type ConversationTimelineItem } from "@/app/home/utils";
import { cn } from "@/lib/utils";
import { shallowEqualRecord, useManagerSelector, useManagerSnapshot } from "@/lib/use-manager-snapshot";
import type { ProjectFileReference } from "@/lib/project-file-links";
import { gitWorkspaceManager, type GitWorkspaceLaunchRequest } from "@/app/home/GitWorkspaceManager";
import { type PlanningReviewAgentSelection } from "@/server/planning/review-preferences";
import { ErrorNotice } from "./ErrorNotice";
import { RecoveryIncidentInspector } from "./RecoveryIncidentInspector";
import { RunRecoveryNotice } from "./RunRecoveryNotice";
import { UserInputMessage, type UserInputMessageAction } from "./UserInputMessage";
import { t, useI18nSnapshot } from "@/lib/i18n";

const Terminal = dynamic(
  () => import("@/components/Terminal").then((m) => m.Terminal),
  { ssr: false },
);

function slugBranchName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "workspace";
}

function suggestCheckoutPath(repoRoot: string | undefined, branchName: string) {
  if (!repoRoot) {
    return "";
  }
  const pieces = repoRoot.split("/");
  const repoName = pieces.pop() || "repo";
  const parent = pieces.join("/") || "/";
  return `${parent}/${repoName}-${slugBranchName(branchName).replace(/\//g, "-")}`;
}

interface ConversationExecutionStatusProps {
  liveExecutionStatus: { label: string; detail: string; tone: "error" | "warning" | "muted" | "active" };
  liveThoughts: Array<{ agentName: string; text: string; snippet: string; isLive: boolean }>;
}

function ConversationExecutionPanel({
  runId,
  liveExecutionStatus,
  liveThoughts,
  executionEvents,
}: ConversationExecutionStatusProps & {
  runId: string | null;
  executionEvents: ExecutionEventRecord[];
}) {
  const { runLogOpenByRunId } = useManagerSnapshot(conversationMainManager);
  const liveThoughtText = liveThoughts[0]?.snippet?.trim() ?? "";
  const statusText = liveExecutionStatus.detail || liveThoughtText;
  const open = Boolean(runId && runLogOpenByRunId[runId]);

  return (
    <Collapsible
      open={open}
      onOpenChange={(nextOpen) => {
        if (runId) {
          conversationMainManager.setRunLogOpen(runId, nextOpen);
        }
      }}
    >
      <div className="omni-run-status rounded-lg text-sm" aria-label="Run Log">
        <CollapsibleTrigger className="group flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left">
          <span
            className={cn(
              "shrink-0 text-xs font-semibold tracking-wide",
              liveExecutionStatus.tone === "error"
                ? "text-destructive"
                : liveExecutionStatus.tone === "warning"
                  ? "text-amber-600 dark:text-amber-300"
                  : liveExecutionStatus.tone === "muted"
                    ? "text-muted-foreground"
                    : "omni-run-status-label",
            )}
          >
            {liveExecutionStatus.label}
          </span>
          {liveExecutionStatus.tone !== "muted" ? (
            <div className="flex shrink-0 items-center gap-1" aria-hidden={liveExecutionStatus.tone !== "active"}>
              {[0, 1, 2].map((index) => (
                <span
                  key={index}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    liveExecutionStatus.tone === "error"
                      ? "bg-destructive/70"
                      : liveExecutionStatus.tone === "warning"
                        ? "bg-amber-500/80"
                        : "bg-muted-foreground/80 animate-pulse",
                  )}
                  style={{ animationDelay: `${index * 180}ms` }}
                />
              ))}
            </div>
          ) : null}
          {statusText ? (
            <span className="min-w-0 flex-1 truncate text-xs leading-5 text-muted-foreground">{statusText}</span>
          ) : <span className="min-w-0 flex-1" />}
          {executionEvents.length > 0 ? (
            <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {executionEvents.length}
            </span>
          ) : null}
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border/35 px-3 py-2">
            {liveThoughts.length > 0 ? (
              <div className="space-y-2 pb-2">
                {liveThoughts.map((thought) => (
                  <div key={`${thought.agentName}:${thought.text}`} className="rounded-md bg-background/55 p-2">
                    <p className="break-words text-xs font-medium text-foreground">{thought.agentName}</p>
                    <p className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-muted-foreground">
                      {thought.text}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
            {executionEvents.length > 0 ? (
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {executionEvents.map((event) => {
                  const detailRows = getExecutionEventDetailRows(event);
                  return (
                    <div key={event.id} className="rounded-md bg-background/55 p-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-xs font-medium text-foreground">{event.eventType}</p>
                          <p className="mt-0.5 break-words text-[11px] leading-relaxed text-muted-foreground">
                            {summarizeExecutionEvent(event)}
                          </p>
                        </div>
                        <span className="shrink-0 text-[10px] text-muted-foreground/60">
                          {formatExecutionTimestamp(event.createdAt)}
                        </span>
                      </div>
                      {detailRows.length > 0 ? (
                        <dl className="mt-2 grid gap-1.5 text-[10px] leading-relaxed text-muted-foreground">
                          {detailRows.map((row) => (
                            <div key={row.key} className="grid gap-0.5 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-2">
                              <dt className="font-medium text-muted-foreground/80">{row.label}</dt>
                              <dd className={cn(
                                "min-w-0 break-words",
                                row.multiline && "max-h-24 overflow-auto whitespace-pre-wrap rounded bg-muted/35 px-1.5 py-1",
                              )}>
                                {row.value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function DirectControlTerminalColumn({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[min(82ch,100%)]">
      {children}
    </div>
  );
}

function inferWorkerIdFromMessage(message: MessageRecord) {
  if (message.workerId?.trim()) {
    return message.workerId.trim();
  }

  const promptedMatch = message.content.match(/^Prompted\s+([^\s:]+):/);
  return promptedMatch?.[1] ?? null;
}

function renderSupervisorActivityText(text: string) {
  const match = text.match(/^(Starting (?:worker \d+|planning agent)|Steering worker \d+)([\s\S]*)$/);
  if (!match) {
    return text;
  }

  return (
    <>
      <strong className="font-semibold text-foreground">{match[1]}</strong>
      {match[2]}
    </>
  );
}

function renderSupervisorActivityIcon(item: Extract<ConversationTimelineItem, { type: "activity" }>) {
  const eventType = item.event?.eventType;
  const text = item.text.trim();

  if (eventType === "worker_spawned" || item.id.startsWith("worker-start:") || text.startsWith("Starting worker ") || text.startsWith("Starting planning agent")) {
    return <CirclePlay className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.8} />;
  }

  if (
    eventType === "worker_cancelled"
    || eventType === "worker_stopped"
    || eventType === "worker_stop_requested"
    || text.startsWith("Cancelled worker ")
    || text.startsWith("Stopped worker ")
    || text.startsWith("Stopping worker ")
  ) {
    return <CircleStop className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.8} />;
  }

  if (
    eventType === "worker_prompt_deferred"
    || text.startsWith("Steering worker ")
    || text.startsWith("Waiting to steer worker ")
  ) {
    return <Route className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.8} />;
  }

  return null;
}

function SupervisorActivityMessage({ item }: { item: Extract<ConversationTimelineItem, { type: "activity" }> }) {
  const icon = renderSupervisorActivityIcon(item);

  return (
    <div className="group ml-6 flex w-[calc(100%-1.5rem)] px-1 py-0.5 text-sm" aria-label="Supervisor action">
      <div className="omni-activity-icon mt-[0.18em] flex h-3.5 w-6 shrink-0 items-center justify-center pr-1">
        {icon}
      </div>
      <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
        <p className="omni-activity-text min-w-0 whitespace-pre-wrap break-words text-[13px] leading-[1.45]">
          {renderSupervisorActivityText(item.text)}
        </p>
        <span className="shrink-0 pt-[0.18em] text-[10px] text-muted-foreground/50">
          {formatExecutionTimestamp(item.createdAt)}
        </span>
      </div>
    </div>
  );
}

function WorkerOutputMessage({
  message,
  agent,
  projectRoot,
  onOpenProjectFile,
}: {
  message: MessageRecord;
  agent: AgentSnapshot | null;
  projectRoot?: string | null;
  onOpenProjectFile?: (file: ProjectFileReference) => void;
}) {
  const { fullOutputOpenByMessageId } = useManagerSnapshot(conversationMainManager);
  const fullOutputOpen = Boolean(fullOutputOpenByMessageId[message.id]);
  const inferredWorkerId = inferWorkerIdFromMessage(message);
  const summaryText = extractLatestPlainTextTurn({
    outputEntries: agent?.outputEntries,
    currentText: agent?.currentText,
    lastText: agent?.lastText || message.content,
  }) || message.content.trim();
  const fullOutputAgent = agent ?? {
    name: inferredWorkerId ?? "worker",
    state: "done",
    currentText: "",
    lastText: message.content,
  };

  return (
    <Collapsible open={fullOutputOpen} onOpenChange={(open) => conversationMainManager.setFullOutputOpen(message.id, open)}>
      <div className="omni-worker-output overflow-hidden rounded-lg">
        <div className="space-y-3 p-4">
          <MarkdownContent
            content={summaryText}
            className="text-foreground"
            projectRoot={projectRoot}
            onOpenProjectFile={onOpenProjectFile}
          />
          <CollapsibleTrigger
            className="omni-worker-output-toggle inline-flex items-center gap-1.5 rounded-md text-xs font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={fullOutputOpen ? "Hide full worker output" : "Show full worker output"}
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", fullOutputOpen && "rotate-180")} />
            {fullOutputOpen ? "Hide full output" : "Show full output"}
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="border-t border-border/35 bg-muted/20 p-2 dark:bg-background/70">
            <Terminal
              agent={fullOutputAgent}
              className="h-72"
              projectRoot={projectRoot}
              onOpenProjectFile={onOpenProjectFile}
            />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function PlannerOutputMessage({
  message,
  agent,
  projectRoot,
  onOpenProjectFile,
}: {
  message: MessageRecord;
  agent: AgentSnapshot | null;
  projectRoot?: string | null;
  onOpenProjectFile?: (file: ProjectFileReference) => void;
}) {
  const terminalAgent = agent ?? {
    name: inferWorkerIdFromMessage(message) ?? "planning-agent",
    state: "done",
    currentText: "",
    lastText: message.content,
  };

  return (
    <Terminal
      agent={terminalAgent}
      variant="native"
      textSizeScope="conversation"
      showTextSizeControl={false}
      activityFilter={shouldShowPlanningTerminalActivity}
      thoughtsDefaultOpen
      emptyState={null}
      projectRoot={projectRoot}
      onOpenProjectFile={onOpenProjectFile}
    />
  );
}

interface ConversationMainProps {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  selectedRunId: string | null;
  selectedRun: RunRecord | null;
  welcomeRepoName: string;
  isDirectConversation: boolean;
  isPlanningConversation: boolean;
  isImplementationConversation: boolean;
  appErrors: AppErrorDescriptor[];
  conversationFailure: NoticeDescriptor | null;
  directConversationMessages: TerminalUserMessage[];
  expandedDirectMessageIds: Set<string>;
  toggleDirectMessageExpansion: (messageId: string) => void;
  primaryConversationAgent: AgentSnapshot | null;
  promotePlanningConversation: {
    isPending: boolean;
    mutate: (payload: { runId: string; planPath: string | null }) => void;
  };
  onStartReview?: (prefs: { agentSelection: PlanningReviewAgentSelection; rounds: number }) => void;
  reviewRuns?: PlanningReviewRunRecord[];
  reviewRounds?: PlanningReviewRoundRecord[];
  reviewFindings?: PlanningReviewFindingRecord[];
  conversationTimelineItems: ConversationTimelineItem[];
  recoverRun: { isPending: boolean };
  recoveryState: RunRecoveryState | null;
  recoveryIncidents: RecoveryIncidentRecord[];
  resumeRunRecovery: { isPending: boolean };
  showRecoverableRunningState: boolean;
  hasStuckWorker: boolean;
  latestUserCheckpoint: MessageRecord | null;
  handleRetryMessage: (messageId: string) => void;
  handleResumeRunRecovery: () => void;
  handleStartEditingMessage: (message: Pick<MessageRecord, "id" | "content">) => void;
  handleForkMessage: (message: Pick<MessageRecord, "id" | "content">) => void;
  handleForkMessageIntoWorktree: (message: Pick<MessageRecord, "id" | "content">) => void;
  handleConfirmForkMessageIntoWorktree: (request: GitWorkspaceLaunchRequest & {
    runId: string;
    targetMessageId: string;
    content: string;
  }) => void;
  editingMessageId: string | null;
  editingMessageValue: string;
  setEditingMessageValue: (value: string) => void;
  handleCancelEditingMessage: () => void;
  handleSaveEditedMessage: (messageId: string) => void;
  conversationAgents: AgentSnapshot[];
  showDirectControlWorkingIndicator: boolean;
  showConversationExecution: boolean;
  liveExecutionStatus: ConversationExecutionStatusProps["liveExecutionStatus"];
  liveThoughts: ConversationExecutionStatusProps["liveThoughts"];
  executionEvents: ExecutionEventRecord[];
  emptyComposer: React.ReactNode;
  projectRoot?: string | null;
  onOpenProjectFile?: (file: ProjectFileReference) => void;
}

function LatestRecoveryAction({
  selectedRun,
  canRetryConversation,
  recoverRun,
  showRecoverableRunningState,
  hasStuckWorker,
  latestUserCheckpoint,
  handleRetryMessage,
}: {
  selectedRun: RunRecord | null;
  canRetryConversation: boolean;
  recoverRun: { isPending: boolean };
  showRecoverableRunningState: boolean;
  hasStuckWorker: boolean;
  latestUserCheckpoint: MessageRecord | null;
  handleRetryMessage: (messageId: string) => void;
}) {
  if (!canRetryConversation || !latestUserCheckpoint) {
    return null;
  }

  const canRecover = selectedRun?.status === "failed" || showRecoverableRunningState || hasStuckWorker;
  if (!canRecover) {
    return null;
  }

  return (
    <div className="flex justify-start">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleRetryMessage(latestUserCheckpoint.id)}
        disabled={recoverRun.isPending}
      >
        <RotateCcw className="mr-2 h-4 w-4" /> {selectedRun?.status === "failed" ? "Resume worker" : "Unstick latest"}
      </Button>
    </div>
  );
}

export function ConversationMain({
  scrollRef,
  selectedRunId,
  selectedRun,
  welcomeRepoName,
  isDirectConversation,
  isPlanningConversation,
  isImplementationConversation,
  appErrors,
  conversationFailure,
  directConversationMessages,
  expandedDirectMessageIds,
  toggleDirectMessageExpansion,
  primaryConversationAgent,
  promotePlanningConversation,
  onStartReview,
  reviewRuns = [],
  reviewRounds = [],
  reviewFindings = [],
  conversationTimelineItems,
  recoverRun,
  recoveryState,
  recoveryIncidents,
  resumeRunRecovery,
  showRecoverableRunningState,
  hasStuckWorker,
  latestUserCheckpoint,
  handleRetryMessage,
  handleResumeRunRecovery,
  handleStartEditingMessage,
  handleForkMessage,
  handleForkMessageIntoWorktree,
  handleConfirmForkMessageIntoWorktree,
  editingMessageId,
  editingMessageValue,
  setEditingMessageValue,
  handleCancelEditingMessage,
  handleSaveEditedMessage,
  conversationAgents,
  showDirectControlWorkingIndicator,
  showConversationExecution,
  liveExecutionStatus,
  liveThoughts,
  executionEvents,
  emptyComposer,
  projectRoot,
  onOpenProjectFile,
}: ConversationMainProps) {
  useI18nSnapshot();
  const { hasOutputBelow } = useManagerSnapshot(conversationMainManager);
  const forkWorkspaceSelector = useMemo(() => {
    return (state: ReturnType<typeof gitWorkspaceManager.getSnapshot>) => {
      const dialog = state.activeDialog?.kind === "fork_message_worktree" || state.activeDialog?.kind === "fork_session_worktree"
        ? state.activeDialog
        : null;
      const projectPath = dialog?.projectPath ?? null;
      return {
        dialog,
        snapshot: projectPath ? state.snapshotsByProject[projectPath] : undefined,
        loading: projectPath ? Boolean(state.loadingByProject[projectPath]) : false,
        pendingOperation: state.pendingOperation,
        dialogDraft: state.dialogDraft,
        lastError: state.lastError,
      };
    };
  }, []);
  const { dialog: forkWorkspaceDialog, snapshot: forkWorkspaceSnapshot, loading: forkWorkspaceLoading, pendingOperation: forkWorkspacePendingOperation, dialogDraft: forkWorkspaceDraft, lastError: forkWorkspaceError } = useManagerSelector(
    gitWorkspaceManager,
    forkWorkspaceSelector,
    shallowEqualRecord,
  );
  const forkBranchName = forkWorkspaceDraft.branchName;
  const forkCheckoutPath = forkWorkspaceDraft.checkoutPath;
  useEffect(() => {
    if (!forkWorkspaceDialog) {
      return;
    }
    void gitWorkspaceManager.loadStatus(forkWorkspaceDialog.projectPath).catch(() => undefined);
  }, [forkWorkspaceDialog]);
  useEffect(() => {
    if (!forkWorkspaceDialog || !forkWorkspaceSnapshot) {
      return;
    }
    const nextBranch = `fork/${slugBranchName(selectedRun?.title || forkWorkspaceSnapshot.branchName || forkWorkspaceSnapshot.detachedLabel || "workspace")}`;
    gitWorkspaceManager.setDialogDraft({
      branchName: nextBranch,
      checkoutPath: suggestCheckoutPath(forkWorkspaceSnapshot.repoRoot, nextBranch),
    });
  }, [forkWorkspaceDialog, forkWorkspaceSnapshot, selectedRun?.title]);
  const handleCopyDirectMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (error) {
      console.error("Copy message failed:", error);
    }
  };
  const canRetryConversation = isDirectConversation || (isImplementationConversation && selectedRun?.status !== "failed");
  const canRecoverUserMessage = isDirectConversation || isImplementationConversation;
  const getUserMessageActions = (message: Pick<MessageRecord, "id" | "content">): UserInputMessageAction[] => {
    if (!canRecoverUserMessage) {
      return [];
    }

    const retryActions: UserInputMessageAction[] = [
      {
        label: t(isImplementationConversation ? "conversation.message.action.resumeFromHere" : "conversation.message.action.retryFromHere"),
        icon: <RotateCcw className="h-3.5 w-3.5" />,
        disabled: recoverRun.isPending,
        onClick: () => handleRetryMessage(message.id),
      },
    ];

    if (!isDirectConversation) {
      return retryActions;
    }

    return [
      ...retryActions,
      {
        label: t("conversation.message.action.editInPlace"),
        icon: <Pencil className="h-3.5 w-3.5" />,
        disabled: recoverRun.isPending,
        onClick: () => handleStartEditingMessage(message),
      },
      {
        label: t("conversation.message.action.forkFromHere"),
        icon: <GitBranch className="h-3.5 w-3.5" />,
        disabled: recoverRun.isPending,
        menuItems: [
          {
            label: t("conversation.message.action.forkFromHere"),
            icon: <GitBranch className="h-3.5 w-3.5" />,
            disabled: recoverRun.isPending,
            onClick: () => handleForkMessage(message),
          },
          {
            label: t("git.workspace.action.forkMessageWorktree"),
            icon: <FolderGit2 className="h-3.5 w-3.5" />,
            disabled: recoverRun.isPending,
            onClick: () => handleForkMessageIntoWorktree(message),
          },
        ],
      },
    ];
  };
  const handleScrollToLatestOutput = () => {
    const viewport = scrollRef.current?.querySelector('[data-slot="scroll-area-viewport"], [data-radix-scroll-area-viewport]') as HTMLDivElement | null;
    viewport?.scrollTo({
      top: viewport.scrollHeight,
      behavior: "smooth",
    });
  };
  const confirmForkMessageIntoWorktree = () => {
    if (!forkWorkspaceDialog || !forkWorkspaceSnapshot || !forkBranchName.trim() || !forkCheckoutPath.trim()) {
      return;
    }
    handleConfirmForkMessageIntoWorktree({
      mode: "new_worktree",
      projectPath: forkWorkspaceDialog.projectPath,
      newBranchName: forkBranchName.trim(),
      checkoutPath: forkCheckoutPath.trim(),
      expectedHeadSha: forkWorkspaceSnapshot.headSha,
      expectedStatusFingerprint: forkWorkspaceSnapshot.statusFingerprint,
      runId: forkWorkspaceDialog.runId,
      targetMessageId: forkWorkspaceDialog.targetMessageId,
      content: forkWorkspaceDialog.content,
    });
  };

  return (
  <div className="relative min-h-0 flex-1">
  <ScrollArea className="h-full" ref={scrollRef}>
    {selectedRunId ? (
      isDirectConversation ? (
        <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-4 p-4 pb-24 sm:p-6 sm:pb-20">
          {appErrors.length > 0 ? (
            <div className="space-y-3">
              {appErrors.map((error) => (
                <ErrorNotice key={appErrorKey(error)} error={error} />
              ))}
            </div>
          ) : null}
          {conversationFailure ? (
            <div className="space-y-3">
              <ErrorNotice error={conversationFailure} />
              <LatestRecoveryAction
                selectedRun={selectedRun}
                canRetryConversation={canRetryConversation}
                recoverRun={recoverRun}
                showRecoverableRunningState={showRecoverableRunningState}
                hasStuckWorker={hasStuckWorker}
                latestUserCheckpoint={latestUserCheckpoint}
                handleRetryMessage={handleRetryMessage}
              />
            </div>
          ) : null}
          <DirectControlTerminalColumn>
            <Terminal
              agent={primaryConversationAgent}
              userMessages={directConversationMessages}
              getUserMessageActions={getUserMessageActions}
              editingUserMessageId={editingMessageId}
              editingUserMessageValue={editingMessageValue}
              isEditingUserMessageSaving={recoverRun.isPending}
              onEditingUserMessageValueChange={setEditingMessageValue}
              onCancelEditingUserMessage={handleCancelEditingMessage}
              onSaveEditedUserMessage={handleSaveEditedMessage}
              variant="native"
              textSizeScope="conversation"
              className="min-h-[32rem]"
              showPendingAssistantIndicator={showDirectControlWorkingIndicator}
              projectRoot={projectRoot}
              onOpenProjectFile={onOpenProjectFile}
            />
          </DirectControlTerminalColumn>
        </div>
      ) : (
        <div className="omni-conversation-text-scale mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 pb-24 sm:gap-6 sm:p-6 sm:pb-20">
          {isImplementationConversation ? (
            <RunRecoveryNotice
              recoveryState={recoveryState}
              isResuming={resumeRunRecovery.isPending}
              onResume={handleResumeRunRecovery}
            />
          ) : null}
          {conversationTimelineItems.length > 0 ? (
            conversationTimelineItems.map((item: ConversationTimelineItem) => {
              if (item.type === "activity") {
                return <SupervisorActivityMessage key={item.id} item={item} />;
              }

              const msg = item.message;
              const isUserMessage = msg.role === "user";
              const isCurrentRunMessage = msg.runId === selectedRunId;
              const isPlanningWorkerMessage = msg.role === "worker" && msg.kind === "planning";
              const isExpanded = expandedDirectMessageIds.has(msg.id);
              const userMessageActions: UserInputMessageAction[] = isCurrentRunMessage ? getUserMessageActions(msg) : [];
              const speakerLabel = (isPlanningConversation && msg.role === "worker") || isPlanningWorkerMessage
                ? t("planning.agent.label")
                : msg.role;
              const shouldShowSpeakerHeader = !isUserMessage && msg.role !== "supervisor";

              return (
              <div key={msg.id} className="group flex w-full flex-col text-sm">
                {shouldShowSpeakerHeader ? (
                  <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
                    <div className="flex items-center gap-2">
                    <span className="omni-supervisor-speaker text-xs font-semibold capitalize tracking-wider">
                      {speakerLabel}
                    </span>
                    {msg.kind === "error" ? (
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
                        Run failed
                      </span>
                    ) : null}
                    <span className="text-[10px] text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100">
                      {formatExecutionTimestamp(msg.createdAt)}
                    </span>
                  </div>
                </div>
                ) : null}
                {editingMessageId === msg.id ? (
                  <div className="rounded-xl border border-primary/30 bg-background p-3">
                    <textarea
                      value={editingMessageValue}
                      onChange={(event) => setEditingMessageValue(event.target.value)}
                      className="min-h-28 w-full resize-y rounded-lg border border-border bg-background p-3 text-sm outline-none focus:ring-1 focus:ring-primary/40"
                    />
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">This will truncate later history and rerun from this message.</p>
                      <div className="flex gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={handleCancelEditingMessage}>
                          Cancel
                        </Button>
                        <Button type="button" size="sm" disabled={recoverRun.isPending || !editingMessageValue.trim()} onClick={() => handleSaveEditedMessage(msg.id)}>
                          Save and rerun
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : isUserMessage ? (
                  <UserInputMessage
                    content={msg.content}
                    attachments={msg.attachments}
                    createdAt={msg.createdAt}
                    isExpanded={isExpanded}
                    onToggleExpanded={() => toggleDirectMessageExpansion(msg.id)}
                    onCopy={handleCopyDirectMessage}
                    actions={userMessageActions}
                  />
                ) : (isPlanningConversation && msg.role === "worker") || isPlanningWorkerMessage ? (
                  <PlannerOutputMessage
                    message={msg}
                    agent={conversationAgents.find((agent) => agent.name === inferWorkerIdFromMessage(msg)) ?? null}
                    projectRoot={projectRoot}
                    onOpenProjectFile={onOpenProjectFile}
                  />
                ) : msg.role === "worker" ? (
                  <WorkerOutputMessage
                    message={msg}
                    agent={conversationAgents.find((agent) => agent.name === inferWorkerIdFromMessage(msg)) ?? null}
                    projectRoot={projectRoot}
                    onOpenProjectFile={onOpenProjectFile}
                  />
                ) : (
                  <div className={cn(
                    "overflow-x-auto leading-relaxed",
                    msg.role !== "supervisor" && "whitespace-pre-wrap",
                    msg.kind === "error"
                      ? "rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive"
                      : msg.role === "supervisor"
                        ? "bg-transparent px-1"
                        : "omni-plain-message rounded-lg p-4",
                  )}>
                    {msg.role === "supervisor" ? (
                      <MarkdownContent
                        content={msg.content}
                        className="text-foreground"
                        projectRoot={projectRoot}
                        onOpenProjectFile={onOpenProjectFile}
                      />
                    ) : msg.content}
                  </div>
                )}
              </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 pt-24 text-sm text-muted-foreground sm:pt-32">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                <Blocks className="h-6 w-6 opacity-50" />
              </div>
              <p>No output recorded yet for this run.</p>
            </div>
          )}

          {isPlanningConversation ? (
            <PlanningArtifactsPanel
              specPath={selectedRun?.specPath}
              planPath={selectedRun?.artifactPlanPath}
              plannerArtifactsJson={selectedRun?.plannerArtifactsJson}
              isPromoting={promotePlanningConversation.isPending}
              projectRoot={projectRoot}
              onOpenProjectFile={onOpenProjectFile}
              runId={selectedRunId ?? undefined}
              isReviewing={selectedRun?.status === "reviewing_plan" || selectedRun?.status === "revising_plan"}
              latestReviewRun={reviewRuns[0]}
              latestReviewRound={reviewRounds.filter(r => r.reviewRunId === reviewRuns[0]?.id).pop()}
              reviewFindings={reviewFindings.filter(f => f.reviewRunId === reviewRuns[0]?.id)}
              onStartReview={onStartReview}
              onPromote={(planPath) => {
                if (!selectedRunId) {
                  return;
                }

                promotePlanningConversation.mutate({ runId: selectedRunId, planPath });
              }}
            />
          ) : null}

          {isImplementationConversation && showConversationExecution ? (
            <ConversationExecutionPanel
              runId={selectedRunId}
              liveExecutionStatus={liveExecutionStatus}
              liveThoughts={liveThoughts}
              executionEvents={executionEvents}
            />
          ) : null}

          {isImplementationConversation ? (
            <RecoveryIncidentInspector
              runId={selectedRunId}
              incidents={recoveryIncidents}
            />
          ) : null}

          {!conversationFailure && (showRecoverableRunningState || hasStuckWorker) ? (
            <LatestRecoveryAction
              selectedRun={selectedRun}
              canRetryConversation={canRetryConversation}
              recoverRun={recoverRun}
              showRecoverableRunningState={showRecoverableRunningState}
              hasStuckWorker={hasStuckWorker}
              latestUserCheckpoint={latestUserCheckpoint}
              handleRetryMessage={handleRetryMessage}
            />
          ) : null}

          {appErrors.length > 0 ? (
            <div className="space-y-3">
              {appErrors.map((error) => (
                <ErrorNotice key={appErrorKey(error)} error={error} />
              ))}
            </div>
          ) : null}

          {conversationFailure ? (
            <div className="space-y-3">
              <ErrorNotice error={conversationFailure} />
              <LatestRecoveryAction
                selectedRun={selectedRun}
                canRetryConversation={canRetryConversation}
                recoverRun={recoverRun}
                showRecoverableRunningState={showRecoverableRunningState}
                hasStuckWorker={hasStuckWorker}
                latestUserCheckpoint={latestUserCheckpoint}
                handleRetryMessage={handleRetryMessage}
              />
            </div>
          ) : null}

        </div>
      )
    ) : (
      <div className="omni-conversation-text-scale mx-auto flex h-full w-full max-w-3xl flex-col items-center justify-center px-6 text-center">
        {appErrors.length > 0 ? (
          <div className="mb-6 w-full space-y-3 text-left">
            {appErrors.map((error) => (
              <ErrorNotice key={appErrorKey(error)} error={error} />
            ))}
          </div>
        ) : null}
        <h1 className="mb-4 text-[1.7rem] font-semibold leading-tight">What shall we build in {welcomeRepoName}?</h1>
        {emptyComposer}
      </div>
    )}
  </ScrollArea>
  <div
    className={cn(
      "pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center transition-all duration-150 ease-out motion-reduce:transition-none",
      hasOutputBelow ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
    )}
    aria-hidden={!hasOutputBelow}
  >
    <Button
      type="button"
      size="icon"
      tabIndex={hasOutputBelow ? 0 : -1}
      onClick={handleScrollToLatestOutput}
      aria-label="Scroll to latest output"
      title="Scroll to latest output"
      className="pointer-events-auto h-8 w-8 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/15 transition-all hover:bg-primary/90"
    >
      <ArrowDown className="h-[17px] w-[17px]" />
    </Button>
  </div>
  <Dialog
    open={Boolean(forkWorkspaceDialog)}
    onOpenChange={(open) => {
      if (!open) {
        gitWorkspaceManager.setKey("activeDialog", null);
      }
    }}
  >
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t("git.workspace.dialog.fork.title")}</DialogTitle>
        <DialogDescription>{t("git.workspace.dialog.fork.description")}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">{t("git.workspace.field.branchName")}</span>
          <Input value={forkBranchName} onChange={(event) => {
            const nextBranch = event.target.value;
            gitWorkspaceManager.setDialogBranchName(nextBranch, suggestCheckoutPath(forkWorkspaceSnapshot?.repoRoot, nextBranch));
          }} />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">{t("git.workspace.field.checkoutPath")}</span>
          <Input value={forkCheckoutPath} onChange={(event) => gitWorkspaceManager.setDialogCheckoutPath(event.target.value)} />
        </label>
        {forkWorkspaceError ? (
          <div className="rounded-md border border-destructive/25 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
            <div className="font-medium">{forkWorkspaceError.message}</div>
            {forkWorkspaceError.details?.length ? <div className="mt-1 opacity-80">{forkWorkspaceError.details.join(" ")}</div> : null}
          </div>
        ) : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => gitWorkspaceManager.setKey("activeDialog", null)}>
          {t("common.cancel")}
        </Button>
        <Button
          type="button"
          onClick={confirmForkMessageIntoWorktree}
          disabled={forkWorkspaceLoading || !forkBranchName.trim() || !forkCheckoutPath.trim() || Boolean(forkWorkspacePendingOperation) || recoverRun.isPending}
        >
          {t("git.workspace.dialog.fork.confirm")}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  </div>

  );
}
