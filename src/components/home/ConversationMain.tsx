import type React from "react";
import { lazy, memo, useCallback, useEffect, useMemo, useRef } from "react";
import { ArrowDown, ArrowLeftRight, Copy, FolderGit2, GitBranch, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import type { TerminalPendingAssistantStatus, TerminalUserMessage } from "@/components/Terminal";
import { conversationCopyNoticeManager, conversationMainManager } from "@/components/component-state-managers";
import { type AppErrorDescriptor, appErrorKey } from "@/lib/app-errors";
import type { AgentSnapshot, MessageRecord, NoticeDescriptor, RunRecord } from "@/interface/home/types";
import type { RunRecoveryState } from "@/interface/home/types";
import { shouldShowLatestRecoveryAction, resolveRepoName } from "@/interface/home/utils";
import { cn } from "@/lib/utils";
import { shallowEqualRecord, useManagerSelector, useManagerSnapshot } from "@/lib/use-manager-snapshot";
import type { ProjectFileReference } from "@/lib/project-file-links";
import { gitWorkspaceManager, type GitWorkspaceLaunchRequest } from "@/interface/home/GitWorkspaceManager";
import { mobileConversationSwipeManager } from "@/interface/home/MobileConversationSwipeManager";
import { useWorkerStream } from "@/interface/home/WorkerEntriesManager";
import { shouldShowDirectControlWorkingIndicator } from "@/interface/home/direct-control-activity";
import { InlineElicitation, type ElicitationResponseInput } from "@/components/agent-interactions/InlineElicitation";
import { InlinePermission, type PermissionResponseInput } from "@/components/agent-interactions/InlinePermission";
import { useConversationTranscript } from "@/interface/home/ConversationTranscriptManager";
import { isTerminalRunStatus } from "@/lib/run-status";
import { deriveConversationLoadState, resolveConversationRanOnMultipleWorkers, resolveDirectWorkerStreamRefreshInterval, selectDirectConversationEntries, shouldShowDirectConversationLoading } from "@/interface/home/direct-worker-stream-loading";
import type { SupersededSeqRange } from "@/lib/superseded-entries";
import type { WorkerEntry } from "@/shared/worker-entries";
import type { PlanSurfaceOwner } from "@/shared/acp-plan";
import { ErrorNotice } from "./ErrorNotice";
import { RunRecoveryNotice } from "./RunRecoveryNotice";
import type { UserInputMessageAction } from "./UserInputMessage";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useIsCompactLayout } from "@/hooks/use-mobile";

const Terminal = lazy(
  () => import("@/components/Terminal").then((m) => ({ default: m.Terminal })),
);

const DIRECT_WORKER_STREAM_REFRESH_INTERVAL_MS = 2_000;
const DIRECT_WORKER_STREAM_VALIDATION_INTERVAL_MS = 5_000;

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

function DirectControlTerminalColumn({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[min(82ch,100%)]">
      {children}
    </div>
  );
}

