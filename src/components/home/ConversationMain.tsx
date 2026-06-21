import type React from "react";
import dynamic from "next/dynamic";
import { useEffect, useMemo } from "react";
import { ArrowDown, ArrowLeftRight, Blocks, Check, ChevronDown, CirclePlay, CircleStop, Copy, FolderGit2, GitBranch, Pencil, RotateCcw, Route } from "lucide-react";
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
import type { TerminalPendingAssistantStatus, TerminalUserMessage } from "@/components/Terminal";
import { PlanningArtifactsPanel } from "@/components/PlanningArtifactsPanel";
import { conversationCopyNoticeManager, conversationMainManager } from "@/components/component-state-managers";
import { type AppErrorDescriptor, appErrorKey } from "@/lib/app-errors";
import { extractLatestPlainTextTurn } from "@/lib/agent-output";
import { shouldShowPlanningTerminalActivity } from "@/lib/planning-output";
import type { AgentSnapshot, ExecutionEventRecord, MessageRecord, NoticeDescriptor, RunRecord, PlanningReviewRunRecord, PlanningReviewRoundRecord, PlanningReviewFindingRecord } from "@/app/home/types";
import type { RecoveryIncidentRecord, RunRecoveryState } from "@/app/home/types";
import { formatExecutionTimestamp, formatExecutionEventType, getExecutionEventDetailRows, shouldShowLatestRecoveryAction, summarizeExecutionEvent, type ConversationTimelineItem } from "@/app/home/utils";
import { buildSupervisorActivityCard, type SupervisorActivityWorker } from "@/app/home/supervisor-activity";
import { cn } from "@/lib/utils";
import { shallowEqualRecord, useManagerSelector, useManagerSnapshot } from "@/lib/use-manager-snapshot";
import type { ProjectFileReference } from "@/lib/project-file-links";
import type { ConversationWorkerRecord } from "@/lib/conversation-workers";
import { gitWorkspaceManager, type GitWorkspaceLaunchRequest } from "@/app/home/GitWorkspaceManager";
import { preflightConfirmationActionsManager } from "@/app/home/PreflightConfirmationActionsManager";
import { useWorkerStream } from "@/app/home/WorkerEntriesManager";
import { useConversationTranscript } from "@/app/home/ConversationTranscriptManager";
import { isTerminalRunStatus } from "@/lib/run-status";
import { deriveConversationLoadState, resolveDirectWorkerStreamRefreshInterval, selectDirectConversationEntries, shouldShowDirectConversationLoading } from "@/app/home/direct-worker-stream-loading";
import { type PlanningReviewAgentSelection } from "@/server/planning/review-preferences";
import { WORKER_TYPE_LABELS, type SupportedWorkerType } from "@/server/supervisor/worker-types";
import type { WorkerEntry } from "@/server/workers/entries-types";
import { CliBrandIcon } from "@/components/cli-brand-icons";
import { ErrorNotice } from "./ErrorNotice";
import { RecoveryIncidentInspector } from "./RecoveryIncidentInspector";
import { RunRecoveryNotice } from "./RunRecoveryNotice";
import { UserInputMessage, type UserInputMessageAction } from "./UserInputMessage";
import { t, useI18nSnapshot } from "@/lib/i18n";

