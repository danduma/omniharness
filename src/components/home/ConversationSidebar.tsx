import type React from "react";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { Archive, Bug, ChevronDown, Folder, FolderInput, FolderPlus, GitCommitHorizontal, GripVertical, ListChevronsDownUp, LoaderCircle, LogOut, Moon, MoreHorizontal, PanelLeftClose, Pencil, Pin, PinOff, Play, Plus, Search, Settings, Smartphone, SquareTerminal, Sun, Trash2, TriangleAlert, Wand2, X } from "lucide-react";
import type { ConversationSidebarTab } from "@/interface/home/types";
import type { ProjectDropPlacement } from "@/interface/home/utils";
import { Button } from "@/components/ui/button";
import { requestBugDropOpen } from "@/components/BugDropBootstrap";
import { Collapsible, CollapsibleTrigger, COLLAPSIBLE_PANEL_CLOSED_CLASS, COLLAPSIBLE_PANEL_OPEN_CLASS, COLLAPSIBLE_PANEL_TRANSITION_CLASS } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { OmniHarnessMark } from "@/components/OmniHarnessMark";
import { CliBrandIcon } from "@/components/cli-brand-icons";
import { centeredScrollTop, clampScrollTop } from "@/components/home/conversation-sidebar-scroll";
import { PRODUCT_NAME, PROJECT_SESSION_DISPLAY_BATCH_SIZE } from "@/interface/home/constants";
import { mobileConversationSwipeManager } from "@/interface/home/MobileConversationSwipeManager";
import { RunnerControls } from "@/interface/runners/RunnerControls";
import type { RunnerConnectionStatus } from "@/interface/runners/RunnerConnection";
import type { PinnedItemsSnapshot } from "@/interface/runners/PinnedItemsManager";
import { useOptionalRunnerRegistryContext } from "@/interface/runners/RunnerRegistryProvider";
import type { RunnerRegistrySnapshot } from "@/interface/runners/RunnerRegistry";
import { runnerStatusMessageKey } from "@/interface/runners/RunnerUiManager";
import { runnerStatusTone } from "@/interface/runners/RunnerSwitcher";
import { filterConversationGroupsBySearch } from "@/lib/conversations";
import { isRunUnread, resolveRunLatestUnreadTimestamp } from "@/lib/conversation-state";
import { getConversationVisualKind, type ConversationVisualKind } from "@/lib/conversation-visuals";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { isArchivableRunStatus, isTerminalRunStatus, normalizeRunStatus } from "@/lib/run-status";
import { cn } from "@/lib/utils";
import { StateManager } from "@/lib/state-manager";
import { useManagerSelector, useManagerSnapshot } from "@/lib/use-manager-snapshot";
import type { SidebarGroup, SidebarRun } from "@/interface/home/types";

export type ProjectPresetCommandMenuItem = { id: string; name: string };

class ConversationSidebarHydrationManager extends StateManager<boolean> {
  constructor() {
    super(false);
  }

  markMounted() {
    this.update(true);
  }
}

const conversationSidebarHydrationManager = new ConversationSidebarHydrationManager();

type ConversationSidebarSurface = "desktop" | "mobile";

/**
 * The mobile drawer renders in a portal outside `#root`, so it misses the
 * root's safe-area padding and would draw under the status bar and gesture bar
 * of an edge-to-edge installed app. The sidebar pads itself instead of the
 * sheet so the inset strips keep the sidebar's own background.
 */
const MOBILE_DRAWER_SAFE_AREA_CLASS = "pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)]";

class ConversationSidebarScrollManager extends StateManager<{
  scrollTopBySurface: Partial<Record<ConversationSidebarSurface, number>>;
}> {
  constructor() {
    super({ scrollTopBySurface: {} });
  }

  getScrollTop(surface: ConversationSidebarSurface) {
    return this.getSnapshot().scrollTopBySurface[surface];
  }

  setScrollTop(surface: ConversationSidebarSurface, scrollTop: number) {
    this.setKey("scrollTopBySurface", (current) => (
      current[surface] === scrollTop
        ? current
        : { ...current, [surface]: scrollTop }
    ));
  }
}

const conversationSidebarScrollManager = new ConversationSidebarScrollManager();

function findConversationRunRow(viewport: HTMLElement, runId: string) {
  return Array.from(viewport.querySelectorAll<HTMLElement>("[data-conversation-run-id]"))
    .find((row) => row.dataset.conversationRunId === runId) ?? null;
}

/**
 * Centring via `scrollIntoView` also scrolls every scrollable ancestor (the
 * drawer, the document) and rounds against the row's animated position, so the
 * offset is measured here and written to the list viewport alone.
 */
function centeredScrollTopForRow(viewport: HTMLElement, row: HTMLElement) {
  return centeredScrollTop({
    scrollHeight: viewport.scrollHeight,
    clientHeight: viewport.clientHeight,
    rowTop: row.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop,
    rowHeight: row.offsetHeight,
  });
}

type ProjectDragState = {
  /**
   * `dataTransfer` payloads are unreadable during dragover, so the dragged path
   * is tracked here — without it the row being dragged would draw an insertion
   * line against itself.
   */
  draggingPath: string | null;
  dropPath: string | null;
  dropPlacement: ProjectDropPlacement | null;
};

const PROJECT_DRAG_IDLE: ProjectDragState = { draggingPath: null, dropPath: null, dropPlacement: null };

class ProjectDragManager extends StateManager<ProjectDragState> {
  constructor() {
    super(PROJECT_DRAG_IDLE);
  }

  beginDrag(path: string) {
    this.update({ ...PROJECT_DRAG_IDLE, draggingPath: path });
  }

  setDropTarget(path: string, placement: ProjectDropPlacement) {
    this.update((current) => (
      current.dropPath === path && current.dropPlacement === placement
        ? current
        : { ...current, dropPath: path, dropPlacement: placement }
    ));
  }

  clearDropTarget(path?: string) {
    this.update((current) => (
      path !== undefined && current.dropPath !== path
        ? current
        : { ...current, dropPath: null, dropPlacement: null }
    ));
  }

  reset() {
    this.update(PROJECT_DRAG_IDLE);
  }
}

const projectDragManager = new ProjectDragManager();
const PROJECT_DRAG_DATA_TYPE = "application/x-omniharness-project-path";

type ConversationVisualIconProps = {
  className?: string;
} & React.SVGProps<SVGSVGElement>;

const CONVERSATION_VISUAL_CONFIG: Record<ConversationVisualKind, {
  label: string;
  Icon: React.ComponentType<ConversationVisualIconProps>;
  className: string;
}> = {
  supervisor: {
    label: "Supervisor",
    Icon: OmniHarnessLogoGlyph,
    className: "border-[#c88b45]/30 bg-[#c88b45]/12 text-[#9e5f18] dark:border-[#f0b15d]/25 dark:bg-[#f0b15d]/10 dark:text-[#f0b15d]",
  },
  direct: {
    label: "Direct control",
    Icon: SquareTerminal,
    className: "border-[#6688a0]/25 bg-[#6688a0]/10 text-[#4d6f87] dark:border-[#9fc8df]/25 dark:bg-[#9fc8df]/10 dark:text-[#9fc8df]",
  },
  commit: {
    label: "Commit",
    Icon: GitCommitHorizontal,
    className: "border-[#ad8247]/30 bg-[#ad8247]/10 text-[#846233] dark:border-[#e2b36b]/25 dark:bg-[#e2b36b]/10 dark:text-[#e2b36b]",
  },
};

function OmniHarnessLogoGlyph({ className, ...props }: ConversationVisualIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <g fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="butt" strokeLinejoin="miter">
        <path d="M6.5 28A25.8 25.8 0 0 1 57.5 28" />
        <path d="M57.5 36A25.8 25.8 0 0 1 6.5 36" />
        <path d="M23 24v16" />
        <path d="M41 24v16" />
        <path d="M26.417 32L37.466 32" />
      </g>
    </svg>
  );
}

type PinnedMachine = {
  name: string;
  status: RunnerConnectionStatus;
};

