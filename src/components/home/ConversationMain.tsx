import type React from "react";
import { Blocks, ChevronDown, GitBranch, ListTree, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AgentSurface } from "@/components/AgentSurface";
import { MarkdownContent } from "@/components/MarkdownContent";
import { Terminal } from "@/components/Terminal";
import { PlanningArtifactsPanel } from "@/components/PlanningArtifactsPanel";
import { conversationMainManager } from "@/components/component-state-managers";
import { type AppErrorDescriptor, appErrorKey } from "@/lib/app-errors";
import { extractLatestPlainTextTurn } from "@/lib/agent-output";
import type { AgentSnapshot, ExecutionEventRecord, MessageRecord, NoticeDescriptor, RunRecord } from "@/app/home/types";
import { formatExecutionTimestamp, getExecutionEventDetailRows, summarizeExecutionEvent, type ConversationTimelineItem } from "@/app/home/utils";
import { cn } from "@/lib/utils";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import { ErrorNotice } from "./ErrorNotice";
import { UserInputMessage, type UserInputMessageAction } from "./UserInputMessage";

interface ConversationExecutionStatusProps {
  liveExecutionStatus: { label: string; detail: string; tone: "error" | "warning" | "muted" | "active" };
  liveThoughts: Array<{ agentName: string; snippet: string; isLive: boolean }>;
}

function ConversationExecutionStatus({
  liveExecutionStatus,
  liveThoughts,
}: ConversationExecutionStatusProps) {
  return (
  <div className="group flex w-full flex-col text-sm">
    <div className="mb-1.5 flex items-center gap-2 px-1">
      <span
        className={cn(
          "text-xs font-semibold tracking-wide",
          liveExecutionStatus.tone === "error"
            ? "text-destructive"
            : liveExecutionStatus.tone === "warning"
              ? "text-amber-700"
              : "text-amber-600",
        )}
      >
        {liveExecutionStatus.label}
      </span>
      <div className="flex items-center gap-1" aria-hidden={liveExecutionStatus.tone !== "active"}>
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              liveExecutionStatus.tone === "error"
                ? "bg-destructive/70"
                : liveExecutionStatus.tone === "warning"
                  ? "bg-amber-500/80"
                  : "bg-amber-500/80 animate-pulse",
            )}
            style={{ animationDelay: `${index * 180}ms` }}
          />
        ))}
      </div>
    </div>
    {liveExecutionStatus.detail ? (
      <p className="mb-2 px-1 text-xs leading-relaxed text-muted-foreground">{liveExecutionStatus.detail}</p>
    ) : null}
    {liveThoughts.length > 0 ? (
      <div className="mb-1 space-y-1 px-1">
        {liveThoughts.map((thought) => (
          <p key={`${thought.agentName}:${thought.snippet}`} className="text-xs leading-relaxed text-muted-foreground">
            {thought.agentName}: {thought.snippet}
          </p>
        ))}
      </div>
    ) : null}
  </div>
  );
}

