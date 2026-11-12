import React, { memo, useEffect, useMemo, useRef } from "react";
import { ArrowRightLeft, Brain, CirclePause, Clock, Coffee, Inbox, MessageSquare, Search, type LucideIcon } from "lucide-react";
import type { AgentSnapshot } from "@/interface/home/types";
import { WORKER_OPTIONS } from "@/interface/home/constants";
import { getWorkerRuntimeLabel, type ConversationWorkerRecord } from "@/lib/conversation-workers";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ACTIVITY_ICONS } from "./activity-icons";
import { AgentAvatar } from "./AgentAvatar";
import { deriveWorkerRecordActivity } from "./deriveAgentActivity";
import { focusConversationComposer } from "./focus-composer";
import {
  buildOfficeLayout,
  describeDeskRelations,
  type DeskRelationBadge,
  type OfficeSeat,
} from "./office-model";
import { MAIN_DESK_ID, officeRelationsManager, type OfficeRelationKind } from "./OfficeRelationsManager";
import { OfficeStatusStrip } from "./OfficeStatusStrip";
import { workerActivityManager } from "./WorkerActivityManager";
import { supervisorActivityManager, supervisorActivityOf, type SupervisorActivity } from "./SupervisorActivityManager";

const MAIN_AVATAR_SEED = "omniharness-main-conversation";

const SUPERVISOR_ICONS: Record<SupervisorActivity, LucideIcon> = {
  idle: MessageSquare,
  thinking: Brain,
  scheduled: Clock,
  stopped: CirclePause,
};

const RELATION_ICONS: Record<OfficeRelationKind, LucideIcon> = {
  delegated: Inbox,
  handoff: ArrowRightLeft,
  review: Search,
};