interface ConversationMainProps {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  selectedRunId: string | null;
  selectedRun: RunRecord | null;
  welcomeRepoName: string;
  loadedProjects: string[];
  onSelectWelcomeProject: (projectPath: string) => void;
  isDirectConversation: boolean;
  appErrors: AppErrorDescriptor[];
  conversationFailure: NoticeDescriptor | null;
  onCredentialReauthenticate?: () => void;
  directConversationMessages: TerminalUserMessage[];
  /** Ids of messages this client sent itself — rendered past the stream fallback gate. */
  locallySentUserMessageIds?: ReadonlySet<string>;
  /** Ids of optimistic messages whose send request is still in flight. */
  sendingUserMessageIds?: ReadonlySet<string>;
  primaryConversationAgent: AgentSnapshot | null;
  primaryConversationWorkerId: string | null;
  planSurfaceOwner: PlanSurfaceOwner;
  initialWorkerEntries?: Record<string, WorkerEntry[]> | undefined;
  unifiedWorkerStreamEnabled: boolean;
  isHydratingConversations: boolean;
  isSelectedConversationPreviewAvailable: boolean;
  isSelectedConversationLoaded: boolean;
  recoverRun: { isPending: boolean };
  recoveryState: RunRecoveryState | null;
  resumeRunRecovery: { isPending: boolean };
  stopRunRecovery: { isPending: boolean };
  showRecoverableRunningState: boolean;
  hasStuckWorker: boolean;
  latestUserCheckpoint: MessageRecord | null;
  handleRetryMessage: (messageId: string) => void;
  handleResumeRunRecovery: () => void;
  handleStopRecoveryWait: () => void;
  handleStartEditingMessage: (message: Pick<MessageRecord, "id" | "content">) => void;
  handleForkMessage: (message: Pick<MessageRecord, "id" | "content">) => void;
  handleForkMessageIntoWorktree: (message: Pick<MessageRecord, "id" | "content">) => void;
  handleForkMessageToDifferentCli: (message: Pick<MessageRecord, "id" | "content">) => void;
  handleQuotaHandoffToDifferentCli: () => void;
  handleConfirmForkMessageIntoWorktree: (request: GitWorkspaceLaunchRequest & {
    runId: string;
    targetMessageId: string;
  }) => void;
  editingMessageId: string | null;
  editingMessageValue: string;
  setEditingMessageValue: (value: string) => void;
  handleCancelEditingMessage: () => void;
  handleSaveEditedMessage: (messageId: string) => void;
  conversationAgents: AgentSnapshot[];
  showDirectControlWorkingIndicator: boolean;
  directControlPendingAssistantStatus: TerminalPendingAssistantStatus | null;
  emptyComposer: React.ReactNode;
  projectRoot?: string | null;
  onOpenProjectFile?: (file: ProjectFileReference) => void;
  setMobileConversationListOpen: (open: boolean) => void;
  onRespondElicitation?: (input: ElicitationResponseInput) => void;
  onRespondPermission?: (input: PermissionResponseInput) => void;
  respondingElicitationRequestId?: number | null;
  respondingPermissionRequestId?: number | null;
}

function LatestRecoveryAction({
  selectedRun,
  canRetryConversation,
  isSelectedConversationLoaded,
  recoverRun,
  showRecoverableRunningState,
  hasStuckWorker,
  latestUserCheckpoint,
  handleRetryMessage,
}: {
  selectedRun: RunRecord | null;
  canRetryConversation: boolean;
  isSelectedConversationLoaded: boolean;
  recoverRun: { isPending: boolean };
  showRecoverableRunningState: boolean;
  hasStuckWorker: boolean;
  latestUserCheckpoint: MessageRecord | null;
  handleRetryMessage: (messageId: string) => void;
}) {
  if (!shouldShowLatestRecoveryAction({
    selectedRun,
    canRetryConversation,
    isSelectedConversationLoaded,
    latestUserCheckpoint,
    showRecoverableRunningState,
    hasStuckWorker,
  })) {
    return null;
  }
  const checkpoint = latestUserCheckpoint;
  if (!checkpoint) {
    return null;
  }

  return (
    <div className="flex justify-start">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleRetryMessage(checkpoint.id)}
        disabled={recoverRun.isPending}
      >
        <RotateCcw className="mr-2 h-4 w-4" /> {selectedRun?.status === "failed" ? "Resume worker" : "Unstick latest"}
      </Button>
    </div>
  );
}

/**
 * Memoized. Every SSE frame gave the shell a new state identity and re-rendered
 * this entire subtree, even when nothing it renders had changed. Its props are
 * spread from `sharedSidebarProps`, whose callbacks are now stable, so the
 * shallow comparison is meaningful.
 */