function ConversationRunLog({
  runId,
  executionEvents,
}: {
  runId: string | null;
  executionEvents: ExecutionEventRecord[];
}) {
  const { runLogOpenByRunId } = useManagerSnapshot(conversationMainManager);

  if (!runId || executionEvents.length === 0) {
    return null;
  }

  const open = Boolean(runLogOpenByRunId[runId]);

  return (
    <Collapsible open={open} onOpenChange={(nextOpen) => conversationMainManager.setRunLogOpen(runId, nextOpen)}>
      <div className="rounded-lg border border-border/70 bg-muted/20 text-sm" aria-label="Run Log">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left">
          <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-muted-foreground">
            <ListTree className="h-3.5 w-3.5 shrink-0" />
            Run Log
            <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {executionEvents.length}
            </span>
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border/60 px-3 py-2">
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {executionEvents.map((event) => {
                const detailRows = getExecutionEventDetailRows(event);
                return (
                  <div key={event.id} className="rounded-md border border-border/50 bg-background/70 p-2">
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

function SupervisorActivityMessage({ item }: { item: Extract<ConversationTimelineItem, { type: "activity" }> }) {
  return (
    <div className="group flex w-full flex-col px-1 text-sm" aria-label="Conversation event">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-words">
          {item.text}
        </p>
        <span className="shrink-0 text-[10px] text-muted-foreground/50">
          {formatExecutionTimestamp(item.createdAt)}
        </span>
      </div>
    </div>
  );
}

function WorkerOutputMessage({
  message,
  agent,
}: {
  message: MessageRecord;
  agent: AgentSnapshot | null;
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
      <div className="overflow-hidden rounded-xl border border-emerald-600/20 bg-emerald-950/[0.08] shadow-sm">
        <div className="space-y-3 p-4">
          <div className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
            {summaryText}
          </div>
          <CollapsibleTrigger
            className="inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-emerald-700 transition-colors hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-emerald-300 dark:hover:text-emerald-100"
            aria-label={fullOutputOpen ? "Hide full worker output" : "Show full worker output"}
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", fullOutputOpen && "rotate-180")} />
            {fullOutputOpen ? "Hide full output" : "Show full output"}
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="border-t border-emerald-600/15 bg-muted/20 p-2 dark:bg-[#0b0d10]">
            <Terminal
              agent={fullOutputAgent}
              className="h-72"
            />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
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
  directConversationMessages: MessageRecord[];
  expandedDirectMessageIds: Set<string>;
  toggleDirectMessageExpansion: (messageId: string) => void;
  primaryConversationAgent: AgentSnapshot | null;
  promotePlanningConversation: {
    isPending: boolean;
    mutate: (payload: { runId: string; planPath: string | null }) => void;
  };
  conversationTimelineItems: ConversationTimelineItem[];
  recoverRun: { isPending: boolean };
  showRecoverableRunningState: boolean;
  hasStuckWorker: boolean;
  latestUserCheckpoint: MessageRecord | null;
  handleRetryMessage: (messageId: string) => void;
  handleStartEditingMessage: (message: Pick<MessageRecord, "id" | "content">) => void;
  handleForkMessage: (message: Pick<MessageRecord, "id" | "content">) => void;
  editingMessageId: string | null;
  editingMessageValue: string;
  setEditingMessageValue: (value: string) => void;
  handleCancelEditingMessage: () => void;
  handleSaveEditedMessage: (messageId: string) => void;
  conversationAgents: AgentSnapshot[];
  showConversationExecution: boolean;
  liveExecutionStatus: ConversationExecutionStatusProps["liveExecutionStatus"];
  liveThoughts: ConversationExecutionStatusProps["liveThoughts"];
  executionEvents: ExecutionEventRecord[];
  emptyComposer: React.ReactNode;
}

function LatestRecoveryAction({
  selectedRun,
  isDirectConversation,
  recoverRun,
  showRecoverableRunningState,
  hasStuckWorker,
  latestUserCheckpoint,
  handleRetryMessage,
}: {
  selectedRun: RunRecord | null;
  isDirectConversation: boolean;
  recoverRun: { isPending: boolean };
  showRecoverableRunningState: boolean;
  hasStuckWorker: boolean;
  latestUserCheckpoint: MessageRecord | null;
  handleRetryMessage: (messageId: string) => void;
}) {
  if (!isDirectConversation || !latestUserCheckpoint) {
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
        <RotateCcw className="mr-2 h-4 w-4" /> {selectedRun?.status === "failed" ? "Retry latest" : "Unstick latest"}
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
  conversationTimelineItems,
  recoverRun,
  showRecoverableRunningState,
  hasStuckWorker,
  latestUserCheckpoint,
  handleRetryMessage,
  handleStartEditingMessage,
  handleForkMessage,
  editingMessageId,
  editingMessageValue,
  setEditingMessageValue,
  handleCancelEditingMessage,
  handleSaveEditedMessage,
  conversationAgents,
  showConversationExecution,
  liveExecutionStatus,
  liveThoughts,
  executionEvents,
  emptyComposer,
}: ConversationMainProps) {
  const handleCopyDirectMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (error) {
      console.error("Copy message failed:", error);
    }
  };
  const canRecoverUserMessage = isDirectConversation;
  const getUserMessageActions = (message: Pick<MessageRecord, "id" | "content">): UserInputMessageAction[] => (
    canRecoverUserMessage
      ? [
        {
          label: "Retry from here",
          icon: <RotateCcw className="h-3.5 w-3.5" />,
          disabled: recoverRun.isPending,
          onClick: () => handleRetryMessage(message.id),
        },
        {
          label: "Edit in place",
          icon: <Pencil className="h-3.5 w-3.5" />,
          disabled: recoverRun.isPending,
          onClick: () => handleStartEditingMessage(message),
        },
        {
          label: "Fork from here",
          icon: <GitBranch className="h-3.5 w-3.5" />,
          disabled: recoverRun.isPending,
          onClick: () => handleForkMessage(message),
        },
      ]
      : []
  );

  return (
  <ScrollArea className="min-h-0 flex-1" ref={scrollRef}>
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
                isDirectConversation={isDirectConversation}
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
              variant="native"
              className="min-h-[32rem]"
            />
          </DirectControlTerminalColumn>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 pb-24 sm:gap-6 sm:p-6 sm:pb-20">
          {isPlanningConversation ? (
            <PlanningArtifactsPanel
              specPath={selectedRun?.specPath}
              planPath={selectedRun?.artifactPlanPath}
              plannerArtifactsJson={selectedRun?.plannerArtifactsJson}
              isPromoting={promotePlanningConversation.isPending}
              onPromote={(planPath) => {
                if (!selectedRunId) {
                  return;
                }

                promotePlanningConversation.mutate({ runId: selectedRunId, planPath });
              }}
            />
          ) : null}

          {conversationTimelineItems.length > 0 ? (
            conversationTimelineItems.map((item: ConversationTimelineItem) => {
              if (item.type === "activity") {
                return <SupervisorActivityMessage key={item.id} item={item} />;
              }

              const msg = item.message;
              const isUserMessage = msg.role === "user";
              const isExpanded = expandedDirectMessageIds.has(msg.id);
              const userMessageActions: UserInputMessageAction[] = getUserMessageActions(msg);

              return (
              <div key={msg.id} className="group flex w-full flex-col text-sm">
                {!isUserMessage ? (
                  <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
                    <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold capitalize tracking-wider text-emerald-600">
                      {msg.role}
                    </span>
                    {msg.kind === "error" ? (
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
                        Run failed
                      </span>
                    ) : null}
                    <span className="text-[10px] text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100">
                      {new Date(msg.createdAt).toLocaleTimeString()}
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
                    isExpanded={isExpanded}
                    onToggleExpanded={() => toggleDirectMessageExpansion(msg.id)}
                    onCopy={handleCopyDirectMessage}
                    actions={userMessageActions}
                  />
                ) : msg.role === "worker" ? (
                  <WorkerOutputMessage
                    message={msg}
                    agent={conversationAgents.find((agent) => agent.name === inferWorkerIdFromMessage(msg)) ?? null}
                  />
                ) : (
                  <div className={cn(
                    "overflow-x-auto rounded-lg border p-4 leading-relaxed",
                    msg.role !== "supervisor" && "whitespace-pre-wrap",
                    msg.kind === "error"
                      ? "border-destructive/30 bg-destructive/5 text-destructive"
                      : "border-border bg-card",
                  )}>
                    {msg.role === "supervisor" ? (
                      <MarkdownContent content={msg.content} className="text-foreground" />
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

          {isImplementationConversation && showConversationExecution ? (
          <ConversationExecutionStatus
            liveExecutionStatus={liveExecutionStatus}
            liveThoughts={liveThoughts}
          />
        ) : null}

          {isImplementationConversation ? (
            <ConversationRunLog
              runId={selectedRunId}
              executionEvents={executionEvents}
            />
          ) : null}

          {!conversationFailure && (showRecoverableRunningState || hasStuckWorker) ? (
            <LatestRecoveryAction
              selectedRun={selectedRun}
              isDirectConversation={isDirectConversation}
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
                isDirectConversation={isDirectConversation}
                recoverRun={recoverRun}
                showRecoverableRunningState={showRecoverableRunningState}
                hasStuckWorker={hasStuckWorker}
                latestUserCheckpoint={latestUserCheckpoint}
                handleRetryMessage={handleRetryMessage}
              />
            </div>
          ) : null}

          {isPlanningConversation ? (
            <AgentSurface
              title="Planning agent"
              subtitle={selectedRun?.projectPath || "Using the current project root as cwd"}
              agent={primaryConversationAgent}
              className="min-h-[22rem]"
            />
          ) : null}

        </div>
      )
    ) : (
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col items-center justify-center px-6 text-center">
        {appErrors.length > 0 ? (
          <div className="mb-6 w-full space-y-3 text-left">
            {appErrors.map((error) => (
              <ErrorNotice key={appErrorKey(error)} error={error} />
            ))}
          </div>
        ) : null}
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Blocks className="h-8 w-8 text-primary" />
        </div>
        <h1 className="mb-1 text-2xl font-semibold">What shall we build in {welcomeRepoName}?</h1>
        {emptyComposer}
      </div>
    )}
  </ScrollArea>

  );
}
