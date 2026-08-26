"use client";

import React, { useEffect } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  ListChecks,
  LoaderCircle,
} from "lucide-react";
import {
  acpPlanPresentationManager,
} from "@/interface/home/AcpPlanPresentationManager";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import type {
  AcpPlanItem,
  AcpPlanItemStatus,
  AcpPlanPriority,
  PlanSurfaceOwner,
  WorkerPlanSnapshot,
} from "@/shared/acp-plan";

const STATUS_KEYS: Record<AcpPlanItemStatus, string> = {
  pending: "conversation.plan.status.pending",
  in_progress: "conversation.plan.status.inProgress",
  completed: "conversation.plan.status.completed",
};

const PRIORITY_KEYS: Record<AcpPlanPriority, string> = {
  high: "conversation.plan.priority.high",
  medium: "conversation.plan.priority.medium",
  low: "conversation.plan.priority.low",
};

function PlanStatusIcon({ status }: { status: AcpPlanItemStatus }) {
  if (status === "completed") {
    return <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />;
  }
  if (status === "in_progress") {
    return <LoaderCircle className="size-3.5 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />;
  }
  return <Circle className="size-3.5 text-muted-foreground/65" aria-hidden="true" />;
}

function PlanItemRow({ item }: { item: AcpPlanItem }) {
  return (
    <li className="flex min-w-0 items-center gap-1.5 py-1">
      <PlanStatusIcon status={item.status} />
      <span className={cn(
        "min-w-0 truncate text-sm leading-5 text-foreground",
        item.status === "completed" && "text-muted-foreground line-through decoration-muted-foreground/45",
      )}>
        {item.content}
      </span>
      <span className="sr-only">{t(STATUS_KEYS[item.status])}</span>
      <span className="sr-only">{t(PRIORITY_KEYS[item.priority])}</span>
    </li>
  );
}

export function getAcpPlanAnnouncementKey(plan: WorkerPlanSnapshot) {
  return String(plan.lastAcceptedEntryId ?? plan.lastEntrySeq);
}

export function AcpPlanWidgetContent({
  plan,
  expanded,
  completionPhase = "idle",
  onToggle,
}: {
  plan: WorkerPlanSnapshot;
  expanded: boolean;
  completionPhase?: "idle" | "celebrating" | "fading";
  onToggle: () => void;
}) {
  useI18nSnapshot();
  const completed = plan.items.filter((item) => item.status === "completed").length;
  const total = plan.items.length;
  const progressText = t("conversation.plan.progress", { completed, total });
  const activeItem = plan.items.find((item) => item.status === "in_progress")
    ?? plan.items.find((item) => item.status === "pending")
    ?? null;
  const announcementKey = getAcpPlanAnnouncementKey(plan);
  const summary = (
    <>
      <span id="acp-plan-title" className="flex shrink-0 items-center gap-1 text-sm font-medium text-foreground">
        <ListChecks className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
        {t("conversation.plan.title")}
      </span>
      <span
        key={announcementKey}
        data-plan-announcement={announcementKey}
        className="shrink-0 text-xs tabular-nums text-muted-foreground"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {progressText}
      </span>
      {!expanded && activeItem ? (
        <span className="flex min-w-0 flex-1 items-center gap-1.5 border-l border-border/70 pl-2 text-sm text-foreground">
          {activeItem.status === "in_progress" ? <PlanStatusIcon status={activeItem.status} /> : null}
          <span className="min-w-0 truncate">{activeItem.content}</span>
        </span>
      ) : total === 0 ? (
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {t("conversation.plan.empty")}
        </span>
      ) : (
        <span className="min-w-0 flex-1" />
      )}
    </>
  );

  return (
    <section
      className={cn(
        "mx-auto mb-0.5 w-full max-w-3xl rounded-2xl border border-border/70 bg-muted/15",
        completionPhase === "fading" && "pointer-events-none opacity-0 transition-opacity duration-300 ease-out motion-reduce:transition-none",
      )}
      aria-labelledby="acp-plan-title"
      data-testid="acp-plan-widget"
      data-plan-completion={completionPhase}
    >
      {total > 0 ? (
        <button
          type="button"
          data-testid="acp-plan-surface-trigger"
          aria-expanded={expanded}
          aria-controls="acp-plan-steps"
          aria-label={t(expanded ? "conversation.plan.collapse" : "conversation.plan.expand")}
          title={t(expanded ? "conversation.plan.collapse" : "conversation.plan.expand")}
          onClick={onToggle}
          className="flex min-h-6 w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-2xl text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset px-2 py-1.5"
        >
          {summary}
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 transition-transform duration-150 ease-out motion-reduce:transition-none",
              expanded && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
      ) : (
        <div className="flex min-h-6 min-w-0 items-center gap-1.5 px-2 py-1.5">
          {summary}
        </div>
      )}

      {expanded && total > 0 ? (
        <ol id="acp-plan-steps" className="mx-2 border-t border-border/60 pt-1">
          {plan.items.map((item) => <PlanItemRow key={item.id} item={item} />)}
        </ol>
      ) : null}
    </section>
  );
}

export function AcpPlanWidget({ owner }: { owner: PlanSurfaceOwner }) {
  const presentation = useManagerSnapshot(acpPlanPresentationManager);
  const currentPlanKey = owner.plan ? getAcpPlanAnnouncementKey(owner.plan) : null;
  const isComplete = Boolean(
    owner.plan?.visible
    && owner.plan.items.length > 0
    && owner.plan.items.every((item) => item.status === "completed"),
  );
  useEffect(() => {
    acpPlanPresentationManager.setOwner(
      owner.ownsWidget ? owner.runId : null,
      owner.ownsWidget ? owner.workerId : null,
    );
  }, [owner.ownsWidget, owner.runId, owner.workerId]);
  useEffect(() => {
    if (owner.ownsWidget && owner.runId && owner.workerId && owner.plan?.visible && currentPlanKey) {
      acpPlanPresentationManager.syncCompletion(owner.runId, owner.workerId, currentPlanKey, isComplete);
      return;
    }
    if (owner.ownsWidget && owner.runId && owner.workerId) {
      acpPlanPresentationManager.syncCompletion(owner.runId, owner.workerId, "", false);
    }
  }, [currentPlanKey, isComplete, owner.ownsWidget, owner.plan?.visible, owner.runId, owner.workerId]);

  if (!owner.ownsWidget || !owner.runId || !owner.workerId || !owner.plan?.visible) return null;
  const currentOwnerKey = `${owner.runId}/${owner.workerId}`;
  const completionPhase = currentPlanKey
    ? acpPlanPresentationManager.getCompletionPhase(owner.runId, owner.workerId, currentPlanKey)
    : "idle";
  if (completionPhase === "dismissed") return null;
  const expanded = completionPhase === "celebrating" || completionPhase === "fading"
    ? true
    : presentation.ownerKey === currentOwnerKey && presentation.expanded;
  return (
    <AcpPlanWidgetContent
      plan={owner.plan}
      expanded={expanded}
      completionPhase={completionPhase}
      onToggle={() => acpPlanPresentationManager.toggle(owner.runId!, owner.workerId!)}
    />
  );
}