const ConversationMain = memo(function ConversationMain({
  scrollRef,
  selectedRunId,
  selectedRun,
  welcomeRepoName,
  loadedProjects,
  onSelectWelcomeProject,
  isDirectConversation,
  appErrors,
  conversationFailure,
  onCredentialReauthenticate,
  directConversationMessages,
  locallySentUserMessageIds,
  sendingUserMessageIds,
  primaryConversationAgent,
  primaryConversationWorkerId,
  planSurfaceOwner,
  initialWorkerEntries = {},
  unifiedWorkerStreamEnabled,
  isHydratingConversations,
  isSelectedConversationPreviewAvailable,
  isSelectedConversationLoaded,
  recoverRun,
  recoveryState,
  resumeRunRecovery,
  stopRunRecovery,
  showRecoverableRunningState,
  hasStuckWorker,
  latestUserCheckpoint,
  handleRetryMessage,
  handleResumeRunRecovery,
  handleStopRecoveryWait,
  handleStartEditingMessage,
  handleForkMessage,
  handleForkMessageIntoWorktree,
  handleForkMessageToDifferentCli,
  handleQuotaHandoffToDifferentCli,
  handleConfirmForkMessageIntoWorktree,
  editingMessageId,
  editingMessageValue,
  setEditingMessageValue,
  handleCancelEditingMessage,
  handleSaveEditedMessage,
  conversationAgents,
  showDirectControlWorkingIndicator,
  directControlPendingAssistantStatus,
  emptyComposer,
  projectRoot,
  onOpenProjectFile,
  setMobileConversationListOpen,
  onRespondElicitation,
  onRespondPermission,
  respondingElicitationRequestId = null,
  respondingPermissionRequestId = null,
}: ConversationMainProps) {
  const i18nSnapshot = useI18nSnapshot();
  const isCompactLayout = useIsCompactLayout();
  const { hasOutputBelow } = useManagerSnapshot(conversationMainManager);
  const selectedRunIsTerminal = isTerminalRunStatus(selectedRun?.status);
  // Subscribe to the unified worker conversation stream for the
  // direct-control worker. When the flag is enabled this drives the
  // Terminal directly; otherwise the legacy `agent` + `userMessages`
  // path renders. `null` workerId returns an empty state and skips
  // the fetch.
  const directWorkerStream = useWorkerStream(
    unifiedWorkerStreamEnabled ? primaryConversationWorkerId : null,
    primaryConversationWorkerId ? initialWorkerEntries[primaryConversationWorkerId] ?? [] : [],
    {
      refreshIntervalMs: resolveDirectWorkerStreamRefreshInterval({
        unifiedWorkerStreamEnabled,
        primaryConversationWorkerId,
        activeRefreshIntervalMs: DIRECT_WORKER_STREAM_REFRESH_INTERVAL_MS,
        validationIntervalMs: DIRECT_WORKER_STREAM_VALIDATION_INTERVAL_MS,
        showDirectControlWorkingIndicator,
        selectedRunIsTerminal,
      }),
    },
  );
  // The single-worker stream above is only the *active* worker's
  // transcript. When a run has cycled through multiple workers
  // (cancel → respawn) we also fetch the merged conversation
  // transcript so prior workers' content stays visible. The merged
  // stream is preferred when available; we fall back to the active
  // worker stream during the brief moment before the transcript hook
  // produces its first response.
  const conversationTranscript = useConversationTranscript(
    unifiedWorkerStreamEnabled ? selectedRunId : null,
    {
      enabled: unifiedWorkerStreamEnabled && Boolean(selectedRunId),
      refreshIntervalMs: resolveDirectWorkerStreamRefreshInterval({
        unifiedWorkerStreamEnabled,
        primaryConversationWorkerId,
        activeRefreshIntervalMs: DIRECT_WORKER_STREAM_REFRESH_INTERVAL_MS,
        validationIntervalMs: DIRECT_WORKER_STREAM_VALIDATION_INTERVAL_MS,
        showDirectControlWorkingIndicator,
        selectedRunIsTerminal,
      }),
    },
  );
  // The worker snapshot sees replacements before the transcript refresh does.
  // Use both lists so output cannot briefly switch back to per-worker sequence
  // ordering and jump above the earlier conversation during that gap.
  const conversationRanOnMultipleWorkers = resolveConversationRanOnMultipleWorkers({
    transcriptWorkerIds: conversationTranscript.workerIds,
    snapshotWorkerIds: conversationAgents.map((agent) => agent.name),
  });
  // The server re-parses `supersededSeqRanges` into a fresh array on every
  // snapshot, so depending on it by identity would invalidate the merge below
  // on every frame even though its contents almost never change. The list is
  // tiny (usually empty), so round-tripping it is far cheaper than the rebuild
  // it prevents.
  const supersededSeqRangesKey = JSON.stringify(primaryConversationAgent?.supersededSeqRanges ?? []);
  const supersededSeqRanges = useMemo(
    () => JSON.parse(supersededSeqRangesKey) as SupersededSeqRange[],
    [supersededSeqRangesKey],
  );
  // Memoized because this array is the `entries` prop Terminal keys its
  // activity derivation on. Rebuilding it every render handed Terminal a new
  // reference each time, so the activity rebuild — measured at ~3ms for a
  // 2k-entry conversation, and several times that on a phone — re-ran on every
  // SSE frame while an agent was streaming, for an identical result.
  const conversationEntries = useMemo(
    () => selectDirectConversationEntries({
      transcriptEntries: conversationTranscript.entries,
      directWorkerEntries: directWorkerStream.entries,
      supersededSeqRanges,
      primaryWorkerId: primaryConversationWorkerId,
      workerOrder: conversationTranscript.workerIds,
    }),
    [
      conversationTranscript.entries,
      conversationTranscript.workerIds,
      directWorkerStream.entries,
      supersededSeqRanges,
      primaryConversationWorkerId,
    ],
  );
  // Only the runtime owns a promise that can consume an answer. Stream rows
  // are durable history and may outlive that promise across a runner crash;
  // rendering them as forms makes a dead question look actionable.
  const pendingElicitations = primaryConversationAgent?.pendingElicitations ?? [];
  // Gated here rather than upstream because this is the only place that knows
  // what the prompt cards below the Terminal are actually rendering: the
  // elicitation card also draws on `directWorkerStream.entries`, which the
  // upstream resolver never sees. Note the refresh-interval calls above
  // deliberately keep using the ungated prop — polling cadence should follow
  // "is the worker busy", not "is a card on screen".
  const showPendingAssistantIndicator = shouldShowDirectControlWorkingIndicator({
    pendingAssistantVisible: showDirectControlWorkingIndicator,
    primaryConversationWorkerId,
    renderedElicitationCount: pendingElicitations.length,
    renderedPermissionCount: primaryConversationAgent?.pendingPermissions?.length ?? 0,
  });
  const isUsingConversationTranscriptEntries = conversationTranscript.entries.length > 0;
  // Latched (`hasEverLoaded` / `hasLoadedOnce`), not momentary (`isLoaded`):
  // isLoaded flips false on every appended entry and every 2s transcript
  // poll, and each flip removed fallback-rendered user bubbles from the
  // transcript — the just-sent message visibly blinked in and out until its
  // stream entry arrived. The gate only exists to keep stale historical
  // rows from rendering before the stream's *first* load.
  const allowDirectUserMessageFallback = Boolean(
    !unifiedWorkerStreamEnabled
      || directWorkerStream.hasEverLoaded
      || conversationTranscript.hasLoadedOnce,
  );
  const directConversationLoadState = deriveConversationLoadState({
    snapshotLoaded: isSelectedConversationPreviewAvailable,
    unifiedWorkerStreamEnabled,
    primaryConversationWorkerId,
    streamState: directWorkerStream.state,
    selectedRunIsTerminal,
  });
  const isDirectWorkerStreamLoading = shouldShowDirectConversationLoading(directConversationLoadState)
    || Boolean(
      selectedRun
      && !isTerminalRunStatus(selectedRun.status)
      && directConversationMessages.length === 0
      && (!directWorkerStream.entries || directWorkerStream.entries.length === 0)
    );
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
        lastError: projectPath ? state.lastErrorByProject[projectPath] ?? null : null,
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
  const handleCopyDirectMessage = useCallback(async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      conversationCopyNoticeManager.showCopiedMessage(messageId);
    } catch (error) {
      console.error("Copy message failed:", error);
    }
  }, []);
  const canRetryConversation = isDirectConversation;
  const canRecoverUserMessage = isDirectConversation;
  // Must be stable: this is a dependency of Terminal's `activity` useMemo, and
  // as a plain arrow it took a new identity every render, so the entire
  // activity pipeline — flatMap over all entries, seq map build, the O(n*m)
  // fallback filter, order-key assignment and the final sort — re-ran on every
  // single render instead of only when the entries changed.
  const getUserMessageActions = useCallback((message: Pick<MessageRecord, "id" | "content">): UserInputMessageAction[] => {
    if (!canRecoverUserMessage) {
      return [];
    }

    const copyAction: UserInputMessageAction = {
      label: t("conversation.message.copyAria"),
      title: t("conversation.message.copyAria"),
      icon: <Copy className="h-3.5 w-3.5" />,
      onClick: () => void handleCopyDirectMessage(message.content, message.id),
      feedback: "copy-message",
    };

    const retryActions: UserInputMessageAction[] = [
      {
        label: t("conversation.message.action.retryFromHere"),
        icon: <RotateCcw className="h-3.5 w-3.5" />,
        disabled: recoverRun.isPending,
        onClick: () => handleRetryMessage(message.id),
      },
    ];

    return [
      copyAction,
      ...retryActions,
      {
        label: t("conversation.message.action.editInPlace"),
        icon: <Pencil className="h-3.5 w-3.5" />,
        disabled: recoverRun.isPending,
        onClick: () => handleStartEditingMessage(message),
      },
    ];
  }, [
    canRecoverUserMessage,
    recoverRun.isPending,
    handleCopyDirectMessage,
    handleRetryMessage,
    handleStartEditingMessage,
    // Action labels come from `t()`, so they must be rebuilt when the language
    // changes rather than captured once.
    i18nSnapshot,
  ]);
  // Forking belongs on the reply: the new conversation keeps everything up to
  // and including it, and the user continues from there. This is handed to
  // every transcript row, so it must stay stable; the fork handlers arrive as
  // fresh closures each render and are only needed on click, so read them
  // through a ref instead of listing them as dependencies.
  const forkHandlersRef = useRef({ handleForkMessage, handleForkMessageIntoWorktree, handleForkMessageToDifferentCli });
  useEffect(() => {
    forkHandlersRef.current = { handleForkMessage, handleForkMessageIntoWorktree, handleForkMessageToDifferentCli };
  });
  const getAssistantMessageActions = useCallback((message: Pick<MessageRecord, "id" | "content">): UserInputMessageAction[] => {
    if (!isDirectConversation) {
      return [];
    }

    return [
      {
        label: t("conversation.message.action.forkFromHere"),
        icon: <GitBranch className="h-4 w-4" />,
        disabled: recoverRun.isPending,
        menuItems: [
          {
            label: t("conversation.message.action.forkFromHere"),
            icon: <GitBranch className="h-3.5 w-3.5" />,
            disabled: recoverRun.isPending,
            onClick: () => forkHandlersRef.current.handleForkMessage(message),
          },
          {
            label: t("git.workspace.action.forkMessageWorktree"),
            icon: <FolderGit2 className="h-3.5 w-3.5" />,
            disabled: recoverRun.isPending,
            onClick: () => forkHandlersRef.current.handleForkMessageIntoWorktree(message),
          },
          {
            label: t("conversation.message.action.forkDifferentCli"),
            icon: <ArrowLeftRight className="h-3.5 w-3.5" />,
            disabled: recoverRun.isPending,
            onClick: () => forkHandlersRef.current.handleForkMessageToDifferentCli(message),
          },
        ],
      },
    ];
  }, [
    isDirectConversation,
    recoverRun.isPending,
    i18nSnapshot,
  ]);
  const handleScrollToLatestOutput = () => {
    const viewport = scrollRef.current?.querySelector('[data-slot="scroll-area-viewport"], [data-radix-scroll-area-viewport]') as HTMLDivElement | null;
    viewport?.scrollTo({
      top: viewport.scrollHeight,
      behavior: "smooth",
    });
  };
  const handleConversationPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    mobileConversationSwipeManager.start(event, isCompactLayout, "open");
  }, [isCompactLayout]);
  const handleConversationPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (mobileConversationSwipeManager.move(event)) {
      setMobileConversationListOpen(true);
    }
  }, [setMobileConversationListOpen]);
  const handleConversationPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const outcome = mobileConversationSwipeManager.finish(event);
    if (outcome) {
      setMobileConversationListOpen(outcome === "open");
    }
  }, [setMobileConversationListOpen]);
  const handleConversationPointerCancel = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const outcome = mobileConversationSwipeManager.cancel(event);
    if (outcome) {
      setMobileConversationListOpen(outcome === "open");
    }
  }, [setMobileConversationListOpen]);
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
    });
  };

  return (
  <div
    className="relative min-h-0 flex-1"
    onPointerDown={handleConversationPointerDown}
    onPointerMove={handleConversationPointerMove}
    onPointerUp={handleConversationPointerUp}
    onPointerCancel={handleConversationPointerCancel}
  >
  <ScrollArea className="h-full" viewportClassName="touch-pan-y touch-pinch-zoom lg:touch-auto" ref={scrollRef}>
    {selectedRunId ? (
        <div
          className="omni-conversation-text-scale mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 pb-8 sm:p-6 sm:pb-8"
          data-testid="conversation-transcript"
        >
          {!isSelectedConversationPreviewAvailable ? (
            <div
              className="flex flex-col items-center justify-center gap-3 pt-24 text-sm text-muted-foreground sm:pt-32"
              role="status"
              aria-live="polite"
            >
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground"
                aria-hidden="true"
              />
              <p>{t("conversation.loading")}</p>
            </div>
          ) : (
            <DirectControlTerminalColumn>
              <Terminal
                agent={primaryConversationAgent}
                userMessages={directConversationMessages}
                workerId={primaryConversationWorkerId ?? undefined}
                entries={
                  unifiedWorkerStreamEnabled && (primaryConversationWorkerId || selectedRunId)
                    ? conversationEntries
                    : undefined
                }
                multiWorkerOrdering={conversationRanOnMultipleWorkers}
                allowUserMessageFallback={allowDirectUserMessageFallback}
                ungatedUserMessageIds={locallySentUserMessageIds}
                sendingUserMessageIds={sendingUserMessageIds}
                getUserMessageActions={getUserMessageActions}
                getAssistantMessageActions={getAssistantMessageActions}
                editingUserMessageId={editingMessageId}
                editingUserMessageValue={editingMessageValue}
                isEditingUserMessageSaving={recoverRun.isPending}
                onEditingUserMessageValueChange={setEditingMessageValue}
                onCancelEditingUserMessage={handleCancelEditingMessage}
                onSaveEditedUserMessage={handleSaveEditedMessage}
                variant="native"
                textSizeScope="conversation"
                conversationMessageTextSize
                showPendingAssistantIndicator={showPendingAssistantIndicator}
                pendingAssistantStatus={directControlPendingAssistantStatus ?? undefined}
                isLoading={isHydratingConversations || isDirectWorkerStreamLoading}
                projectRoot={projectRoot}
                onOpenProjectFile={onOpenProjectFile}
                scrollAnchorKey={selectedRunId}
                summarizeWorkBlocks={isDirectConversation}
                planSurfaceOwner={planSurfaceOwner}
                hasMoreHistory={
                  !unifiedWorkerStreamEnabled
                    ? undefined
                    : isUsingConversationTranscriptEntries
                      ? conversationTranscript.hasOlder
                      : primaryConversationWorkerId
                        ? directWorkerStream.hasOlder
                        : undefined
                }
                onRequestMoreHistory={
                  !unifiedWorkerStreamEnabled
                    ? undefined
                    : isUsingConversationTranscriptEntries
                      ? () => { void conversationTranscript.loadOlder(); }
                      : primaryConversationWorkerId
                        ? () => { void directWorkerStream.loadOlder(); }
                        : undefined
                }
              />
              {primaryConversationWorkerId && pendingElicitations[0] ? (
                <InlineElicitation
                  workerId={primaryConversationWorkerId}
                  elicitation={pendingElicitations[0]}
                  onRespond={onRespondElicitation}
                  disabled={respondingElicitationRequestId === pendingElicitations[0].requestId}
                  className="mt-4"
                />
              ) : null}
              {primaryConversationWorkerId && primaryConversationAgent?.pendingPermissions?.[0] ? (
                <InlinePermission
                  workerId={primaryConversationWorkerId}
                  permission={primaryConversationAgent.pendingPermissions[0]}
                  onRespond={onRespondPermission}
                  disabled={respondingPermissionRequestId === primaryConversationAgent.pendingPermissions[0].requestId}
                  className="mt-4"
                />
              ) : null}
            </DirectControlTerminalColumn>
          )}
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
              {onCredentialReauthenticate ? (
                <div className="flex justify-start">
                  <Button type="button" size="sm" onClick={onCredentialReauthenticate}>
                    {t("conversation.failure.reauth.action")}
                  </Button>
                </div>
              ) : (
                <LatestRecoveryAction
                  selectedRun={selectedRun}
                  canRetryConversation={canRetryConversation}
                  isSelectedConversationLoaded={isSelectedConversationLoaded}
                  recoverRun={recoverRun}
                  showRecoverableRunningState={showRecoverableRunningState}
                  hasStuckWorker={hasStuckWorker}
                  latestUserCheckpoint={latestUserCheckpoint}
                  handleRetryMessage={handleRetryMessage}
                />
              )}
            </div>
          ) : null}
          {recoveryState ? (
            <RunRecoveryNotice
              recoveryState={recoveryState}
              isResuming={resumeRunRecovery.isPending}
              isStopping={stopRunRecovery.isPending}
              onResume={handleResumeRunRecovery}
              onStop={handleStopRecoveryWait}
              onHandoff={recoveryState.kind === "quota_waiting" ? handleQuotaHandoffToDifferentCli : undefined}
            />
          ) : null}
        </div>
    ) : (
      <div className="omni-conversation-text-scale flex h-full w-full flex-col items-center justify-center pb-32 text-center">
        {appErrors.length > 0 ? (
          <div className="mx-auto mb-6 w-full max-w-3xl space-y-3 px-6 text-left">
            {appErrors.map((error) => (
              <ErrorNotice key={appErrorKey(error)} error={error} />
            ))}
          </div>
        ) : null}
        {/* Lift the heading on compact layouts so the gap above the composer is
            visible without changing the composer's position. */}
        <h1 className="mx-auto mb-8 w-full max-w-3xl -translate-y-8 px-6 text-[1.7rem] font-semibold leading-tight sm:mb-14 sm:translate-y-0">
          {t("conversation.welcome.beforeProject")}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="cursor-pointer rounded-sm text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t("conversation.welcome.selectProject", { project: welcomeRepoName })}
            >
              {welcomeRepoName}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="max-h-80 max-w-[calc(100vw-2rem)] overflow-y-auto">
              {loadedProjects.map((projectPath) => (
                <DropdownMenuItem key={projectPath} onClick={() => onSelectWelcomeProject(projectPath)} className="min-h-11 cursor-pointer">
                  <span className="flex min-w-0 flex-col text-left">
                    <span>{resolveRepoName(projectPath)}</span>
                    <span className="truncate text-xs text-muted-foreground">{projectPath}</span>
                  </span>
                </DropdownMenuItem>
              ))}
              {loadedProjects.length === 0 ? <DropdownMenuItem disabled>{t("conversation.welcome.noProjects")}</DropdownMenuItem> : null}
            </DropdownMenuContent>
          </DropdownMenu>
          {t("conversation.welcome.afterProject")}
        </h1>
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
});
export { ConversationMain };