const Terminal = dynamic(
  () => import("@/components/Terminal").then((m) => m.Terminal),
  { ssr: false },
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

function isPreflightConfirmationMessage(message: MessageRecord) {
  return message.role === "supervisor" && message.kind === "implementation_confirmation";
}

const PREFLIGHT_CONFIRMATION_APPROVED_RESPONSE = "Yes, implement it";

interface ConversationExecutionStatusProps {
  liveExecutionStatus: { label: string; detail: string; tone: "error" | "warning" | "muted" | "active" };
  liveThoughts: Array<{ agentName: string; text: string; snippet: string; isLive: boolean }>;
}

function formatActivityWorkerTitle(worker: SupervisorActivityWorker) {
  if (worker.title) {
    return worker.title;
  }
  if (worker.workerNumber !== null) {
    return t("supervisor.activity.worker.fallbackName", { number: worker.workerNumber });
  }
  return worker.workerId;
}

function renderActivityText(worker: SupervisorActivityWorker) {
  if (worker.activityKey) {
    return t(worker.activityKey, worker.activityParams);
  }
  return worker.activityText;
}

const WORKER_MENTION_PATTERN = /\b[Ww]orker\s+(\d+)\b/g;

function renderTextWithWorkerLinks(
  text: string,
  workers: ConversationWorkerRecord[],
  onOpenWorker?: (workerId: string) => void,
): React.ReactNode {
  if (!text || !onOpenWorker || workers.length === 0) {
    return text;
  }
  const workerByNumber = new Map<number, ConversationWorkerRecord>();
  for (const worker of workers) {
    if (typeof worker.workerNumber === "number") {
      workerByNumber.set(worker.workerNumber, worker);
    }
  }
  if (workerByNumber.size === 0) {
    return text;
  }
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let keyCounter = 0;
  for (const match of text.matchAll(WORKER_MENTION_PATTERN)) {
    const matchStart = match.index ?? 0;
    const number = Number.parseInt(match[1]!, 10);
    const target = Number.isFinite(number) ? workerByNumber.get(number) : null;
    if (!target) {
      continue;
    }
    if (matchStart > cursor) {
      nodes.push(text.slice(cursor, matchStart));
    }
    const workerId = target.id;
    nodes.push(
      <button
        key={`worker-link-${keyCounter++}`}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onOpenWorker(workerId);
        }}
        className="omni-worker-mention-link inline cursor-pointer underline decoration-dotted underline-offset-2 hover:text-foreground"
      >
        {match[0]}
      </button>,
    );
    cursor = matchStart + match[0].length;
  }
  if (cursor === 0) {
    return text;
  }
  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }
  return nodes;
}

