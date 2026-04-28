import type React from "react";
import { useState } from "react";
import { Blocks, ChevronDown, Cpu, GitBranch, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClarificationPanel } from "@/components/ClarificationPanel";
import { AgentSurface } from "@/components/AgentSurface";
import { Terminal } from "@/components/Terminal";
import { PlanningArtifactsPanel } from "@/components/PlanningArtifactsPanel";
import { type AppErrorDescriptor, appErrorKey } from "@/lib/app-errors";
import { extractLatestPlainTextTurn } from "@/lib/agent-output";
import { type ConversationWorkerRecord } from "@/lib/conversation-workers";
import type { AgentSnapshot, ClarificationRecord, MessageRecord, NoticeDescriptor, RunRecord } from "@/app/home/types";
import { buildInlineError, formatExecutionTimestamp, parseSpawnedWorkerMessage } from "@/app/home/utils";
import { cn } from "@/lib/utils";
import { ErrorNotice } from "./ErrorNotice";
import { ConversationWorkerCard } from "./WorkersSidebar";
import { UserInputMessage, type UserInputMessageAction } from "./UserInputMessage";

interface ConversationExecutionStatusProps {
  liveExecutionStatus: { label: string; detail: string; tone: "error" | "warning" | "muted" | "active" };
  liveThoughts: Array<{ agentName: string; snippet: string; isLive: boolean }>;
  executionDetailsOpen: boolean;
  setExecutionDetailsOpen: (open: boolean) => void;
  executionDetailLines: Array<{ text: string; createdAt?: string }>;
}