/**
 * Hover actions normally sit invisible but still take their width, which on a
 * pinned row leaves no room for both the name and the machine. On desktop the
 * machine label and the actions trade places instead: the label shows at rest,
 * the actions on hover, keyboard focus, or while a row menu is open.
 */
const PINNED_MACHINE_AT_REST_CLASS = "lg:group-hover:hidden lg:group-has-focus-visible:hidden lg:group-has-data-popup-open:hidden";
const PINNED_ACTIONS_ON_HOVER_CLASS = "lg:hidden lg:group-hover:flex lg:group-has-focus-visible:flex lg:group-has-data-popup-open:flex";

function PinnedMachineLabel({ machine, className }: { machine: PinnedMachine; className?: string }) {
  const statusLabel = t(runnerStatusMessageKey(machine.status));
  return (
    <span
      data-pinned-machine={machine.name}
      className={cn("flex min-w-0 max-w-[45%] shrink items-center gap-1.5 text-xs font-normal text-muted-foreground", className)}
      title={t("conversation.sidebar.pinnedMachine", { server: machine.name, status: statusLabel })}
    >
      <span className="truncate">{machine.name}</span>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", runnerStatusTone(machine.status))} aria-hidden="true" />
      <span className="sr-only">{statusLabel}</span>
    </span>
  );
}

const ROW_MENU_TRIGGER_CLASS = "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sm font-medium text-muted-foreground opacity-100 transition-colors ring-offset-background hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 lg:opacity-0 lg:group-hover:opacity-100";

/**
 * Touch has no hover, so on the mobile drawer pinning lives in the row's
 * overflow menu instead of a button that would always be on screen.
 */
function PinMenuItem({ pinned, label, onToggle }: { pinned: boolean; label: string; onToggle: () => void }) {
  return (
    <DropdownMenuItem
      className="cursor-pointer whitespace-nowrap"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      {pinned ? <PinOff className="mr-2 h-4 w-4" /> : <Pin className="mr-2 h-4 w-4" />} {label}
    </DropdownMenuItem>
  );
}