function ConversationExecutionPanel({
  runId,
  selectedRun,
  liveExecutionStatus,
  liveThoughts,
  executionEvents,
  activeWorkers,
  conversationAgents,
  onOpenWorkerActivity,
}: ConversationExecutionStatusProps & {
  runId: string | null;
  selectedRun: RunRecord | null;
  executionEvents: ExecutionEventRecord[];
  activeWorkers: ConversationWorkerRecord[];
  conversationAgents: AgentSnapshot[];
  onOpenWorkerActivity?: (workerId: string) => void;
}) {
  const { runLogOpenByRunId } = useManagerSnapshot(conversationMainManager);
  const activityCard = useMemo(() => buildSupervisorActivityCard({
    selectedRun,
    liveExecutionStatus,
    activeWorkers,
    agents: conversationAgents,
    executionEvents,
  }), [activeWorkers, conversationAgents, executionEvents, liveExecutionStatus, selectedRun]);
  const liveThoughtText = liveThoughts[0]?.snippet?.trim() ?? "";
  const statusText = activityCard.detailText || liveThoughtText;
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
        <div className="space-y-2 px-3 py-2.5">
          <div className="flex min-w-0 items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className={cn(
                    "shrink-0 text-xs font-semibold tracking-wide",
                    activityCard.status.tone === "error"
                      ? "text-destructive"
                      : activityCard.status.tone === "warning"
                        ? "text-amber-600 dark:text-amber-300"
                        : activityCard.status.tone === "muted"
                          ? "text-muted-foreground"
                          : "omni-run-status-label",
                  )}
                >
                  {activityCard.status.label}
                </span>
                {activityCard.status.tone !== "muted" ? (
                  <div className="flex shrink-0 items-center gap-1" aria-hidden={activityCard.status.tone !== "active"}>
                    {[0, 1, 2].map((index) => (
                      <span
                        key={index}
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          activityCard.status.tone === "error"
                            ? "bg-destructive/70"
                            : activityCard.status.tone === "warning"
                              ? "bg-amber-500/80"
                              : "bg-muted-foreground/80 animate-pulse",
                        )}
                        style={{ animationDelay: `${index * 180}ms` }}
                      />
                    ))}
                  </div>
                ) : null}
                <span className="min-w-0 text-xs font-medium text-foreground">
                  {t(activityCard.phaseKey, activityCard.phaseParams)}
                </span>
              </div>
              {statusText ? (
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {renderTextWithWorkerLinks(statusText, activeWorkers, onOpenWorkerActivity)}
                </p>
              ) : null}
            </div>
            <CollapsibleTrigger
              className="group inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
              aria-label={t("supervisor.activity.expandLog")}
              title={t("supervisor.activity.expandLog")}
            >
              {executionEvents.length > 0 ? (
                <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {executionEvents.length}
                </span>
              ) : null}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
            </CollapsibleTrigger>
          </div>

          {activityCard.workers.length > 0 ? (
            <div className="space-y-1.5" aria-label={t("supervisor.activity.activeWorkers")}>
              {activityCard.workers.map((worker) => {
                const workerTitle = formatActivityWorkerTitle(worker);
                const visibleWorkerTitle = worker.title || (worker.workerNumber === null ? worker.workerId : "");
                return (
                  <button
                    key={worker.workerId}
                    type="button"
                    className="group flex w-full min-w-0 items-start gap-2.5 rounded-md border border-border/55 bg-background/45 px-2.5 py-2 text-left shadow-[inset_0_1px_0_color-mix(in_oklch,var(--foreground)_4%,transparent)] transition-colors hover:border-foreground/18 hover:bg-background/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => onOpenWorkerActivity?.(worker.workerId)}
                    aria-label={t("supervisor.activity.openWorker", { worker: workerTitle })}
                  >
                    <span
                      className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/20 text-muted-foreground group-hover:border-foreground/20 group-hover:text-foreground"
                      aria-hidden="true"
                    >
                      <CliBrandIcon workerType={worker.workerType} className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span
                          className={cn(
                            "h-2 w-2 shrink-0 rounded-full",
                            worker.tone === "error"
                              ? "bg-destructive"
                              : worker.tone === "warning"
                                ? "bg-amber-500"
                                : worker.isLive
                                  ? "bg-emerald-500"
                                  : "bg-muted-foreground/65",
                          )}
                        />
                        {worker.workerNumber !== null ? (
                          <span className="shrink-0 text-xs font-semibold text-foreground">
                            {t("supervisor.activity.worker.fallbackName", { number: worker.workerNumber })}
                          </span>
                        ) : null}
                        {visibleWorkerTitle ? (
                          <span className="min-w-0 truncate text-xs font-medium text-foreground">{visibleWorkerTitle}</span>
                        ) : null}
                        <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                          {t(worker.statusKey, worker.statusParams)}
                        </span>
                        {worker.runtimeLabel ? (
                          <span className="shrink-0 text-[10px] text-muted-foreground/70">{worker.runtimeLabel}</span>
                        ) : null}
                        {worker.attentionKey ? (
                          <span className={cn(
                            "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                            worker.tone === "error"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                          )}>
                            {t(worker.attentionKey, worker.attentionParams)}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block min-w-0 truncate text-[11px] leading-4 text-muted-foreground">
                        {renderActivityText(worker)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
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
                          <p className="break-words text-xs font-medium text-foreground">{formatExecutionEventType(event.eventType)}</p>
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

  if (
    eventType === "worker_failover_started"
    || eventType === "worker_failover_completed"
    || eventType === "worker_handoff_emitted"
  ) {
    return <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.8} />;
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
              scrollAnchorKey={message.id}
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
      scrollAnchorKey={message.id}
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
  primaryConversationWorkerId: string | null;
  initialWorkerEntries?: Record<string, WorkerEntry[]> | undefined;
  unifiedWorkerStreamEnabled: boolean;
  isHydratingConversations: boolean;
  isSelectedConversationPreviewAvailable: boolean;
  isSelectedConversationLoaded: boolean;
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
  handlePreflightConfirmationAnswer: (content: string) => void;
  isPreflightConfirmationAnswering: boolean;
  conversationAgents: AgentSnapshot[];
  showDirectControlWorkingIndicator: boolean;
  directControlPendingAssistantStatus: TerminalPendingAssistantStatus | null;
  showConversationExecution: boolean;
  liveExecutionStatus: ConversationExecutionStatusProps["liveExecutionStatus"];
  liveThoughts: ConversationExecutionStatusProps["liveThoughts"];
  executionEvents: ExecutionEventRecord[];
  activeWorkers: ConversationWorkerRecord[];
  emptyComposer: React.ReactNode;
  projectRoot?: string | null;
  onOpenProjectFile?: (file: ProjectFileReference) => void;
  onOpenWorkerActivity?: (workerId: string) => void;
}

function FailoverChip({ events }: { events: ExecutionEventRecord[] }) {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i]!;
    if (event.eventType !== "worker_failover_completed") continue;
    let outgoingType: string | null = null;
    let newType: string | null = null;
    try {
      const details = event.details ? JSON.parse(event.details) : null;
      if (details && typeof details === "object") {
        const record = details as Record<string, unknown>;
        outgoingType = typeof record.outgoingType === "string" ? record.outgoingType : null;
        newType = typeof record.newType === "string" ? record.newType : null;
      }
    } catch {
      outgoingType = null;
      newType = null;
    }
    if (!outgoingType || !newType) return null;
    const outgoingLabel = WORKER_TYPE_LABELS[outgoingType as SupportedWorkerType] ?? outgoingType;
    const newLabel = WORKER_TYPE_LABELS[newType as SupportedWorkerType] ?? newType;
    return (
      <div className="flex">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/40 bg-amber-100/30 px-3 py-1 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
          aria-label={t("conversation.chip.switchedWorkersAria")}
        >
          <ArrowLeftRight className="h-3 w-3" aria-hidden="true" strokeWidth={1.8} />
          {t("conversation.chip.switchedWorkers", { outgoing: outgoingLabel, incoming: newLabel })}
        </span>
      </div>
    );
  }
  return null;
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
  primaryConversationWorkerId,
  initialWorkerEntries = {},
  unifiedWorkerStreamEnabled,
  isHydratingConversations,
  isSelectedConversationPreviewAvailable,
  isSelectedConversationLoaded,
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
  handlePreflightConfirmationAnswer,
  isPreflightConfirmationAnswering,
  conversationAgents,
  showDirectControlWorkingIndicator,
  directControlPendingAssistantStatus,
  showConversationExecution,
  liveExecutionStatus,
  liveThoughts,
  executionEvents,
  activeWorkers,
  emptyComposer,
  projectRoot,
  onOpenProjectFile,
  onOpenWorkerActivity,
}: ConversationMainProps) {
  useI18nSnapshot();
  const { hasOutputBelow } = useManagerSnapshot(conversationMainManager);
  const { handledMessageIds: handledPreflightConfirmationMessageIds } = useManagerSnapshot(preflightConfirmationActionsManager);
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
      }),
    },
  );
  const conversationEntries = selectDirectConversationEntries({
    transcriptEntries: conversationTranscript.entries,
    directWorkerEntries: directWorkerStream.entries,
  });
  const isUsingConversationTranscriptEntries = conversationTranscript.entries.length > 0;
  const directConversationLoadState = deriveConversationLoadState({
    snapshotLoaded: isSelectedConversationPreviewAvailable,
    unifiedWorkerStreamEnabled,
    primaryConversationWorkerId,
    streamState: directWorkerStream.state,
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
  const handleCopyDirectMessage = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      conversationCopyNoticeManager.showCopiedMessage(messageId);
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

    const copyAction: UserInputMessageAction = {
      label: t("conversation.message.copyAria"),
      title: t("conversation.message.copyAria"),
      icon: <Copy className="h-3.5 w-3.5" />,
      onClick: () => void handleCopyDirectMessage(message.content, message.id),
      feedback: "copy-message",
    };

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
      copyAction,
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
        <div className="omni-conversation-text-scale mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 pb-8 sm:p-6 sm:pb-8">
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
                entries={
                  unifiedWorkerStreamEnabled && (primaryConversationWorkerId || selectedRunId)
                    ? conversationEntries
                    : undefined
                }
                allowUserMessageFallback
                getUserMessageActions={getUserMessageActions}
                editingUserMessageId={editingMessageId}
                editingUserMessageValue={editingMessageValue}
                isEditingUserMessageSaving={recoverRun.isPending}
                onEditingUserMessageValueChange={setEditingMessageValue}
                onCancelEditingUserMessage={handleCancelEditingMessage}
                onSaveEditedUserMessage={handleSaveEditedMessage}
                variant="native"
                textSizeScope="conversation"
                conversationMessageTextSize
                showPendingAssistantIndicator={showDirectControlWorkingIndicator}
                pendingAssistantStatus={directControlPendingAssistantStatus ?? undefined}
                isLoading={isHydratingConversations || isDirectWorkerStreamLoading}
                projectRoot={projectRoot}
                onOpenProjectFile={onOpenProjectFile}
                scrollAnchorKey={selectedRunId}
                summarizeWorkBlocks={isDirectConversation}
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
            </div>
          ) : null}
        </div>
      ) : (
        <div className="omni-conversation-text-scale mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 pb-8 sm:gap-6 sm:p-6 sm:pb-8">
          {isImplementationConversation ? (
            <RunRecoveryNotice
              recoveryState={recoveryState}
              isResuming={resumeRunRecovery.isPending}
              onResume={handleResumeRunRecovery}
            />
          ) : null}
          {isImplementationConversation ? <FailoverChip events={executionEvents} /> : null}
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
          ) : conversationTimelineItems.length > 0 ? (
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
              const hasLaterClarificationAnswer = conversationTimelineItems.some((candidate) => (
                candidate.type === "message"
                && candidate.message.runId === msg.runId
                && candidate.message.kind === "clarification_answer"
                && new Date(candidate.message.createdAt).getTime() > new Date(msg.createdAt).getTime()
              ));
              const showPreflightConfirmationActions = isCurrentRunMessage
                && selectedRun?.status === "awaiting_user"
                && isPreflightConfirmationMessage(msg)
                && !hasLaterClarificationAnswer
                && !handledPreflightConfirmationMessageIds.has(msg.id);
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
                    messageId={msg.id}
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
                      <>
                        <MarkdownContent
                          content={msg.content}
                          className="text-foreground"
                          projectRoot={projectRoot}
                          onOpenProjectFile={onOpenProjectFile}
                        />
                        {showPreflightConfirmationActions ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              disabled={isPreflightConfirmationAnswering}
                              onClick={() => {
                                preflightConfirmationActionsManager.rememberMessage(msg.id);
                                handlePreflightConfirmationAnswer(PREFLIGHT_CONFIRMATION_APPROVED_RESPONSE);
                              }}
                            >
                              <Check aria-hidden="true" />
                              {t("conversation.preflightConfirmation.yes")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isPreflightConfirmationAnswering}
                              onClick={() => preflightConfirmationActionsManager.rememberMessage(msg.id)}
                            >
                              <Pencil aria-hidden="true" />
                              {t("conversation.preflightConfirmation.no")}
                            </Button>
                          </div>
                        ) : null}
                      </>
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
              selectedRun={selectedRun}
              liveExecutionStatus={liveExecutionStatus}
              liveThoughts={liveThoughts}
              executionEvents={executionEvents}
              activeWorkers={activeWorkers}
              conversationAgents={conversationAgents}
              onOpenWorkerActivity={onOpenWorkerActivity}
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
              isSelectedConversationLoaded={isSelectedConversationLoaded}
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
                isSelectedConversationLoaded={isSelectedConversationLoaded}
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