function ConversationExecutionStatus({
  liveExecutionStatus,
  liveThoughts,
  executionDetailsOpen,
  setExecutionDetailsOpen,
  executionDetailLines,
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
    <Collapsible open={executionDetailsOpen} onOpenChange={setExecutionDetailsOpen}>
      <CollapsibleTrigger className="mt-2 flex items-center gap-2 px-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", executionDetailsOpen ? "rotate-180" : "")} />
        <span>{executionDetailsOpen ? "Hide supervisor activity" : "Show supervisor activity"}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 pt-2 pl-6">
        {executionDetailLines.length > 0 ? executionDetailLines.map((line, index) => {
          return (
            <p key={`${line.text}-${index}`} className="text-xs leading-relaxed text-muted-foreground">
              {line.createdAt ? `${formatExecutionTimestamp(line.createdAt)} ` : ""}
              {line.text}
            </p>
          );
        }) : (
          <p className="text-xs leading-relaxed text-muted-foreground">No execution details yet.</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  </div>
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

function WorkerOutputMessage({
  message,
  agent,
}: {
  message: MessageRecord;
  agent: AgentSnapshot | null;
}) {
  const [fullOutputOpen, setFullOutputOpen] = useState(false);
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
    <Collapsible open={fullOutputOpen} onOpenChange={setFullOutputOpen}>
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
          <div className="border-t border-emerald-600/15 bg-[#0b0d10] p-2">
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
  visibleMessages: MessageRecord[];
  recoverRun: { isPending: boolean };
  showRecoverableRunningState: boolean;
  hasStuckWorker: boolean;
  latestUserCheckpoint: MessageRecord | null;
  handleRetryMessage: (messageId: string) => void;
  handleStartEditingMessage: (message: MessageRecord) => void;
  handleForkMessage: (message: MessageRecord) => void;
  editingMessageId: string | null;
  editingMessageValue: string;
  setEditingMessageValue: (value: string) => void;
  handleCancelEditingMessage: () => void;
  handleSaveEditedMessage: (messageId: string) => void;
  selectedRunWorkers: ConversationWorkerRecord[];
  conversationAgents: AgentSnapshot[];
  showConversationExecution: boolean;
  liveExecutionStatus: ConversationExecutionStatusProps["liveExecutionStatus"];
  liveThoughts: ConversationExecutionStatusProps["liveThoughts"];
  executionDetailsOpen: boolean;
  setExecutionDetailsOpen: (open: boolean) => void;
  executionDetailLines: ConversationExecutionStatusProps["executionDetailLines"];
  selectedClarifications: ClarificationRecord[];
  answerClarification: {
    error: unknown;
    mutate: (payload: { clarificationId: string; answer: string }) => void;
  };
  conversationWorkerGroups: { active: ConversationWorkerRecord[] };
  onStopWorker?: (workerId: string) => void;
  stoppingWorkerId?: string | null;
  emptyComposer: React.ReactNode;
}

function LatestRecoveryAction({
  selectedRun,
  isImplementationConversation,
  recoverRun,
  showRecoverableRunningState,
  hasStuckWorker,
  latestUserCheckpoint,
  handleRetryMessage,
}: {
  selectedRun: RunRecord | null;
  isImplementationConversation: boolean;
  recoverRun: { isPending: boolean };
  showRecoverableRunningState: boolean;
  hasStuckWorker: boolean;
  latestUserCheckpoint: MessageRecord | null;
  handleRetryMessage: (messageId: string) => void;
}) {
  if (!isImplementationConversation || !latestUserCheckpoint) {
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
  visibleMessages,
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
  selectedRunWorkers,
  conversationAgents,
  showConversationExecution,
  liveExecutionStatus,
  liveThoughts,
  executionDetailsOpen,
  setExecutionDetailsOpen,
  executionDetailLines,
  selectedClarifications,
  answerClarification,
  conversationWorkerGroups,
  onStopWorker,
  stoppingWorkerId,
  emptyComposer,
}: ConversationMainProps) {
  const handleCopyDirectMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (error) {
      console.error("Copy message failed:", error);
    }
  };

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
                isImplementationConversation={isImplementationConversation}
                recoverRun={recoverRun}
                showRecoverableRunningState={showRecoverableRunningState}
                hasStuckWorker={hasStuckWorker}
                latestUserCheckpoint={latestUserCheckpoint}
                handleRetryMessage={handleRetryMessage}
              />
            </div>
          ) : null}
          {directConversationMessages.length > 0 ? (
            <div className="space-y-2">
              {directConversationMessages.map((msg: MessageRecord) => {
                const isExpanded = expandedDirectMessageIds.has(msg.id);
                const actions: UserInputMessageAction[] = [
                  {
                    label: "Rerun from here",
                    icon: <RotateCcw className="h-3.5 w-3.5" />,
                    disabled: recoverRun.isPending,
                    onClick: () => handleRetryMessage(msg.id),
                  },
                ];

                return (
                  <UserInputMessage
                    key={msg.id}
                    content={msg.content}
                    isExpanded={isExpanded}
                    onToggleExpanded={() => toggleDirectMessageExpansion(msg.id)}
                    onCopy={handleCopyDirectMessage}
                    actions={actions}
                  />
                );
              })}
            </div>
          ) : null}
          <DirectControlTerminalColumn>
            <Terminal
              agent={primaryConversationAgent}
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

          {visibleMessages.length > 0 ? (
            visibleMessages.map((msg: MessageRecord) => {
              const isUserMessage = msg.role === "user";
              const isExpanded = expandedDirectMessageIds.has(msg.id);
              const userMessageActions: UserInputMessageAction[] = isImplementationConversation
                ? [
                  {
                    label: "Retry from here",
                    icon: <RotateCcw className="h-3.5 w-3.5" />,
                    disabled: recoverRun.isPending,
                    onClick: () => handleRetryMessage(msg.id),
                  },
                  {
                    label: "Edit in place",
                    icon: <Pencil className="h-3.5 w-3.5" />,
                    disabled: recoverRun.isPending,
                    onClick: () => handleStartEditingMessage(msg),
                  },
                  {
                    label: "Fork from here",
                    icon: <GitBranch className="h-3.5 w-3.5" />,
                    disabled: recoverRun.isPending,
                    onClick: () => handleForkMessage(msg),
                  },
                ]
                : [];

              return (
              <div key={msg.id} className="group flex w-full flex-col text-sm">
                {!isUserMessage ? (
                  <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
                    <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold capitalize tracking-wider ${msg.role === "system" ? "text-muted-foreground" : "text-emerald-600"}`}>
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
                    isExpanded={isExpanded}
                    onToggleExpanded={() => toggleDirectMessageExpansion(msg.id)}
                    onCopy={handleCopyDirectMessage}
                    actions={userMessageActions}
                  />
                ) : msg.role === "system" && msg.content.startsWith("Spawned worker.") ? (
                  (() => {
                    const parsed = parseSpawnedWorkerMessage(msg.content);
                    const workerId = parsed?.workerId?.trim() || "";
                    const linkedWorker = selectedRunWorkers.find((worker) => worker.id === workerId);
                    const linkedAgent = conversationAgents.find((agent) => agent.name === workerId);

                    if (!workerId) {
                      return (
                        <div className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-border/30 bg-muted/20 p-4 text-[13px] leading-relaxed text-muted-foreground">
                          {msg.content}
                        </div>
                      );
                    }

                    const resolvedWorker = linkedWorker ?? {
                      id: workerId,
                      runId: msg.runId,
                      type: parsed?.typeLabel || "",
                      status: linkedAgent?.state || "starting",
                    };

                    return (
                      <ConversationWorkerCard
                        worker={resolvedWorker}
                        agent={linkedAgent}
                        preferredModel={selectedRun?.preferredWorkerModel || null}
                        preferredEffort={selectedRun?.preferredWorkerEffort || null}
                        defaultOpen={false}
                        terminalHeightClass="h-64 sm:h-[22rem]"
                        fallbackPreview={parsed?.purpose}
                        onStopWorker={onStopWorker}
                        isStopping={stoppingWorkerId === workerId}
                      />
                    );
                  })()
                ) : msg.role === "worker" ? (
                  <WorkerOutputMessage
                    message={msg}
                    agent={conversationAgents.find((agent) => agent.name === inferWorkerIdFromMessage(msg)) ?? null}
                  />
                ) : (
                  <div className={`overflow-x-auto whitespace-pre-wrap rounded-lg border p-4 leading-relaxed ${msg.kind === "error"
                    ? "border-destructive/30 bg-destructive/5 text-destructive"
                    : msg.role === "system"
                        ? "border-border/30 bg-muted/20 text-[13px] text-muted-foreground"
                          : "border-border bg-card"}`}>
                    {msg.content}
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
            executionDetailsOpen={executionDetailsOpen}
            setExecutionDetailsOpen={setExecutionDetailsOpen}
            executionDetailLines={executionDetailLines}
          />
        ) : null}

          {!conversationFailure && (showRecoverableRunningState || hasStuckWorker) ? (
            <LatestRecoveryAction
              selectedRun={selectedRun}
              isImplementationConversation={isImplementationConversation}
              recoverRun={recoverRun}
              showRecoverableRunningState={showRecoverableRunningState}
              hasStuckWorker={hasStuckWorker}
              latestUserCheckpoint={latestUserCheckpoint}
              handleRetryMessage={handleRetryMessage}
            />
          ) : null}

          {isImplementationConversation && selectedClarifications.length > 0 && (
            <div className="max-w-xl">
              <ClarificationPanel
                clarifications={selectedClarifications}
                onAnswer={(clarificationId, answer) => answerClarification.mutate({ clarificationId, answer })}
                errorMessage={answerClarification.error ? buildInlineError(answerClarification.error, {
                  source: "Clarifications",
                  action: "Answer clarification",
                }).message : null}
              />
            </div>
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
              <LatestRecoveryAction
                selectedRun={selectedRun}
                isImplementationConversation={isImplementationConversation}
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

          {isImplementationConversation && conversationWorkerGroups.active.length > 0 && (
            <div className="mt-4 border-t border-border/50 pt-6 sm:mt-8">
              <div className="mb-4 flex items-center gap-2 pl-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Cpu className="h-4 w-4" /> CLI Agents
              </div>
              <div className="flex flex-col gap-6">
                {conversationWorkerGroups.active.map((worker) => {
                  const agent = conversationAgents.find((item) => item.name === worker.id);

                  return (
                    <ConversationWorkerCard
                      key={worker.id}
                      worker={worker}
                      agent={agent}
                      preferredModel={selectedRun?.preferredWorkerModel || null}
                      preferredEffort={selectedRun?.preferredWorkerEffort || null}
                      defaultOpen={false}
                      terminalHeightClass="h-64 sm:h-[22rem]"
                      onStopWorker={onStopWorker}
                      isStopping={stoppingWorkerId === worker.id}
                    />
                  );
                })}
              </div>
            </div>
          )}
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
        <h1 className="mb-2 text-2xl font-semibold">What shall we build in {welcomeRepoName}?</h1>
        {emptyComposer}
      </div>
    )}
  </ScrollArea>

  );
}