function PinOnlyMenu({ pinned, label, onToggle, triggerLabel }: { pinned: boolean; label: string; onToggle: () => void; triggerLabel?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={(event) => event.stopPropagation()}
        className={ROW_MENU_TRIGGER_CLASS}
        aria-label={triggerLabel}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-28">
        <PinMenuItem pinned={pinned} label={label} onToggle={onToggle} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PinToggleButton({ pinned, label, onToggle }: { pinned: boolean; label: string; onToggle: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground opacity-100 hover:text-foreground lg:opacity-0 lg:group-hover:opacity-100"
          aria-label={label}
          aria-pressed={pinned}
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
        >
          {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

function isSidebarRunUnread(run: SidebarRun, latestMessageAt: string | null, lastReadAt: string | null) {
  return isRunUnread({
    latestMessageAt: resolveRunLatestUnreadTimestamp(run, latestMessageAt),
    lastReadAt,
  });
}

type RunRowActions = {
  /** True on the touch drawer, where pinning moves into the overflow menu. */
  pinsInMenu: boolean;
  selectRun: (runId: string) => void;
  renamingRunId: string | null;
  renameValue: string;
  renameSource: "sidebar" | "topbar" | null;
  setRenameValue: (value: string) => void;
  startRenamingRun: (run: SidebarRun) => void;
  startMovingRun: (run: SidebarRun) => void;
  commitRenamingRun: (runId: string) => void;
  cancelRenamingRun: () => void;
  archiveRun: (run: SidebarRun) => void;
  deleteRun: (run: SidebarRun) => void;
};

interface ConversationRunRowProps {
  run: SidebarRun;
  selected: boolean;
  unread: boolean;
  /**
   * Set for a session on another server: opening it switches servers, and the
   * per-conversation actions are left out because they would otherwise act on
   * the server on screen.
   */
  openRemote: (() => void) | null;
  pin: { pinned: boolean; toggle: () => void } | null;
  machine: PinnedMachine | null;
  actions: RunRowActions;
}

function ConversationRunRow({ run, selected, unread, openRemote, pin, machine, actions }: ConversationRunRowProps) {
  const {
    pinsInMenu,
    selectRun,
    renamingRunId,
    renameValue,
    renameSource,
    setRenameValue,
    startRenamingRun,
    startMovingRun,
    commitRenamingRun,
    cancelRenamingRun,
    archiveRun,
    deleteRun,
  } = actions;
  const remote = openRemote !== null;
  const visualKind = getConversationVisualKind(run);
  const isCommitConversation = visualKind === "commit";
  const canArchiveConversation = !remote && isArchivableRunStatus(run.status);
  const canMoveConversation = isTerminalRunStatus(run.status);
  const normalizedRunStatus = normalizeRunStatus(run.status);
  const showCompletedAttentionIndicator = normalizedRunStatus === "done" && unread;
  const showAwaitingUserIndicator = normalizedRunStatus === "awaiting_user";
  const showUnreadIndicator = unread && !showAwaitingUserIndicator;
  const statusIndicatorLabel = showAwaitingUserIndicator
    ? t("conversation.sidebar.status.awaitingUser")
    : showCompletedAttentionIndicator
      ? t("conversation.sidebar.status.completedAttention")
      : unread
        ? t("conversation.sidebar.status.unread")
        : null;
  const visualConfig = CONVERSATION_VISUAL_CONFIG[visualKind];
  const ConversationIcon = visualConfig.Icon;
  const pinLabel = pin ? t(pin.pinned ? "conversation.sidebar.unpinSession" : "conversation.sidebar.pinSession") : "";

  return (
    <div
      data-conversation-run-id={run.id}
      onClick={() => (openRemote ? openRemote() : selectRun(run.id))}
      onDoubleClick={(event) => {
        if (remote) return;
        const target = event.target;
        if (target instanceof Element && target.closest("button,input,textarea,select,a")) {
          return;
        }
        event.preventDefault();
        startRenamingRun(run);
      }}
      className={cn(
        "group flex min-w-0 cursor-pointer overflow-hidden rounded-xl py-1.5 pl-2.5 pr-2 text-sm transition-colors",
        selected
          ? "bg-[#e2e1df] text-[#1f1f1f] dark:bg-white/[0.08] dark:text-zinc-100"
          : "text-[#424242] hover:bg-[#e8e7e5] hover:text-[#1f1f1f] dark:text-zinc-300 dark:hover:bg-white/[0.045] dark:hover:text-zinc-100",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="min-w-0 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="inline-flex h-5 w-3 shrink-0 items-center justify-center">
              {showAwaitingUserIndicator && statusIndicatorLabel ? (
                <span
                  className="inline-flex h-4 w-4 items-center justify-center text-amber-500"
                  aria-label={statusIndicatorLabel}
                  role="img"
                  title={statusIndicatorLabel}
                >
                  <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              ) : null}
              {showUnreadIndicator && statusIndicatorLabel ? (
                <span
                  className="h-2 w-2 rounded-full bg-sky-300"
                  aria-label={statusIndicatorLabel}
                  role="img"
                  title={statusIndicatorLabel}
                />
              ) : null}
            </span>
            <span
              className={cn("inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border", visualConfig.className)}
              title={t("conversation.sidebar.conversationVisual", { kind: visualConfig.label })}
              aria-label={t("conversation.sidebar.conversationVisual", { kind: visualConfig.label })}
            >
              {visualKind === "direct" ? (
                <CliBrandIcon workerType={run.preferredWorkerType ?? null} className={run.preferredWorkerType === "opencode" ? "h-3 w-3" : "h-3.5 w-3.5"} />
              ) : (
                <ConversationIcon className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </span>
            {!remote && renamingRunId === run.id && renameSource !== "topbar" ? (
              <Input
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitRenamingRun(run.id);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    cancelRenamingRun();
                  }
                }}
                onBlur={() => commitRenamingRun(run.id)}
                autoFocus
                className="h-7 min-w-0 text-[13px]"
              />
            ) : (
              <span className="truncate text-[13px]">{run.title}</span>
            )}
          </div>
          <div className="flex min-w-0 shrink-0 items-center gap-1">
            {machine ? <PinnedMachineLabel machine={machine} className={cn("max-w-[7rem]", PINNED_MACHINE_AT_REST_CLASS)} /> : null}
            {run.status === "running" ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin text-muted-foreground motion-reduce:animate-none" />
            ) : null}
            <span className={cn("flex shrink-0 items-center gap-1", machine && PINNED_ACTIONS_ON_HOVER_CLASS)}>
            {pin && !pinsInMenu ? (
              <PinToggleButton pinned={pin.pinned} label={pinLabel} onToggle={pin.toggle} />
            ) : null}
            {canArchiveConversation && isCommitConversation ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-muted-foreground opacity-100 hover:text-foreground lg:opacity-0 lg:group-hover:opacity-100"
                aria-label={t("conversation.sidebar.archiveConversation", { title: run.title })}
                title={t("conversation.sidebar.archiveConversation", { title: run.title })}
                onClick={(event) => {
                  event.stopPropagation();
                  archiveRun(run);
                }}
              >
                <Archive className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            {remote ? (
              pin && pinsInMenu ? (
                <PinOnlyMenu
                  pinned={pin.pinned}
                  label={pinLabel}
                  onToggle={pin.toggle}
                  triggerLabel={t("conversation.sidebar.conversationActions", { title: run.title })}
                />
              ) : null
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger
                  onClick={(event) => event.stopPropagation()}
                  className={ROW_MENU_TRIGGER_CLASS}
                  aria-label={t("conversation.sidebar.conversationActions", { title: run.title })}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-28">
                  {pin && pinsInMenu ? (
                    <PinMenuItem pinned={pin.pinned} label={pinLabel} onToggle={pin.toggle} />
                  ) : null}
                  <DropdownMenuItem
                    className="cursor-pointer whitespace-nowrap"
                    onClick={(event) => {
                      event.stopPropagation();
                      startRenamingRun(run);
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" /> {t("conversation.sidebar.rename")}
                  </DropdownMenuItem>
                  {canMoveConversation ? (
                    <DropdownMenuItem
                      className="cursor-pointer whitespace-nowrap"
                      onClick={(event) => {
                        event.stopPropagation();
                        startMovingRun(run);
                      }}
                    >
                      <FolderInput className="mr-2 h-4 w-4" /> {t("conversation.sidebar.moveToProject")}
                    </DropdownMenuItem>
                  ) : null}
                  {canArchiveConversation ? (
                    <DropdownMenuItem
                      className="cursor-pointer whitespace-nowrap"
                      onClick={(event) => {
                        event.stopPropagation();
                        archiveRun(run);
                      }}
                    >
                      <Archive className="mr-2 h-4 w-4" /> {t("conversation.sidebar.archive")}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    variant="destructive"
                    className="cursor-pointer whitespace-nowrap"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteRun(run);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> {t("conversation.sidebar.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

type PinnedSessionRowItem = Omit<ConversationRunRowProps, "actions"> & { key: string };

/**
 * A pinned project that lives on a server other than the one on screen. Its
 * rows open by switching servers.
 */
type RemoteProjectSource = {
  readMarkers: Record<string, string>;
  openRun: (runId: string) => void;
  beginConversation: () => void;
};

type SessionPinControl = {
  isPinned: (runId: string) => boolean;
  toggle: (runId: string) => void;
};

type ProjectGroupListItem = {
  key: string;
  group: SidebarGroup;
  pinned: boolean;
  togglePin: (() => void) | null;
  remote: RemoteProjectSource | null;
  machine: PinnedMachine | null;
  sessionPin: SessionPinControl | null;
};

const NO_PINS = new StateManager<PinnedItemsSnapshot>({ projects: [], sessions: [], serverCount: 0 });
const NO_RUNNER_REGISTRY = new StateManager<RunnerRegistrySnapshot>({ activeRunnerId: null, connections: [], identityCollisions: [] });
const selectActiveRunnerId = (snapshot: RunnerRegistrySnapshot) => snapshot.activeRunnerId;
const NO_PINNED_RUN_IDS: ReadonlySet<string> = new Set();

function withoutPinnedRuns(group: SidebarGroup, pinnedRunIds: ReadonlySet<string>): SidebarGroup {
  if (pinnedRunIds.size === 0 || !group.runs.some((run) => pinnedRunIds.has(run.id))) {
    return group;
  }
  return { ...group, runs: group.runs.filter((run) => !pinnedRunIds.has(run.id)) };
}

function matchesSidebarSearch(run: SidebarRun, searchQuery: string) {
  if (!searchQuery) return true;
  const query = searchQuery.toLowerCase();
  return run.title.toLowerCase().includes(query) || run.path.toLowerCase().includes(query);
}

interface ConversationProjectGroupListProps {
  items: ProjectGroupListItem[];
  isHydratingConversations: boolean;
  selectedRunId: string | null;
  latestMessageAtByRunId: ReadonlyMap<string, string>;
  readMarkers: Record<string, string>;
  collapsedProjectPaths: Set<string>;
  visibleProjectSessionCounts: Record<string, number>;
  canReorderProjects: boolean;
  onProjectOpenChange: (projectPath: string, open: boolean) => void;
  onReorderProjects: (draggedPath: string, targetPath: string, placement: ProjectDropPlacement) => void;
  onShowMoreProjectSessions: (projectPath: string) => void;
  beginConversationInProject: (projectPath: string) => void;
  presetCommands: ProjectPresetCommandMenuItem[];
  runPresetCommand: (projectPath: string, presetCommandId: string) => void;
  isPresetCommandPending: boolean;
  handleRemoveProject: (pathToRemove: string) => void;
  runRowActions: RunRowActions;
  emptyState: React.ReactNode;
}

function ConversationProjectGroupList({
  items,
  isHydratingConversations,
  selectedRunId,
  latestMessageAtByRunId,
  readMarkers,
  collapsedProjectPaths,
  visibleProjectSessionCounts,
  canReorderProjects,
  onProjectOpenChange,
  onReorderProjects,
  onShowMoreProjectSessions,
  beginConversationInProject,
  presetCommands,
  runPresetCommand,
  isPresetCommandPending,
  handleRemoveProject,
  runRowActions,
  emptyState,
}: ConversationProjectGroupListProps) {
  const projectDrag = useManagerSnapshot(projectDragManager);

  if (items.length === 0) {
    return <>{emptyState}</>;
  }

  const resolveDropPlacement = (event: React.DragEvent<HTMLElement>): ProjectDropPlacement => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY > rect.top + rect.height / 2 ? "after" : "before";
  };

  const handleProjectDragOver = (event: React.DragEvent<HTMLElement>, targetPath: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (projectDrag.draggingPath === targetPath) {
      projectDragManager.clearDropTarget();
      return;
    }
    projectDragManager.setDropTarget(targetPath, resolveDropPlacement(event));
  };

  const handleProjectDragLeave = (event: React.DragEvent<HTMLElement>, targetPath: string) => {
    // dragleave also fires when crossing into a child element; only clear when
    // the pointer has genuinely left the row, or the line flickers.
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }
    projectDragManager.clearDropTarget(targetPath);
  };

  const handleProjectDrop = (event: React.DragEvent<HTMLElement>, targetPath: string) => {
    const draggedPath = event.dataTransfer.getData(PROJECT_DRAG_DATA_TYPE)
      || event.dataTransfer.getData("text/plain");
    if (!draggedPath || draggedPath === targetPath) {
      projectDragManager.reset();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const placement = resolveDropPlacement(event);
    projectDragManager.reset();
    onReorderProjects(draggedPath, targetPath, placement);
  };

  return (
    <>
      {items.map(({ key: itemKey, group, pinned, togglePin, remote, machine, sessionPin }) => {
        const projectOpen = !collapsedProjectPaths.has(group.path);
        const canDragProject = canReorderProjects && !remote && group.path !== "other";
        const visibleSessionCount = visibleProjectSessionCounts[group.path] ?? PROJECT_SESSION_DISPLAY_BATCH_SIZE;
        const visibleRuns = group.runs.slice(0, visibleSessionCount);
        const hiddenSessionCount = Math.max(0, group.runs.length - visibleRuns.length);
        const nextSessionBatchCount = Math.min(PROJECT_SESSION_DISPLAY_BATCH_SIZE, hiddenSessionCount);
        const dropIndicatorPlacement = projectDrag.dropPath === group.path ? projectDrag.dropPlacement : null;
        const projectPinLabel = t(pinned ? "conversation.sidebar.unpinProject" : "conversation.sidebar.pinProject", { project: group.name });
        const pinsInMenu = runRowActions.pinsInMenu;

        return (
          <Collapsible
            key={itemKey}
            open={projectOpen}
            onOpenChange={(open) => onProjectOpenChange(group.path, open)}
          >
            <div
              data-project-drag-row="true"
              data-project-path={group.path}
              className={cn(
                "group relative mb-1 flex items-center justify-between gap-0.5 rounded px-2 hover:bg-muted/30",
                projectDrag.draggingPath === group.path && "opacity-40",
              )}
              onDragOver={(event) => {
                if (!canDragProject) return;
                handleProjectDragOver(event, group.path);
              }}
              onDragLeave={(event) => handleProjectDragLeave(event, group.path)}
              onDrop={(event) => handleProjectDrop(event, group.path)}
            >
              {dropIndicatorPlacement ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute inset-x-1 z-10 h-0.5 rounded-full bg-sky-500 dark:bg-sky-400",
                    // Straddle the gap between rows so the line reads as "here",
                    // not as an underline belonging to one row.
                    dropIndicatorPlacement === "before" ? "-top-px" : "-bottom-px",
                  )}
                >
                  <span className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-sky-500 dark:bg-sky-400" />
                </span>
              ) : null}
              {canDragProject ? (
                <span
                  draggable={canDragProject}
                  className="flex h-6 w-4 shrink-0 cursor-grab items-center justify-center text-muted-foreground/55 transition-colors hover:text-muted-foreground active:cursor-grabbing"
                  aria-label={t("conversation.sidebar.dragProject", { project: group.name })}
                  title={t("conversation.sidebar.dragProject", { project: group.name })}
                  onClick={(event) => event.stopPropagation()}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData(PROJECT_DRAG_DATA_TYPE, group.path);
                    event.dataTransfer.setData("text/plain", group.path);
                    projectDragManager.beginDrag(group.path);
                    const projectDragRow = event.currentTarget.closest<HTMLElement>('[data-project-drag-row="true"]');
                    if (projectDragRow) {
                      event.dataTransfer.setDragImage(projectDragRow, 16, projectDragRow.offsetHeight / 2);
                    }
                  }}
                  // Covers the cancelled drag (Esc, or a drop outside any row),
                  // which fires dragend without ever firing drop.
                  onDragEnd={() => projectDragManager.reset()}
                >
                  <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              ) : null}
              <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                <Folder className="h-4 w-4 shrink-0 text-primary/70" />
                <span className="truncate">{group.name}</span>
                {machine ? <PinnedMachineLabel machine={machine} className={cn("ml-auto", PINNED_MACHINE_AT_REST_CLASS)} /> : null}
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform duration-150 ease-out",
                    // Follows the machine label, and takes over its spacing when hover hides it.
                    machine ? "lg:group-hover:ml-auto lg:group-has-focus-visible:ml-auto lg:group-has-data-popup-open:ml-auto" : "ml-auto",
                    projectOpen && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </CollapsibleTrigger>

              {group.path !== "other" ? (
                <div className={cn("flex shrink-0 items-center gap-0.5", machine && PINNED_ACTIONS_ON_HOVER_CLASS)}>
                  {togglePin && !pinsInMenu ? (
                    <PinToggleButton pinned={pinned} label={projectPinLabel} onToggle={togglePin} />
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground opacity-100 hover:text-foreground lg:opacity-0 lg:group-hover:opacity-100"
                    title={t("conversation.sidebar.newConversationInProject", { project: group.name })}
                    onClick={() => (remote ? remote.beginConversation() : beginConversationInProject(group.path))}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  {remote ? (
                    togglePin && pinsInMenu ? (
                      <PinOnlyMenu pinned={pinned} label={projectPinLabel} onToggle={togglePin} />
                    ) : (
                      <div className="h-6 w-6 shrink-0" aria-hidden="true" />
                    )
                  ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger className={ROW_MENU_TRIGGER_CLASS}>
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-w-[min(20rem,calc(100vw-2rem))]">
                      {togglePin && pinsInMenu ? (
                        <>
                          <PinMenuItem pinned={pinned} label={projectPinLabel} onToggle={togglePin} />
                          <DropdownMenuSeparator />
                        </>
                      ) : null}
                      {presetCommands.map((preset) => (
                        <DropdownMenuItem
                          key={preset.id}
                          data-preset-command-item={preset.id}
                          className="cursor-pointer"
                          disabled={isPresetCommandPending}
                          onClick={() => runPresetCommand(group.path, preset.id)}
                        >
                          <Play className="mr-2 h-4 w-4 shrink-0" />
                          <span className="min-w-0 [overflow-wrap:anywhere]">{preset.name}</span>
                        </DropdownMenuItem>
                      ))}
                      {presetCommands.length > 0 ? <DropdownMenuSeparator /> : null}
                      <DropdownMenuItem className="cursor-pointer whitespace-nowrap text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => handleRemoveProject(group.path)}>
                        <Trash2 className="mr-2 h-4 w-4" /> {t("conversation.sidebar.removeProject")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  )}
                </div>
              ) : (
                <div className="h-6 w-[5.5rem] shrink-0" aria-hidden="true" />
              )}
            </div>

            <div
              className={cn(
                COLLAPSIBLE_PANEL_TRANSITION_CLASS,
                projectOpen ? COLLAPSIBLE_PANEL_OPEN_CLASS : COLLAPSIBLE_PANEL_CLOSED_CLASS,
              )}
              aria-hidden={!projectOpen}
            >
              <div className="min-h-0 space-y-0.5 overflow-hidden">
                {group.runs.length === 0 ? (
                  isHydratingConversations ? (
                    <div className="flex items-center gap-2 py-1 pl-8 text-xs text-muted-foreground/70">
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      <span>{t("conversation.sidebar.loadingConversations")}</span>
                    </div>
                  ) : (
                    <div className="py-1 pl-8 text-xs italic text-muted-foreground/60">No conversations</div>
                  )
                ) : null}
                {visibleRuns.map((run) => {
                  const runPinned = sessionPin?.isPinned(run.id) ?? false;
                  return (
                    <ConversationRunRow
                      key={run.id}
                      run={run}
                      selected={!remote && selectedRunId === run.id}
                      // Another server's messages are not loaded here, so its
                      // rows judge unread state from the run's own timestamps.
                      unread={isSidebarRunUnread(
                        run,
                        remote ? null : latestMessageAtByRunId.get(run.id) ?? null,
                        (remote ? remote.readMarkers : readMarkers)[run.id] ?? null,
                      )}
                      openRemote={remote ? () => remote.openRun(run.id) : null}
                      pin={sessionPin ? { pinned: runPinned, toggle: () => sessionPin.toggle(run.id) } : null}
                      machine={null}
                      actions={runRowActions}
                    />
                  );
                })}
                {hiddenSessionCount > 0 ? (
                  <button
                    type="button"
                    className="ml-7 mt-1 inline-flex h-7 items-center rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={t("conversation.sidebar.showMoreSessions", {
                      count: nextSessionBatchCount,
                      project: group.name,
                    })}
                    title={t("conversation.sidebar.showMoreSessions", {
                      count: nextSessionBatchCount,
                      project: group.name,
                    })}
                    onClick={() => onShowMoreProjectSessions(group.path)}
                  >
                    {t("conversation.sidebar.moreSessions")}
                  </button>
                ) : null}
              </div>
            </div>
          </Collapsible>
        );
      })}
    </>
  );
}

interface MoveRunToProjectDialogProps {
  open: boolean;
  moveRunProjectPath: string;
  moveRunToProjectOptions: string[];
  isMoveRunToProjectPending: boolean;
  setMoveRunProjectPath: (value: string) => void;
  confirmMoveRunToProject: () => void;
  cancelMovingRun: () => void;
}

function MoveRunToProjectDialog({
  open,
  moveRunProjectPath,
  moveRunToProjectOptions,
  isMoveRunToProjectPending,
  setMoveRunProjectPath,
  confirmMoveRunToProject,
  cancelMovingRun,
}: MoveRunToProjectDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          cancelMovingRun();
        }
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("conversation.moveProject.title")}</DialogTitle>
          <DialogDescription>
            {moveRunToProjectOptions.length > 0
              ? t("conversation.moveProject.description")
              : t("conversation.moveProject.empty")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="move-run-project-select">
            {t("conversation.moveProject.projectLabel")}
          </label>
          <select
            id="move-run-project-select"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            value={moveRunProjectPath}
            onChange={(event) => setMoveRunProjectPath(event.target.value)}
            disabled={isMoveRunToProjectPending || moveRunToProjectOptions.length === 0}
          >
            <option value="">{t("conversation.moveProject.placeholder")}</option>
            {moveRunToProjectOptions.map((projectPath) => (
              <option key={projectPath} value={projectPath}>
                {projectPath}
              </option>
            ))}
          </select>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={cancelMovingRun}
            disabled={isMoveRunToProjectPending}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={confirmMoveRunToProject}
            disabled={!moveRunProjectPath || isMoveRunToProjectPending}
          >
            {t("conversation.moveProject.ok")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface ConversationSidebarProps {
  filteredProjects: SidebarGroup[];
  activeProjects: SidebarGroup[];
  conversationSidebarTab: ConversationSidebarTab;
  setConversationSidebarTab: (tab: ConversationSidebarTab) => void;
  isHydratingConversations: boolean;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  selectedRunId: string | null;
  messages: Array<{ runId: string; role?: string | null; kind?: string | null; content?: string | null; createdAt: string }> | undefined;
  readMarkers: Record<string, string>;
  collapsedProjectPaths: Set<string>;
  visibleProjectSessionCounts: Record<string, number>;
  onProjectOpenChange: (projectPath: string, open: boolean) => void;
  onReorderProjects: (draggedPath: string, targetPath: string, placement: ProjectDropPlacement) => void;
  onCollapseAllProjects: (projectPaths: string[]) => void;
  onShowMoreProjectSessions: (projectPath: string) => void;
  setShowSettings: React.Dispatch<React.SetStateAction<boolean>>;
  openOnboarding: () => void;
  openFolderPicker: () => void;
  startNewPlan: () => void;
  beginConversationInProject: (projectPath: string) => void;
  presetCommands: ProjectPresetCommandMenuItem[];
  runPresetCommand: (projectPath: string, presetCommandId: string) => void;
  isPresetCommandPending: boolean;
  handleRemoveProject: (pathToRemove: string) => void;
  selectRun: (runId: string) => void;
  renamingRunId: string | null;
  renameValue: string;
  renameSource: "sidebar" | "topbar" | null;
  setRenameValue: (value: string) => void;
  movingRunId: string | null;
  moveRunProjectPath: string;
  moveRunToProjectOptions: string[];
  setMoveRunProjectPath: (value: string) => void;
  startMovingRun: (run: SidebarRun) => void;
  confirmMoveRunToProject: () => void;
  cancelMovingRun: () => void;
  isMoveRunToProjectPending: boolean;
  startRenamingRun: (run: SidebarRun) => void;
  commitRenamingRun: (runId: string) => void;
  cancelRenamingRun: () => void;
  archiveRun: (run: SidebarRun) => void;
  deleteRun: (run: SidebarRun) => void;
  authEnabled: boolean;
  openPairDeviceDialog: () => void;
  logout: () => void;
  themeMode: "day" | "night";
  setThemeMode: React.Dispatch<React.SetStateAction<"day" | "night">>;
  onCollapse?: () => void;
  onOpenExternalSessions?: () => void;
  runnerControlsMode?: "desktop" | "mobile";
}

/**
 * Memoized. Every SSE frame gave the shell a new state identity and re-rendered
 * this entire subtree, even when nothing it renders had changed. Its props are
 * spread from `sharedSidebarProps`, whose callbacks are now stable, so the
 * shallow comparison is meaningful.
 */
const ConversationSidebar = memo(function ConversationSidebar({
  filteredProjects,
  activeProjects,
  conversationSidebarTab,
  setConversationSidebarTab,
  isHydratingConversations,
  searchQuery,
  setSearchQuery,
  selectedRunId,
  messages,
  readMarkers,
  collapsedProjectPaths,
  visibleProjectSessionCounts,
  onProjectOpenChange,
  onReorderProjects,
  onCollapseAllProjects,
  onShowMoreProjectSessions,
  setShowSettings,
  openOnboarding,
  openFolderPicker,
  startNewPlan,
  beginConversationInProject,
  presetCommands,
  runPresetCommand,
  isPresetCommandPending,
  handleRemoveProject,
  selectRun,
  renamingRunId,
  renameValue,
  renameSource,
  setRenameValue,
  movingRunId,
  moveRunProjectPath,
  moveRunToProjectOptions,
  setMoveRunProjectPath,
  startMovingRun,
  confirmMoveRunToProject,
  cancelMovingRun,
  isMoveRunToProjectPending,
  startRenamingRun,
  commitRenamingRun,
  cancelRenamingRun,
  archiveRun,
  deleteRun,
  authEnabled,
  openPairDeviceDialog,
  logout,
  themeMode,
  setThemeMode,
  onCollapse,
  onOpenExternalSessions,
  runnerControlsMode = "desktop",
}: ConversationSidebarProps) {
  useI18nSnapshot();
  const themeModeLabel = t(themeMode === "night" ? "theme.mode.switchDay" : "theme.mode.switchNight");
  const runnerContext = useOptionalRunnerRegistryContext();
  const pins = runnerContext?.pins ?? null;
  const pinSnapshot = useManagerSnapshot<PinnedItemsSnapshot>(pins ?? NO_PINS);
  const activeRunnerId = useManagerSelector(runnerContext?.registry ?? NO_RUNNER_REGISTRY, selectActiveRunnerId);
  // Naming the machine only helps once there is more than one to tell apart.
  const showPinnedMachines = pinSnapshot.serverCount > 1;
  const showPinnedSection = pins !== null && conversationSidebarTab === "projects";
  const latestMessageAtByRunId = useMemo(() => {
    // Rolled up once per message list: the unread check runs for every row,
    // including rows inside collapsed projects, which stay mounted.
    const latest = new Map<string, string>();
    for (const message of messages ?? []) {
      const existing = latest.get(message.runId);
      if (!existing || new Date(message.createdAt).getTime() > new Date(existing).getTime()) {
        latest.set(message.runId, message.createdAt);
      }
    }
    return latest;
  }, [messages]);
  const activePinnedPaths = useMemo(
    () => new Set(pinSnapshot.projects.filter((entry) => entry.active).map((entry) => entry.path)),
    [pinSnapshot.projects],
  );
  const pinnedRunIdsByProfile = useMemo(() => {
    const byProfile = new Map<string, Set<string>>();
    for (const entry of pinSnapshot.sessions) {
      const runIds = byProfile.get(entry.profileId) ?? new Set<string>();
      runIds.add(entry.runId);
      byProfile.set(entry.profileId, runIds);
    }
    return byProfile;
  }, [pinSnapshot.sessions]);
  const activePinnedRunIds = (activeRunnerId ? pinnedRunIdsByProfile.get(activeRunnerId) : null) ?? NO_PINNED_RUN_IDS;
  const sessionPinFor = useCallback((profileId: string | null): SessionPinControl | null => {
    if (!pins || !profileId) return null;
    const pinnedRunIds = pinnedRunIdsByProfile.get(profileId) ?? NO_PINNED_RUN_IDS;
    return {
      isPinned: (runId) => pinnedRunIds.has(runId),
      toggle: (runId) => { void pins.setSessionPinned(profileId, runId, !pinnedRunIds.has(runId)); },
    };
  }, [pinnedRunIdsByProfile, pins]);
  const closeMobileDrawer = useCallback(() => {
    if (runnerControlsMode === "mobile") onCollapse?.();
  }, [onCollapse, runnerControlsMode]);
  const pinnedSessionRows = useMemo<PinnedSessionRowItem[]>(() => {
    if (!pins || !showPinnedSection) {
      return [];
    }
    const localRunsById = new Map(filteredProjects.flatMap((group) => group.runs.map((run) => [run.id, run] as const)));
    const rows: PinnedSessionRowItem[] = [];
    for (const entry of pinSnapshot.sessions) {
      // The active server's runs come from local state, which search has
      // already filtered; another server's run is matched here.
      const run = entry.active
        ? localRunsById.get(entry.runId)
        : entry.run && matchesSidebarSearch(entry.run as SidebarRun, searchQuery) ? entry.run as SidebarRun : undefined;
      if (!run) continue;
      rows.push({
        key: entry.key,
        run,
        selected: entry.active && selectedRunId === run.id,
        unread: isSidebarRunUnread(
          run,
          entry.active ? latestMessageAtByRunId.get(run.id) ?? null : null,
          (entry.active ? readMarkers : entry.readMarkers)[run.id] ?? null,
        ),
        openRemote: entry.active
          ? null
          : () => {
            closeMobileDrawer();
            pins.openRun(entry.profileId, run.id);
          },
        pin: { pinned: true, toggle: () => { void pins.setSessionPinned(entry.profileId, run.id, false); } },
        machine: showPinnedMachines ? { name: entry.runnerName, status: entry.status } : null,
      });
    }
    return rows;
  }, [closeMobileDrawer, filteredProjects, latestMessageAtByRunId, pinSnapshot.sessions, pins, readMarkers, searchQuery, selectedRunId, showPinnedMachines, showPinnedSection]);
  const pinnedProjectItems = useMemo<ProjectGroupListItem[]>(() => {
    if (!pins || !showPinnedSection) {
      return [];
    }
    const items: ProjectGroupListItem[] = [];
    for (const entry of pinSnapshot.projects) {
      const unpin = () => { void pins.setProjectPinned(entry.profileId, entry.path, false); };
      const machine = showPinnedMachines ? { name: entry.runnerName, status: entry.status } : null;
      const pinnedRunIds = pinnedRunIdsByProfile.get(entry.profileId) ?? NO_PINNED_RUN_IDS;
      if (entry.active) {
        // A pinned project with nothing left on this server still shows, so the
        // pin stays visible and removable rather than silently lingering.
        const group = filteredProjects.find((candidate) => candidate.path === entry.path)
          ?? (searchQuery ? null : { path: entry.path, name: entry.path.split(/[/\\]/).pop() || entry.path, runs: [] });
        if (group) {
          items.push({
            key: entry.key,
            group: withoutPinnedRuns(group, pinnedRunIds),
            pinned: true,
            togglePin: unpin,
            remote: null,
            machine,
            sessionPin: sessionPinFor(entry.profileId),
          });
        }
        continue;
      }
      const [group] = entry.group ? filterConversationGroupsBySearch([entry.group], searchQuery) : [];
      if (!group) continue;
      items.push({
        key: entry.key,
        group: withoutPinnedRuns(group as SidebarGroup, pinnedRunIds),
        pinned: true,
        togglePin: unpin,
        remote: {
          readMarkers: entry.readMarkers,
          openRun: (runId) => {
            closeMobileDrawer();
            pins.openRun(entry.profileId, runId);
          },
          beginConversation: () => {
            closeMobileDrawer();
            pins.beginConversation(entry.profileId, entry.path);
          },
        },
        machine,
        sessionPin: sessionPinFor(entry.profileId),
      });
    }
    return items;
  }, [closeMobileDrawer, filteredProjects, pinSnapshot.projects, pinnedRunIdsByProfile, pins, searchQuery, sessionPinFor, showPinnedMachines, showPinnedSection]);
  const listItems = useMemo<ProjectGroupListItem[]>(() => {
    const sessionPin = sessionPinFor(activeRunnerId);
    // Pinned items move to the top of the projects tab rather than showing twice;
    // the recent tab keeps everything in place.
    const hidePinned = showPinnedSection;
    return (conversationSidebarTab === "projects" ? filteredProjects : activeProjects)
      .filter((group) => !(hidePinned && activePinnedPaths.has(group.path)))
      .map((group) => {
        const pinned = activePinnedPaths.has(group.path);
        return {
          key: group.path,
          group: hidePinned ? withoutPinnedRuns(group, activePinnedRunIds) : group,
          pinned,
          togglePin: pins && activeRunnerId && group.path !== "other"
            ? () => { void pins.setProjectPinned(activeRunnerId, group.path, !pinned); }
            : null,
          remote: null,
          machine: null,
          sessionPin,
        };
      });
  }, [activePinnedPaths, activePinnedRunIds, activeProjects, activeRunnerId, conversationSidebarTab, filteredProjects, pins, sessionPinFor, showPinnedSection]);
  // A removed project or a deleted or archived session that stayed pinned would
  // linger in the pinned section.
  const removeProject = useCallback((projectPath: string) => {
    handleRemoveProject(projectPath);
    if (pins && activeRunnerId && activePinnedPaths.has(projectPath)) {
      void pins.setProjectPinned(activeRunnerId, projectPath, false);
    }
  }, [activePinnedPaths, activeRunnerId, handleRemoveProject, pins]);
  const runRowActions = useMemo<RunRowActions>(() => {
    const unpinSession = (run: SidebarRun) => {
      if (pins && activeRunnerId && activePinnedRunIds.has(run.id)) {
        void pins.setSessionPinned(activeRunnerId, run.id, false);
      }
    };
    return {
      pinsInMenu: runnerControlsMode === "mobile",
      selectRun,
      renamingRunId,
      renameValue,
      renameSource,
      setRenameValue,
      startRenamingRun,
      startMovingRun,
      commitRenamingRun,
      cancelRenamingRun,
      archiveRun: (run) => {
        archiveRun(run);
        unpinSession(run);
      },
      deleteRun: (run) => {
        deleteRun(run);
        unpinSession(run);
      },
    };
  }, [activePinnedRunIds, activeRunnerId, archiveRun, cancelRenamingRun, commitRenamingRun, deleteRun, pins, renameSource, renameValue, renamingRunId, runnerControlsMode, selectRun, setRenameValue, startMovingRun, startRenamingRun]);
  const visibleProjectItems = useMemo(
    () => [...pinnedProjectItems, ...listItems],
    [listItems, pinnedProjectItems],
  );
  const hasPinnedItems = pinnedSessionRows.length > 0 || pinnedProjectItems.length > 0;
  const hasExpandedVisibleProjectGroup = visibleProjectItems.some((item) => !collapsedProjectPaths.has(item.group.path));
  const mounted = useSyncExternalStore(
    useCallback((listener) => conversationSidebarHydrationManager.subscribe(listener), []),
    useCallback(() => conversationSidebarHydrationManager.getSnapshot(), []),
    () => conversationSidebarHydrationManager.getSnapshot(),
  );
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollSettledRef = useRef(false);
  const programmaticScrollTopRef = useRef<number | null>(null);
  const handleSidebarPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    mobileConversationSwipeManager.start(event, runnerControlsMode === "mobile", "close");
  }, [runnerControlsMode]);
  const handleSidebarPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    mobileConversationSwipeManager.move(event);
  }, []);
  const handleSidebarPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (mobileConversationSwipeManager.finish(event) === "close") {
      onCollapse?.();
    }
  }, [onCollapse]);
  const handleSidebarPointerCancel = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (mobileConversationSwipeManager.cancel(event) === "close") {
      onCollapse?.();
    }
  }, [onCollapse]);
  const sidebarContentKey = useMemo(
    () => [
      pinnedSessionRows.map((row) => row.key).join(","),
      ...visibleProjectItems.map((item) => `${item.key}:${item.group.runs.map((run) => run.id).join(",")}`),
    ].join("|"),
    [pinnedSessionRows, visibleProjectItems],
  );
  const getScrollViewport = useCallback(
    () => scrollAreaRef.current?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]') ?? null,
    [],
  );

  useEffect(() => {
    if (!mounted) {
      return;
    }
    const viewport = getScrollViewport();
    if (!viewport) {
      return;
    }
    const saveScrollPosition = () => {
      conversationSidebarScrollManager.setScrollTop(runnerControlsMode, viewport.scrollTop);
    };
    const handleScroll = () => {
      const programmaticScrollTop = programmaticScrollTopRef.current;
      if (programmaticScrollTop === null || Math.abs(viewport.scrollTop - programmaticScrollTop) > 1) {
        // The user is driving the list now, so pending centring attempts stop.
        scrollSettledRef.current = true;
      }
      saveScrollPosition();
    };
    viewport.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      saveScrollPosition();
      viewport.removeEventListener("scroll", handleScroll);
    };
  }, [getScrollViewport, mounted, runnerControlsMode]);

  useLayoutEffect(() => {
    if (!mounted || scrollSettledRef.current) {
      return;
    }
    const viewport = getScrollViewport();
    if (!viewport) {
      return;
    }
    const applyScrollTop = (scrollTop: number) => {
      programmaticScrollTopRef.current = scrollTop;
      viewport.scrollTop = scrollTop;
    };
    const selectedRow = runnerControlsMode === "mobile" && selectedRunId
      ? findConversationRunRow(viewport, selectedRunId)
      : null;
    if (selectedRow) {
      // Centring outranks the remembered offset: that offset was saved when the
      // drawer last closed — usually right after tapping a run, with the tapped
      // row wherever the finger happened to land — so restoring it leaves the
      // current run off centre.
      applyScrollTop(centeredScrollTopForRow(viewport, selectedRow));
      scrollSettledRef.current = true;
      // The drawer paints a frame after mount, so anything that settles late
      // (runner controls, brand icons) would nudge the row off centre. One
      // re-measure covers that, and it backs off once the user scrolls.
      const frame = requestAnimationFrame(() => {
        const programmaticScrollTop = programmaticScrollTopRef.current;
        if (!selectedRow.isConnected || programmaticScrollTop === null) {
          return;
        }
        if (Math.abs(viewport.scrollTop - programmaticScrollTop) > 1) {
          return;
        }
        applyScrollTop(centeredScrollTopForRow(viewport, selectedRow));
      });
      return () => {
        cancelAnimationFrame(frame);
      };
    }
    const savedScrollTop = conversationSidebarScrollManager.getScrollTop(runnerControlsMode);
    if (savedScrollTop !== undefined) {
      applyScrollTop(clampScrollTop(savedScrollTop, viewport.scrollHeight, viewport.clientHeight));
    }
    if (runnerControlsMode !== "mobile" || !selectedRunId) {
      scrollSettledRef.current = true;
    }
    // A mobile drawer whose selected row has not rendered yet stays unsettled so
    // that centring still runs once the run streams into the list.
  }, [getScrollViewport, mounted, runnerControlsMode, selectedRunId, sidebarContentKey]);

  useEffect(() => {
    conversationSidebarHydrationManager.markMounted();
  }, []);

  if (!mounted) {
    // First render (SSR + initial client paint) renders an empty shell so the
    // client tree shape matches the server's. Without this, the project/run
    // list populates from local state after hydration, shifting Base UI's
    // auto-generated IDs and producing a hydration mismatch warning across
    // every DropdownMenuTrigger in the sidebar.
    return (
      <div
        className={cn(
          "relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#f1f1f0] dark:bg-muted/30",
          runnerControlsMode === "mobile" && MOBILE_DRAWER_SAFE_AREA_CLASS,
        )}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      data-conversation-sidebar-surface={runnerControlsMode}
      className={cn(
        "relative flex h-full min-h-0 w-full touch-pan-y touch-pinch-zoom flex-col overflow-hidden bg-[#f1f1f0] dark:bg-muted/30 lg:touch-auto",
        runnerControlsMode === "mobile" && MOBILE_DRAWER_SAFE_AREA_CLASS,
      )}
      onPointerDown={handleSidebarPointerDown}
      onPointerMove={handleSidebarPointerMove}
      onPointerUp={handleSidebarPointerUp}
      onPointerCancel={handleSidebarPointerCancel}
    >
      <div className="space-y-1 px-3 pb-3 pt-2 lg:px-3 lg:pb-3 lg:pt-2">
        <div className="flex items-center gap-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <OmniHarnessMark className="h-8 w-8" />
            <span className="min-w-0 truncate text-sm font-semibold text-[#333333] dark:text-zinc-100">
              {PRODUCT_NAME}
            </span>
          </div>
          {onCollapse ? (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 text-[#333333]/75 transition-all duration-150 ease-out hover:bg-[#deddda] hover:text-[#1f1f1f] dark:text-zinc-300 dark:hover:bg-muted/70 dark:hover:text-zinc-100 motion-reduce:transition-none",
                runnerControlsMode === "mobile" ? "ml-auto inline-flex" : "hidden lg:inline-flex",
              )}
              aria-label={t("conversation.sidebar.collapseAria")}
              title={t("conversation.sidebar.collapseAria")}
              onClick={onCollapse}
            >
              <PanelLeftClose className="h-4 w-4 transition-transform duration-150 ease-out group-hover/button:-translate-x-0.5 motion-reduce:transition-none" />
            </Button>
          ) : null}
        </div>
        <RunnerControls
          placement="sidebar"
          controlId={runnerControlsMode === "mobile" ? "runner-switcher-mobile" : "runner-switcher"}
          renderDialogs={runnerControlsMode === "desktop"}
        />
        <div className="flex items-stretch gap-0">
          <Button variant="ghost" className="h-9 min-w-0 flex-1 justify-start px-2 text-sm text-[#333333] hover:bg-[#deddda] hover:text-[#1f1f1f] dark:text-zinc-200 dark:hover:bg-muted/70 dark:hover:text-zinc-100" onClick={startNewPlan}>
            <Plus className="mr-2 h-4 w-4 shrink-0" /> {t("conversation.sidebar.newSession")}
          </Button>
          {onOpenExternalSessions && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex h-9 w-8 shrink-0 items-center justify-center rounded-md text-[#333333]/60 transition-colors hover:bg-[#deddda] hover:text-[#1f1f1f] focus-visible:outline-none dark:text-zinc-400 dark:hover:bg-muted/70 dark:hover:text-zinc-100"
                aria-label={t("externalSessions.moreOptionsAria")}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem className="cursor-pointer whitespace-nowrap" onClick={onOpenExternalSessions}>
                  <SquareTerminal className="mr-2 h-4 w-4" /> {t("externalSessions.title")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-[#333333] dark:text-zinc-300" />
          <Input
            type="text"
            placeholder={t("conversation.sidebar.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full border-transparent bg-[#e4e3e1] pl-8 pr-9 text-sm text-[#333333] transition-all placeholder:text-[#333333]/75 hover:bg-[#deddda] focus-visible:border-[#c8c7c5] focus-visible:bg-[#e4e3e1] focus-visible:ring-1 dark:bg-white/[0.08] dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:hover:bg-white/[0.095] dark:focus-visible:bg-white/[0.08]"
          />
          {searchQuery ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute right-1 top-1 text-[#333333]/70 hover:bg-[#d7d6d4] hover:text-[#1f1f1f] dark:text-zinc-300 dark:hover:bg-white/[0.12] dark:hover:text-zinc-100"
              aria-label={t("common.clear")}
              title={t("common.clear")}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setSearchQuery("")}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <ScrollArea
          ref={scrollAreaRef}
          className="h-full px-3"
          viewportClassName="touch-pan-y touch-pinch-zoom lg:touch-auto"
        >
          <div className="space-y-3 pb-4 pt-0.5">
          <div className="ml-2 mr-1 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setConversationSidebarTab("projects")}
                className={cn(
                  "rounded px-2 py-0.5 text-xs font-semibold transition-colors",
                  conversationSidebarTab === "projects"
                    ? "bg-[#deddda] text-[#1f1f1f] dark:bg-white/[0.12] dark:text-zinc-100"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t("conversation.sidebar.tab.projects")}
              </button>
              <button
                type="button"
                onClick={() => setConversationSidebarTab("recent")}
                className={cn(
                  "rounded px-2 py-0.5 text-xs font-semibold transition-colors",
                  conversationSidebarTab === "recent"
                    ? "bg-[#deddda] text-[#1f1f1f] dark:bg-white/[0.12] dark:text-zinc-100"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t("conversation.sidebar.tab.active")}
              </button>
            </div>
            <div className="flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger render={<span className="inline-flex" />}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    disabled={!hasExpandedVisibleProjectGroup}
                    aria-label={t("conversation.sidebar.collapseAllProjects")}
                    title={t("conversation.sidebar.collapseAllProjects")}
                    onClick={() => onCollapseAllProjects(visibleProjectItems.map((item) => item.group.path))}
                  >
                    <ListChevronsDownUp className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end">
                  {t("conversation.sidebar.collapseAllProjects")}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger render={<span className="inline-flex" />}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    aria-label={t("conversation.sidebar.addProject")}
                    title={t("conversation.sidebar.addProject")}
                    onClick={openFolderPicker}
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end">
                  {t("conversation.sidebar.addProject")}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {hasPinnedItems ? (
            <section
              aria-label={t("conversation.sidebar.pinned")}
              className="space-y-1 border-b border-border/60 pb-2"
            >
              <div className="ml-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Pin className="h-3 w-3" aria-hidden="true" />
                <span>{t("conversation.sidebar.pinned")}</span>
              </div>
              {pinnedSessionRows.length > 0 ? (
                <div className="space-y-0.5" data-pinned-sessions="true">
                  {pinnedSessionRows.map(({ key, ...row }) => (
                    <ConversationRunRow key={key} {...row} actions={runRowActions} />
                  ))}
                </div>
              ) : null}
              <ConversationProjectGroupList
                items={pinnedProjectItems}
                isHydratingConversations={isHydratingConversations}
                selectedRunId={selectedRunId}
                latestMessageAtByRunId={latestMessageAtByRunId}
                readMarkers={readMarkers}
                collapsedProjectPaths={collapsedProjectPaths}
                visibleProjectSessionCounts={visibleProjectSessionCounts}
                canReorderProjects={false}
                onProjectOpenChange={onProjectOpenChange}
                onReorderProjects={onReorderProjects}
                onShowMoreProjectSessions={onShowMoreProjectSessions}
                beginConversationInProject={beginConversationInProject}
                presetCommands={presetCommands}
                runPresetCommand={runPresetCommand}
                isPresetCommandPending={isPresetCommandPending}
                handleRemoveProject={removeProject}
                runRowActions={runRowActions}
                emptyState={null}
              />
            </section>
          ) : null}

          {conversationSidebarTab === "projects" ? (
            <ConversationProjectGroupList
              items={listItems}
              isHydratingConversations={isHydratingConversations}
              selectedRunId={selectedRunId}
              latestMessageAtByRunId={latestMessageAtByRunId}
              readMarkers={readMarkers}
              collapsedProjectPaths={collapsedProjectPaths}
              visibleProjectSessionCounts={visibleProjectSessionCounts}
              canReorderProjects={conversationSidebarTab === "projects"}
              onProjectOpenChange={onProjectOpenChange}
              onReorderProjects={onReorderProjects}
              onShowMoreProjectSessions={onShowMoreProjectSessions}
              beginConversationInProject={beginConversationInProject}
              presetCommands={presetCommands}
              runPresetCommand={runPresetCommand}
              isPresetCommandPending={isPresetCommandPending}
              handleRemoveProject={removeProject}
              runRowActions={runRowActions}
              emptyState={hasPinnedItems
                ? null
                : <p className="pl-2 text-sm text-muted-foreground">{t("conversation.sidebar.empty.projects")}</p>}
            />
          ) : (
            <ConversationProjectGroupList
              items={listItems}
              isHydratingConversations={false}
              selectedRunId={selectedRunId}
              latestMessageAtByRunId={latestMessageAtByRunId}
              readMarkers={readMarkers}
              collapsedProjectPaths={collapsedProjectPaths}
              visibleProjectSessionCounts={visibleProjectSessionCounts}
              canReorderProjects={false}
              onProjectOpenChange={onProjectOpenChange}
              onReorderProjects={onReorderProjects}
              onShowMoreProjectSessions={onShowMoreProjectSessions}
              beginConversationInProject={beginConversationInProject}
              presetCommands={presetCommands}
              runPresetCommand={runPresetCommand}
              isPresetCommandPending={isPresetCommandPending}
              handleRemoveProject={removeProject}
              runRowActions={runRowActions}
              emptyState={<p className="pl-2 text-sm text-muted-foreground">{t("conversation.sidebar.empty.active")}</p>}
            />
          )}
          </div>
        </ScrollArea>
      </div>

      <MoveRunToProjectDialog
        open={Boolean(movingRunId)}
        moveRunProjectPath={moveRunProjectPath}
        moveRunToProjectOptions={moveRunToProjectOptions}
        isMoveRunToProjectPending={isMoveRunToProjectPending}
        setMoveRunProjectPath={setMoveRunProjectPath}
        confirmMoveRunToProject={confirmMoveRunToProject}
        cancelMovingRun={cancelMovingRun}
      />

      <div className="mt-auto shrink-0 border-t border-border/60 bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-9 w-full items-center justify-start rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
            <Settings className="mr-2 h-4 w-4" /> {t("mainMenu.settings")}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="top"
            className="w-fit min-w-fit max-lg:w-[min(20rem,calc(100vw-2rem))] max-lg:min-w-0 max-lg:rounded-xl max-lg:p-2 max-lg:shadow-2xl"
            positionerClassName="max-lg:!fixed max-lg:!inset-0 max-lg:!flex max-lg:!items-center max-lg:!justify-center max-lg:!p-4 max-lg:!transform-none max-lg:bg-background/55 max-lg:backdrop-blur-sm"
          >
            <DropdownMenuItem className="cursor-pointer whitespace-nowrap max-lg:h-12 max-lg:gap-3 max-lg:px-3 max-lg:text-base max-lg:[&_svg]:h-5 max-lg:[&_svg]:w-5" onClick={requestBugDropOpen}>
              <Bug className="mr-2 h-4 w-4" /> {t("mainMenu.reportBug")}
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer whitespace-nowrap max-lg:h-12 max-lg:gap-3 max-lg:px-3 max-lg:text-base max-lg:[&_svg]:h-5 max-lg:[&_svg]:w-5" onClick={() => setShowSettings(true)}>
              <Settings className="mr-2 h-4 w-4" /> {t("mainMenu.settings")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer whitespace-nowrap max-lg:h-12 max-lg:gap-3 max-lg:px-3 max-lg:text-base max-lg:[&_svg]:h-5 max-lg:[&_svg]:w-5"
              onClick={() => setThemeMode((current) => (current === "day" ? "night" : "day"))}
            >
              {themeMode === "night" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
              {themeModeLabel}
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer whitespace-nowrap max-lg:h-12 max-lg:gap-3 max-lg:px-3 max-lg:text-base max-lg:[&_svg]:h-5 max-lg:[&_svg]:w-5" onClick={openOnboarding}>
              <Wand2 className="mr-2 h-4 w-4" /> {t("mainMenu.setupClis")}
            </DropdownMenuItem>
            <DropdownMenuItem className="hidden cursor-pointer whitespace-nowrap lg:flex" onClick={openPairDeviceDialog}>
              <Smartphone className="mr-2 h-4 w-4" /> {t("mainMenu.connectPhone")}
            </DropdownMenuItem>
            {authEnabled ? (
              <DropdownMenuItem variant="destructive" className="cursor-pointer whitespace-nowrap max-lg:h-12 max-lg:gap-3 max-lg:px-3 max-lg:text-base max-lg:[&_svg]:h-5 max-lg:[&_svg]:w-5" onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" /> {t("mainMenu.signOut")}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});
export { ConversationSidebar };
