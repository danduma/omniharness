import type React from "react";
import { Blocks, ChevronDown, Copy, Cpu, GitBranch, MoreHorizontal, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClarificationPanel } from "@/components/ClarificationPanel";
import { AgentSurface } from "@/components/AgentSurface";
import { Terminal } from "@/components/Terminal";
import { getConversationModeCopy, type ConversationModeOption } from "@/components/ConversationModePicker";
import { PlanningArtifactsPanel } from "@/components/PlanningArtifactsPanel";
import { type AppErrorDescriptor, appErrorKey } from "@/lib/app-errors";
import { type ConversationWorkerRecord } from "@/lib/conversation-workers";
import type { AgentSnapshot, ClarificationRecord, MessageRecord, NoticeDescriptor, RunRecord } from "@/app/home/types";
import { buildInlineError, formatExecutionTimestamp, parseSpawnedWorkerMessage } from "@/app/home/utils";
import { cn } from "@/lib/utils";
import { ErrorNotice } from "./ErrorNotice";
import { ConversationWorkerCard } from "./WorkersSidebar";

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
        <span>{executionDetailsOpen ? "Hide details" : "Show details"}</span>
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

interface ConversationMainProps {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  selectedRunId: string | null;
  selectedRun: RunRecord | null;
  selectedConversationMode: ConversationModeOption;
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
  emptyComposer: React.ReactNode;
}

export function ConversationMain({
  scrollRef,
  selectedRunId,
  selectedRun,
  selectedConversationMode,
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
            <ErrorNotice error={conversationFailure} />
          ) : null}
          {directConversationMessages.length > 0 ? (
            <div className="space-y-2">
              {directConversationMessages.map((msg: MessageRecord) => {
                const isExpanded = expandedDirectMessageIds.has(msg.id);
                const isLongMessage = msg.content.length > 420 || msg.content.split(/\r\n|\r|\n/).length > 6;

                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="flex max-w-[min(72ch,88%)] flex-col items-end sm:max-w-[min(78ch,82%)]">
                      <div className="group/direct-message relative w-full overflow-hidden rounded-[1.9rem] rounded-br-lg bg-[#242424] px-4 py-2.5 text-left text-sm leading-6 text-white shadow-sm transition-colors hover:bg-[#2d2d2d]">
                        <span
                          className="block select-text overflow-hidden whitespace-pre-wrap break-words"
                          style={{ maxHeight: isExpanded ? undefined : "calc(1.5rem * 6)" }}
                        >
                          {msg.content}
                        </span>
                        {isExpanded || isLongMessage ? (
                          <button
                            type="button"
                            aria-expanded={isExpanded}
                            aria-label={isExpanded ? "Show less message text" : "Show more message text"}
                            onClick={() => toggleDirectMessageExpansion(msg.id)}
                            className={cn(
                              "text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
                              isExpanded
                                ? "mt-1 block w-full text-right text-[11px] font-semibold leading-5"
                                : "absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-[#242424] via-[#242424]/95 to-transparent px-4 pb-2.5 pt-6 text-[11px] font-semibold leading-5 transition-colors group-hover/direct-message:from-[#2d2d2d] group-hover/direct-message:via-[#2d2d2d]/95",
                            )}
                          >
                            {isExpanded ? "less" : "...more"}
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-1 flex items-center gap-1 pr-2 text-muted-foreground/70">
                        <button
                          type="button"
                          aria-label="Copy message"
                          title="Copy message"
                          onClick={() => void handleCopyDirectMessage(msg.content)}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Rerun from here"
                          title="Rerun from here"
                          disabled={recoverRun.isPending}
                          onClick={() => handleRetryMessage(msg.id)}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
          <Terminal
            agent={primaryConversationAgent}
            variant="native"
            className="min-h-[32rem]"
          />
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
            visibleMessages.map((msg: MessageRecord) => (
              <div key={msg.id} className="group flex w-full flex-col text-sm">
                <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold capitalize tracking-wider ${msg.role === "user" ? "text-primary" : (msg.role === "system" ? "text-muted-foreground" : "text-emerald-600")}`}>
                    {msg.role === "user" ? "You" : msg.role}
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
                  {isImplementationConversation && msg.role === "user" ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Message actions"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem disabled={recoverRun.isPending} onClick={() => handleRetryMessage(msg.id)}>
                          <RotateCcw className="mr-2 h-4 w-4" /> Retry from here
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={recoverRun.isPending} onClick={() => handleStartEditingMessage(msg)}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit in place
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={recoverRun.isPending} onClick={() => handleForkMessage(msg)}>
                          <GitBranch className="mr-2 h-4 w-4" /> Fork from here
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
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
                      />
                    );
                  })()
                ) : (
                  <div className={`overflow-x-auto whitespace-pre-wrap rounded-lg border p-4 leading-relaxed ${msg.kind === "error"
                    ? "border-destructive/30 bg-destructive/5 text-destructive"
                    : msg.role === "user"
                      ? "border-transparent bg-muted/30 text-foreground"
                      : msg.role === "system"
                        ? "border-border/30 bg-muted/20 text-[13px] text-muted-foreground"
                        : msg.role === "worker"
                          ? "border-[#333] bg-[#1e1e1e] font-mono text-[12px] text-emerald-400 shadow-sm"
                          : "border-border bg-card"}`}>
                    {msg.content}
                  </div>
                )}
              </div>
            ))
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
            <ErrorNotice error={conversationFailure} />
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
        <h1 className="mb-2 text-2xl font-semibold">Welcome to OmniHarness</h1>
        <p className="mb-8 max-w-md text-sm text-muted-foreground">
          {getConversationModeCopy(selectedConversationMode).description}
        </p>
        {emptyComposer}
      </div>
    )}
  </ScrollArea>

  );
}