function agentTypeLabel(type: string | undefined) {
  if (!type) return null;
  return WORKER_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

function bubbleGlyph(seat: OfficeSeat) {
  if (seat.activity === "waiting_user") return "?";
  if (seat.activity === "quota_blocked") return "zZ";
  if (seat.activity === "blocked" || seat.activity === "errored") return "!";
  return null;
}

function relationLabel(badge: DeskRelationBadge) {
  return t(`office.relation.${badge.kind}.${badge.direction}`, { number: badge.counterpartNumber ?? "" });
}

function withRelations(base: string, badges: DeskRelationBadge[]) {
  if (badges.length === 0) return base;
  return t("office.desk.withRelations", { desk: base, relations: badges.map(relationLabel).join("; ") });
}

function RelationBadges({ badges, animate }: { badges: DeskRelationBadge[]; animate: boolean }) {
  if (badges.length === 0) return null;
  return (
    <span className="flex w-full flex-col items-stretch gap-0.5" aria-hidden="true">
      {badges.map((badge) => {
        const Icon = RELATION_ICONS[badge.kind];
        return (
          <span
            key={`${badge.kind}-${badge.direction}-${badge.counterpartNumber ?? "main"}`}
            className="office-relation flex items-center justify-center gap-1 truncate rounded-sm border border-primary/40 bg-primary/5 px-1 text-[10px] text-foreground"
            data-direction={badge.direction}
            data-animate={animate ? "true" : "false"}
          >
            <Icon className="office-relation-icon h-3 w-3 shrink-0" />
            <span className="truncate">{relationLabel(badge)}</span>
          </span>
        );
      })}
    </span>
  );
}

export interface OfficeViewProps {
  workers: ConversationWorkerRecord[];
  agentsById: ReadonlyMap<string, AgentSnapshot>;
  onFocusWorker: (workerId: string) => void;
}

/**
 * Spatial view of the active workers: one desk per worker plus the main
 * conversation desk, grouped into rooms by role once the office is busy.
 * Every desk is a real button whose accessible name carries the full state
 * and any delegation, handoff, or review it is part of; a polite live region
 * announces only the workers that need the user.
 */
export const OfficeView = memo(function OfficeView({ workers, agentsById, onFocusWorker }: OfficeViewProps) {
  useI18nSnapshot();
  const streamActivityByWorker = useManagerSnapshot(workerActivityManager);
  const relationsByKey = useManagerSnapshot(officeRelationsManager);
  const supervisorByRun = useManagerSnapshot(supervisorActivityManager);
  const supervisorActivity = supervisorActivityOf(workers[0]?.runId ? supervisorByRun[workers[0].runId] : undefined);
  const rootRef = useRef<HTMLDivElement>(null);

  const layout = useMemo(() => buildOfficeLayout(workers.map((worker) => ({
    worker,
    activity: deriveWorkerRecordActivity(worker, agentsById.get(worker.id), streamActivityByWorker[worker.id]?.activity),
  }))), [workers, agentsById, streamActivityByWorker]);

  const relations = useMemo(() => Object.values(relationsByKey), [relationsByKey]);
  const deskNumbers = useMemo(
    () => new Map(layout.kind === "office" ? layout.seats.map((seat) => [seat.worker.id, seat.displayNumber] as const) : []),
    [layout],
  );

  // Pause every animation while the office is offscreen or the page is hidden
  // (including a suspended mobile app). This toggles a DOM attribute read by
  // CSS; it never touches React state.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let intersecting = true;
    const apply = () => {
      const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
      root.dataset.paused = String(hidden || !intersecting);
    };
    const observer = typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver((records) => {
        intersecting = records.some((record) => record.isIntersecting);
        apply();
      });
    observer?.observe(root);
    document.addEventListener("visibilitychange", apply);
    apply();
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", apply);
    };
  }, [layout.kind]);

  if (layout.kind === "strip") {
    return (
      <div className="space-y-2">
        <p className="px-1 text-xs text-muted-foreground">{t("office.tooMany", { count: workers.length })}</p>
        <OfficeStatusStrip workers={workers} agentsById={agentsById} onFocusWorker={onFocusWorker} />
      </div>
    );
  }

  const describeSeat = (seat: OfficeSeat) => {
    const worker = t("office.strip.workerLabel", { number: seat.displayNumber });
    const activity = t(`office.activity.${seat.activity}`);
    const type = agentTypeLabel(seat.worker.type) ?? "";
    const runtime = getWorkerRuntimeLabel(seat.worker);
    return { worker, activity, type, runtime };
  };

  const attentionAnnouncement = layout.seats
    .filter((seat) => seat.attention)
    .map((seat) => {
      const { worker, activity } = describeSeat(seat);
      return t("office.live.attention", { worker, activity });
    })
    .join(". ");

  const mainBadges = describeDeskRelations(MAIN_DESK_ID, relations, deskNumbers);
  const SupervisorIcon = SUPERVISOR_ICONS[supervisorActivity];
  const mainStatus = supervisorActivity === "idle" ? t("office.main.hint") : t(`office.main.state.${supervisorActivity}`);
  const mainAria = supervisorActivity === "idle"
    ? t("office.main.aria")
    : t("office.main.ariaWithState", { state: t(`office.main.state.${supervisorActivity}`) });
  const showRoomHeadings = layout.rooms.length > 1;

  const renderDesk = (seat: OfficeSeat) => {
    const { worker, activity, type, runtime } = describeSeat(seat);
    const Icon = ACTIVITY_ICONS[seat.activity];
    const glyph = bubbleGlyph(seat);
    const badges = describeDeskRelations(seat.worker.id, relations, deskNumbers);
    const baseLabel = runtime
      ? t("office.desk.ariaWithRuntime", { worker, type, activity, runtime })
      : t("office.desk.aria", { worker, type, activity });
    const ariaLabel = withRelations(baseLabel, badges);
    return (
      <li key={seat.worker.id}>
        <button
          type="button"
          className={cn(
            "office-desk relative flex w-full flex-col items-center gap-1 rounded-lg border px-2 pb-2 pt-4 text-center transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none",
            seat.attention
              ? "border-destructive/60 bg-destructive/5"
              : badges.length > 0
                ? "border-primary/50 bg-background"
                : "border-border/70 bg-background",
          )}
          data-activity={seat.activity}
          data-animate={seat.animate ? "true" : "false"}
          data-related={badges.length > 0 ? "true" : "false"}
          aria-label={ariaLabel}
          title={ariaLabel}
          onClick={() => onFocusWorker(seat.worker.id)}
        >
          {glyph ? (
            <span
              aria-hidden="true"
              className={cn(
                "office-bubble absolute right-2 top-1 rounded-full border px-1.5 text-[11px] font-bold leading-4",
                seat.attention ? "border-destructive/60 bg-background text-destructive" : "border-border bg-background",
              )}
            >
              {glyph}
            </span>
          ) : null}
          <span className="office-figure">
            <AgentAvatar seed={seat.worker.id} agentType={seat.worker.type} className="h-12 w-10" />
          </span>
          <span className="office-monitor flex h-6 w-14 items-center justify-center rounded-sm border border-border bg-muted">
            <Icon aria-hidden="true" className={cn("h-3.5 w-3.5", seat.attention ? "text-destructive" : "text-muted-foreground")} />
          </span>
          <span className="w-full truncate text-xs font-medium">{worker}</span>
          <span className={cn("w-full truncate text-[11px]", seat.attention ? "font-semibold text-foreground" : "text-muted-foreground")}>
            {activity}
          </span>
          <span className="w-full truncate text-[10px] text-muted-foreground">
            {[type, runtime].filter(Boolean).join(" · ")}
          </span>
          <RelationBadges badges={badges} animate={seat.animate} />
        </button>
      </li>
    );
  };

  return (
    <div ref={rootRef} className="office-root space-y-3" role="region" aria-label={t("office.region.aria")}>
      <button
        type="button"
        className={cn(
          "office-main-desk flex w-full items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none",
          mainBadges.length > 0 || supervisorActivity === "thinking" ? "border-primary/50" : "border-border/70",
        )}
        data-supervisor={supervisorActivity}
        aria-label={withRelations(mainAria, mainBadges)}
        title={t("office.main.hint")}
        onClick={() => focusConversationComposer()}
      >
        <span className="relative shrink-0">
          <span className="office-figure">
            <AgentAvatar seed={MAIN_AVATAR_SEED} className="h-10 w-8" />
          </span>
          {supervisorActivity === "thinking" ? (
            <span aria-hidden="true" className="office-thought absolute -right-2 -top-1 flex gap-0.5 rounded-full border border-border bg-background px-1 py-0.5">
              <span className="office-thought-dot h-1 w-1 rounded-full bg-muted-foreground" />
              <span className="office-thought-dot h-1 w-1 rounded-full bg-muted-foreground" />
              <span className="office-thought-dot h-1 w-1 rounded-full bg-muted-foreground" />
            </span>
          ) : null}
        </span>
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="block truncate text-xs font-semibold">{t("office.main.label")}</span>
          <span className={cn("block truncate text-[11px]", supervisorActivity === "idle" ? "text-muted-foreground" : "font-medium text-foreground")}>
            {mainStatus}
          </span>
          <RelationBadges badges={mainBadges} animate={mainBadges.length > 0} />
        </span>
        <SupervisorIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {layout.rooms.map((group) => (
        <section
          key={group.room}
          className={cn(showRoomHeadings && "space-y-1.5 rounded-lg border border-border/50 p-2")}
          aria-label={showRoomHeadings ? t(`office.room.${group.room}`) : undefined}
        >
          {showRoomHeadings ? (
            <h4 className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t(`office.room.${group.room}`)}
            </h4>
          ) : null}
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(7.25rem,1fr))] gap-2">
            {group.seats.map(renderDesk)}
          </ul>
        </section>
      ))}

      {layout.breakRoom.length > 0 ? (
        <details className="rounded-lg border border-dashed border-border/70 px-3 py-2 text-xs">
          <summary className="flex cursor-pointer items-center gap-2 text-muted-foreground">
            <Coffee aria-hidden="true" className="h-3.5 w-3.5" />
            {t("office.breakRoom", { count: layout.breakRoom.length })}
          </summary>
          <div className="mt-2">
            <OfficeStatusStrip
              workers={layout.breakRoom.map((seat) => seat.worker)}
              agentsById={agentsById}
              onFocusWorker={onFocusWorker}
            />
          </div>
        </details>
      ) : null}

      <div className="sr-only" aria-live="polite" aria-atomic="true">{attentionAnnouncement}</div>
    </div>
  );
});
