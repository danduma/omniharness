"use client";

import React, { useCallback, useEffect, useRef } from "react";
import {
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Target,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PlanProgress } from "@/components/PlanProgress";
import { goalPlanManager, type GoalPlanPendingOperation } from "@/interface/home/GoalPlanManager";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useRuntimeAPIs } from "@/runtime-api/provider";
import { validateGoalObjective, type GoalMutationAction, type GoalSnapshot, type GoalStatus } from "@/shared/goal-plan";

interface GoalPlanCardProps {
  goal: GoalSnapshot | null;
  onSnapshot: (snapshot: GoalSnapshot, eventKey: string | null) => void;
  onOpenPlanArtifact?: (uri: string) => void;
}

function elapsedLabel(startedAt: string, endAt: string | null, nowMs: number) {
  const start = new Date(startedAt).getTime();
  const end = endAt ? new Date(endAt).getTime() : nowMs;
  const seconds = Math.max(0, Math.floor((end - start) / 1_000));
  if (seconds < 60) return t("goal.elapsed.seconds", { count: seconds });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t("goal.elapsed.minutes", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("goal.elapsed.hours", { count: hours });
  return t("goal.elapsed.days", { count: Math.floor(hours / 24) });
}

/**
 * States a goal can sit in while nothing is driving it forward.
 *
 * A goal stalls in far more ways than `paused`: the agent can block it, park it
 * on the user, lose its goal capability, or fail outright, and it can sit in
 * `pending` because the agent never picked it up. The card previously offered a
 * resume control only for `paused`, and only when the agent advertised a resume
 * capability — which left every other stalled goal with no way back to
 * `pursuing` at all.
 */
const STALLED_GOAL_STATUSES = new Set<GoalStatus>([
  "pending",
  "paused",
  "waiting_user",
  "blocked",
  "limited",
  "error",
]);

/**
 * The single play/pause control in the card header.
 *
 * `retry` rather than `resume` is what a stalled goal without an advertised
 * resume capability sends: both land on `pursuing`, but only `retry` is exempt
 * from the capability check, so it still works for an agent that reports no
 * goal capabilities at all.
 */
export function resolveGoalRunControl(goal: GoalSnapshot): { action: GoalMutationAction; labelKey: string } | null {
  if (goal.status === "pursuing") {
    return goal.capabilities.pause ? { action: "pause", labelKey: "goal.action.pause" } : null;
  }
  if (!STALLED_GOAL_STATUSES.has(goal.status)) return null;
  return {
    action: goal.capabilities.resume ? "resume" : "retry",
    labelKey: "goal.action.resume",
  };
}

function GoalIconButton({
  label,
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button type="button" size="icon-sm" variant="ghost" aria-label={label} title={label} className={className} {...props} />}>
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function GoalPlanCard({ goal, onSnapshot, onOpenPlanArtifact }: GoalPlanCardProps) {
  useI18nSnapshot();
  const runtimeApis = useRuntimeAPIs();
  const presentation = useManagerSnapshot(goalPlanManager);
  const editButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    goalPlanManager.retainClock();
    return () => goalPlanManager.releaseClock();
  }, []);

  const execute = useCallback(async (operation: GoalPlanPendingOperation) => {
    if (!goal) return;
    const result = await goalPlanManager.executeOperation({
      goalsApi: runtimeApis.goals,
      operation,
      onSnapshot,
    });
    if (result.ok) {
      queueMicrotask(() => {
        if (goalPlanManager.takeFocusIntent(goal.runId)) editButtonRef.current?.focus();
      });
    }
  }, [goal, onSnapshot, runtimeApis.goals]);

  const beginAction = useCallback((action: GoalMutationAction, objective: string | null = null) => {
    if (!goal) return;
    const operation = goalPlanManager.beginOperation({
      runId: goal.runId,
      goalId: goal.goalId,
      action,
      baseRevision: goal.revision,
      objective,
    });
    if (operation) void execute(operation);
  }, [execute, goal]);

  if (!goal || !goal.visible || goal.status === "cleared") return null;

  const expanded = presentation.expandedRunIds.has(goal.runId);
  const editing = presentation.editingRunId === goal.runId;
  const pending = presentation.pending?.runId === goal.runId ? presentation.pending : null;
  const statusLabel = t(`goal.status.${goal.status}`);
  const elapsed = elapsedLabel(
    goal.startedAt,
    goal.status === "paused" ? goal.pausedAt : goal.completedAt ?? goal.clearedAt,
    presentation.displayNowMs,
  );
  const runControl = resolveGoalRunControl(goal);
  const errorLabel = presentation.actionError ? t(`goal.error.${presentation.actionError}`) : null;

  const saveEdit = () => {
    const validated = validateGoalObjective(presentation.editDraft);
    if (!validated.ok) {
      goalPlanManager.setActionError("invalid_objective");
      return;
    }
    beginAction("edit", validated.objective);
  };
  const cancelEdit = () => {
    goalPlanManager.cancelEdit(goal.runId);
    queueMicrotask(() => {
      if (goalPlanManager.takeFocusIntent(goal.runId)) editButtonRef.current?.focus();
    });
  };

  return (
    <TooltipProvider>
      <section
        data-testid="goal-plan-card"
        className="relative z-10 mx-auto mb-2 w-full max-w-3xl overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-sm backdrop-blur-sm dark:bg-[#17191d]/95"
        aria-label={t("goal.card.aria")}
      >
        <div className="flex min-h-12 items-center gap-2 px-3 py-2 sm:px-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Target className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-2">
            <span className="block text-xs font-semibold uppercase tracking-wide text-primary" aria-live="polite">
              {statusLabel}
            </span>
            <span className="block min-w-0 truncate text-sm text-foreground sm:flex-1">{goal.objective}</span>
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground" aria-hidden="true">{elapsed}</span>
          <span className="sr-only">{t("goal.elapsed.aria", { duration: elapsed })}</span>

          <div className="hidden items-center gap-0.5 sm:flex">
            <GoalIconButton
              ref={editButtonRef}
              label={t("goal.action.edit")}
              disabled={Boolean(pending)}
              onClick={() => goalPlanManager.beginEdit(goal.runId, goal.objective)}
            >
              <Pencil />
            </GoalIconButton>
            {runControl ? (
              <GoalIconButton
                label={t(runControl.labelKey)}
                disabled={Boolean(pending)}
                onClick={() => beginAction(runControl.action)}
              >
                {runControl.action === "pause" ? <Pause /> : <Play />}
              </GoalIconButton>
            ) : null}
            <GoalIconButton
              label={t("goal.action.clear")}
              disabled={Boolean(pending)}
              onClick={() => goalPlanManager.setClearConfirmation(goal.runId, true)}
            >
              <Trash2 />
            </GoalIconButton>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger render={<Button type="button" size="icon-sm" variant="ghost" className="sm:hidden" aria-label={t("goal.action.more")} title={t("goal.action.more")} />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => goalPlanManager.beginEdit(goal.runId, goal.objective)}>
                <Pencil /> {t("goal.action.edit")}
              </DropdownMenuItem>
              {runControl ? (
                <DropdownMenuItem onClick={() => beginAction(runControl.action)}>
                  {runControl.action === "pause" ? <Pause /> : <Play />} {t(runControl.labelKey)}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem variant="destructive" onClick={() => goalPlanManager.setClearConfirmation(goal.runId, true)}>
                <Trash2 /> {t("goal.action.clear")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <GoalIconButton
            label={t(expanded ? "goal.action.collapse" : "goal.action.expand")}
            aria-expanded={expanded}
            onClick={() => goalPlanManager.toggleExpanded(goal.runId)}
          >
            {expanded ? <ChevronDown /> : <ChevronUp />}
          </GoalIconButton>
        </div>

        {pending ? (
          <div className="flex items-center gap-2 border-t border-border/60 px-4 py-2 text-xs text-muted-foreground" role="status">
            <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" />
            {t("goal.action.pending")}
          </div>
        ) : null}

        {errorLabel ? (
          <div className="flex items-center justify-between gap-3 border-t border-destructive/20 bg-destructive/5 px-4 py-2 text-sm text-destructive" role="alert">
            <span>{errorLabel}</span>
            {presentation.failedOperation ? (
              <Button type="button" size="xs" variant="outline" onClick={() => {
                const retry = goalPlanManager.retryFailed();
                if (retry) void execute(retry);
              }}>
                <RotateCcw /> {t("goal.action.retry")}
              </Button>
            ) : null}
          </div>
        ) : null}

        {goal.lastError ? (
          <div className="border-t border-destructive/20 bg-destructive/5 px-4 py-2 text-sm text-destructive" role="alert">
            {goal.lastError}
          </div>
        ) : null}

        {editing ? (
          <div className="space-y-2 border-t border-border/60 p-3 sm:p-4">
            <label className="text-xs font-medium text-muted-foreground" htmlFor={`goal-objective-${goal.runId}`}>
              {t("goal.edit.label")}
            </label>
            <Textarea
              id={`goal-objective-${goal.runId}`}
              autoFocus
              value={presentation.editDraft}
              placeholder={t("goal.edit.placeholder")}
              aria-invalid={presentation.actionError === "invalid_objective"}
              onChange={(event) => goalPlanManager.setEditDraft(goal.runId, event.currentTarget.value)}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={cancelEdit}>{t("goal.action.cancel")}</Button>
              <Button type="button" onClick={saveEdit} disabled={Boolean(pending)}>{t("goal.action.save")}</Button>
            </div>
          </div>
        ) : null}

        {expanded ? (
          <div className={cn("space-y-3 border-t border-border/60 p-3 sm:p-4", editing && "border-t-0 pt-0")}>
            {goal.planSource.kind === "markdown" ? (
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-muted/40 p-3 text-sm text-foreground">{goal.planSource.markdown}</pre>
            ) : <PlanProgress items={goal.plan} />}
            {goal.planSource.kind === "uri" && onOpenPlanArtifact ? (
              <Button type="button" size="sm" variant="outline" onClick={() => onOpenPlanArtifact(goal.planSource.kind === "uri" ? goal.planSource.uri : "")}>
                {t("goal.plan.openArtifact")}
              </Button>
            ) : null}
            {goal.status === "error" || goal.status === "limited" ? (
              <Button type="button" size="sm" variant="outline" disabled={Boolean(pending)} onClick={() => beginAction("retry")}>
                <RotateCcw /> {t("goal.action.retry")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>

      <Dialog
        open={presentation.confirmingClearRunId === goal.runId}
        onOpenChange={(open) => goalPlanManager.setClearConfirmation(goal.runId, open)}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("goal.clear.title")}</DialogTitle>
            <DialogDescription>{t("goal.clear.description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => goalPlanManager.setClearConfirmation(goal.runId, false)}>
              {t("goal.action.cancel")}
            </Button>
            <Button type="button" variant="destructive" onClick={() => beginAction("clear")}>
              {t("goal.clear.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
