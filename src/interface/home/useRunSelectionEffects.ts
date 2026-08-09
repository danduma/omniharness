import { useEffect, useLayoutEffect, useRef } from "react";
import type React from "react";
import { conversationMainManager } from "@/components/component-state-managers";
import { getRunLatestUnreadTimestamp } from "@/lib/conversation-state";
import type { ComposerMode } from "./types";
import type { AgentSnapshot, ComposerWorkerOption, MessageRecord, RunRecord, WorkerType } from "./types";
import { parseWorkerType, resolveComposerEffortLabel, resolveComposerModelValue } from "./utils";
import { useRuntimeAPIs } from "@/runtime-api/provider";

const CONVERSATION_BOTTOM_THRESHOLD_PX = 8;
const CONVERSATION_MEANINGFUL_OVERFLOW_PX = 112;
const SCROLL_AREA_VIEWPORT_SELECTOR = '[data-slot="scroll-area-viewport"], [data-radix-scroll-area-viewport]';

function textVersion(value: string | null | undefined) {
  const text = value ?? "";
  if (text.length <= 128) {
    return text;
  }
  return `${text.length}:${text.slice(0, 64)}:${text.slice(-64)}`;
}

export function shouldConversationFollowLatest(
  metrics: Pick<HTMLDivElement, "scrollTop" | "clientHeight" | "scrollHeight">,
) {
  return metrics.scrollHeight - metrics.clientHeight - metrics.scrollTop <= CONVERSATION_BOTTOM_THRESHOLD_PX;
}

export function shouldConversationShowOutputBelow(
  metrics: Pick<HTMLDivElement, "scrollTop" | "clientHeight" | "scrollHeight">,
) {
  return metrics.scrollHeight - metrics.clientHeight > CONVERSATION_MEANINGFUL_OVERFLOW_PX
    && !shouldConversationFollowLatest(metrics);
}

export function hasMeaningfulConversationOverflow(
  metrics: Pick<HTMLDivElement, "clientHeight" | "scrollHeight">,
) {
  return metrics.scrollHeight - metrics.clientHeight > CONVERSATION_MEANINGFUL_OVERFLOW_PX;
}

/**
 * Following the latest output is cancelled by the reader scrolling UP, and by
 * nothing else.
 *
 * This used to end with a bare `shouldConversationFollowLatest(metrics)`, which
 * meant content growing *beneath* the viewport also cancelled it — the reader
 * had not moved, but they were no longer within 8px of the bottom, so the app
 * decided they had chosen to stop following. `wasFollowing` keeps the intent
 * sticky; a reader who returns to the bottom re-arms it.
 */
export function shouldConversationKeepFollowingLatest(
  metrics: Pick<HTMLDivElement, "scrollTop" | "clientHeight" | "scrollHeight">,
  previousScrollTop: number,
  wasFollowing = false,
) {
  if (metrics.scrollTop < previousScrollTop) {
    return false;
  }

  return wasFollowing || shouldConversationFollowLatest(metrics);
}

/**
 * Re-pin to the bottom when we are supposed to be following but have drifted
 * off it — i.e. content grew below the viewport after we positioned.
 *
 * This replaces a one-shot "retry the initial position" check that was gated on
 * `positionedRunId !== selectedRunId` and therefore could fire at most once per
 * run, during the very pass that marked the run positioned. If that single
 * attempt measured short for any reason, the conversation stayed stranded
 * mid-transcript with no way to recover. Making the condition a property of the
 * current geometry rather than a one-time flag means it self-corrects for every
 * cause of landing short — late layout, async content, or a transcript window
 * that grew after an earlier `loadOlder`.
 *
 * Terminates naturally: once pinned to the bottom
 * `shouldConversationFollowLatest` is true and this returns false.
 */
export function shouldConversationReanchorToLatest({
  selectedRunId,
  selectedRunHasOutput,
  shouldFollowLatest,
  metrics,
}: {
  selectedRunId: string | null;
  selectedRunHasOutput: boolean;
  shouldFollowLatest: boolean;
  metrics: Pick<HTMLDivElement, "scrollTop" | "clientHeight" | "scrollHeight">;
}) {
  return Boolean(
    selectedRunId
    && selectedRunHasOutput
    && shouldFollowLatest
    && hasMeaningfulConversationOverflow(metrics)
    && !shouldConversationFollowLatest(metrics),
  );
}

export function getConversationOutputVersion(
  selectedRunId: string | null,
  messages: MessageRecord[] | undefined,
  agents: AgentSnapshot[] | undefined,
) {
  if (!selectedRunId) {
    return "empty";
  }

  const messageVersion = (messages ?? [])
    .filter((message) => message.runId === selectedRunId)
    .map((message) => `${message.id}:${message.createdAt}:${textVersion(message.content)}`)
    .join("|");
  const agentVersion = (agents ?? [])
    .map((agent) => {
      const outputEntriesVersion = (agent.outputEntries ?? [])
        .map((entry) => `${entry.id}:${entry.type}:${entry.status ?? ""}:${textVersion(entry.text)}`)
        .join(",");
      return `${agent.name}:${textVersion(agent.currentText)}:${textVersion(agent.lastText)}:${outputEntriesVersion}`;
    })
    .join("|");

  return `${selectedRunId}::${messageVersion}::${agentVersion}`;
}

export function hasSelectedRunMessageOutput(
  selectedRunId: string | null,
  messages: MessageRecord[] | undefined,
) {
  if (!selectedRunId) {
    return false;
  }

  return (messages ?? []).some((message) => (
    message.runId === selectedRunId && Boolean(message.content.trim())
  ));
}

interface UseRunSelectionEffectsProps {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  state: { messages?: MessageRecord[]; agents?: AgentSnapshot[] };
  selectedRunId: string | null;
  selectedRun: RunRecord | null;
  activeComposerMode: ComposerMode;
  selectedCliAgent: ComposerWorkerOption;
  setSelectedCliAgent: React.Dispatch<React.SetStateAction<ComposerWorkerOption>>;
  autoSelectedWorkerType: WorkerType | null;
  activeAllowedWorkerTypes: WorkerType[];
  hydratedRunSelectionId: string | null;
  setHydratedRunSelectionId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedModel: string;
  setSelectedModel: React.Dispatch<React.SetStateAction<string>>;
  selectedEffort: string;
  setSelectedEffort: React.Dispatch<React.SetStateAction<string>>;
  selectedWorkerAccountId: string;
  setSelectedWorkerAccountId: React.Dispatch<React.SetStateAction<string>>;
  availableWorkerTypes: WorkerType[];
  configuredAllowedWorkerTypes: WorkerType[];
  apiKeys: Record<string, string>;
  setApiKeys: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  readMarkers: Record<string, string>;
  setReadMarkers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export function resolveRunComposerSelection(args: {
  run: RunRecord;
  activeAllowedWorkerTypes: WorkerType[];
}) {
  const preferredWorker = parseWorkerType(args.run.preferredWorkerType);
  const worker: ComposerWorkerOption = preferredWorker && args.activeAllowedWorkerTypes.includes(preferredWorker)
    ? preferredWorker
    : "auto";
  return {
    worker,
    model: resolveComposerModelValue(args.run.preferredWorkerModel),
    effort: resolveComposerEffortLabel(args.run.preferredWorkerEffort),
    accountId: args.run.preferredWorkerAccountId?.trim() || "auto",
  };
}

export function useRunSelectionEffects({
  scrollRef,
  state,
  selectedRunId,
  selectedRun,
  activeComposerMode,
  selectedCliAgent,
  setSelectedCliAgent,
  autoSelectedWorkerType,
  activeAllowedWorkerTypes,
  hydratedRunSelectionId,
  setHydratedRunSelectionId,
  selectedModel,
  setSelectedModel,
  selectedEffort,
  setSelectedEffort,
  selectedWorkerAccountId,
  setSelectedWorkerAccountId,
  availableWorkerTypes,
  configuredAllowedWorkerTypes,
  apiKeys,
  setApiKeys,
  readMarkers,
  setReadMarkers,
}: UseRunSelectionEffectsProps) {
  const runtimeApis = useRuntimeAPIs();
  const shouldFollowLatestRef = useRef(true);
  const previousScrollTopRef = useRef(0);
  const previousSelectedRunIdRef = useRef<string | null>(null);
  const previousOutputVersionRef = useRef<string | null>(null);
  const instantPositionedRunIdRef = useRef<string | null>(null);
  const persistedReadMarkerRef = useRef<Map<string, string>>(new Map());
  const outputVersion = getConversationOutputVersion(selectedRunId, state.messages, state.agents);
  const selectedRunHasOutput = hasSelectedRunMessageOutput(selectedRunId, state.messages);

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector(SCROLL_AREA_VIEWPORT_SELECTOR) as HTMLDivElement | null;
    if (!viewport) {
      conversationMainManager.setHasOutputBelow(false);
      return;
    }

    const positionAtLatest = (behavior: ScrollBehavior) => {
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior,
      });
      previousScrollTopRef.current = viewport.scrollTop;
      shouldFollowLatestRef.current = true;
      instantPositionedRunIdRef.current = selectedRunId;
    };

    const updateOutputBelowState = () => {
      if (shouldConversationReanchorToLatest({
        selectedRunId,
        selectedRunHasOutput,
        shouldFollowLatest: shouldFollowLatestRef.current,
        metrics: viewport,
      })) {
        positionAtLatest("auto");
      }
      conversationMainManager.setHasOutputBelow(shouldConversationShowOutputBelow(viewport));
    };

    previousScrollTopRef.current = viewport.scrollTop;

    const updateFollowState = () => {
      shouldFollowLatestRef.current = shouldConversationKeepFollowingLatest(
        viewport,
        previousScrollTopRef.current,
        shouldFollowLatestRef.current,
      );
      previousScrollTopRef.current = viewport.scrollTop;
      updateOutputBelowState();
    };

    updateFollowState();
    viewport.addEventListener("scroll", updateFollowState, { passive: true });

    const resizeObserver = new ResizeObserver(updateOutputBelowState);
    resizeObserver.observe(viewport);
    if (viewport.firstElementChild) {
      resizeObserver.observe(viewport.firstElementChild);
    }

    return () => {
      viewport.removeEventListener("scroll", updateFollowState);
      resizeObserver.disconnect();
      conversationMainManager.setHasOutputBelow(false);
    };
  }, [scrollRef, selectedRunHasOutput, selectedRunId]);

  useLayoutEffect(() => {
    const viewport = scrollRef.current?.querySelector(SCROLL_AREA_VIEWPORT_SELECTOR) as HTMLDivElement | null;
    if (!viewport) {
      return;
    }

    const runChanged = previousSelectedRunIdRef.current !== selectedRunId;
    if (runChanged) {
      instantPositionedRunIdRef.current = null;
    }
    previousSelectedRunIdRef.current = selectedRunId;
    const outputChanged = previousOutputVersionRef.current !== outputVersion;
    previousOutputVersionRef.current = outputVersion;

    if (!runChanged && !outputChanged) {
      return;
    }

    if (!runChanged && !shouldFollowLatestRef.current) {
      return;
    }

    const shouldRestoreInstantly = runChanged
      || (selectedRunHasOutput && instantPositionedRunIdRef.current !== selectedRunId);
    const scrollBehavior: ScrollBehavior = shouldRestoreInstantly ? "auto" : "smooth";

    const hasOverflow = hasMeaningfulConversationOverflow(viewport);
    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: scrollBehavior,
    });
    previousScrollTopRef.current = viewport.scrollTop;
    if (selectedRunHasOutput && hasOverflow) {
      instantPositionedRunIdRef.current = selectedRunId;
    }
    shouldFollowLatestRef.current = true;
  }, [scrollRef, outputVersion, selectedRunHasOutput, selectedRunId]);

  useEffect(() => {
    if (!selectedRunId || !selectedRun) {
      setHydratedRunSelectionId(null);
      if (activeComposerMode === "direct") {
        const nextDirectWorker = selectedCliAgent === "auto" ? (autoSelectedWorkerType ?? activeAllowedWorkerTypes[0] ?? "codex") : selectedCliAgent;
        if (!activeAllowedWorkerTypes.includes(nextDirectWorker as WorkerType)) {
          setSelectedCliAgent(autoSelectedWorkerType ?? activeAllowedWorkerTypes[0] ?? "codex");
        } else if (nextDirectWorker !== selectedCliAgent) {
          setSelectedCliAgent(nextDirectWorker);
        }
      } else if (selectedCliAgent !== "auto" && !activeAllowedWorkerTypes.includes(selectedCliAgent)) {
        setSelectedCliAgent("auto");
      }
      return;
    }

    if (hydratedRunSelectionId === selectedRunId) {
      return;
    }

    const runSelection = resolveRunComposerSelection({
      run: selectedRun,
      activeAllowedWorkerTypes,
    });
    if (runSelection.worker !== selectedCliAgent) {
      setSelectedCliAgent(runSelection.worker);
    }
    if (runSelection.model && runSelection.model !== selectedModel) {
      setSelectedModel(runSelection.model);
    }
    if (runSelection.effort && runSelection.effort !== selectedEffort) {
      setSelectedEffort(runSelection.effort);
    }
    if (runSelection.accountId !== selectedWorkerAccountId) {
      setSelectedWorkerAccountId(runSelection.accountId);
    }
    setHydratedRunSelectionId(selectedRunId);
  }, [
    activeComposerMode,
    activeAllowedWorkerTypes,
    autoSelectedWorkerType,
    hydratedRunSelectionId,
    selectedCliAgent,
    selectedEffort,
    selectedModel,
    selectedWorkerAccountId,
    selectedRun,
    selectedRunId,
    setHydratedRunSelectionId,
    setSelectedCliAgent,
    setSelectedEffort,
    setSelectedModel,
    setSelectedWorkerAccountId,
  ]);

  useEffect(() => {
    if (availableWorkerTypes.length === 0) {
      return;
    }

    const availableSet = new Set(availableWorkerTypes);
    const sanitizedAllowed = configuredAllowedWorkerTypes.filter((type) => availableSet.has(type));
    const nextAllowed = sanitizedAllowed.length > 0 ? sanitizedAllowed : [...availableWorkerTypes];
    const normalizedDefault = nextAllowed.includes(apiKeys.WORKER_DEFAULT_TYPE as WorkerType)
      ? apiKeys.WORKER_DEFAULT_TYPE
      : nextAllowed[0];

    if (
      JSON.stringify(nextAllowed) === JSON.stringify(configuredAllowedWorkerTypes) &&
      normalizedDefault === apiKeys.WORKER_DEFAULT_TYPE
    ) {
      return;
    }

    setApiKeys((current) => ({
      ...current,
      WORKER_ALLOWED_TYPES: JSON.stringify(nextAllowed),
      WORKER_DEFAULT_TYPE: normalizedDefault,
    }));
  }, [apiKeys.WORKER_DEFAULT_TYPE, availableWorkerTypes, configuredAllowedWorkerTypes, setApiKeys]);

  useEffect(() => {
    if (!selectedRunId) {
      return;
    }

    if (!selectedRun) {
      return;
    }

    const latestForSelected = getRunLatestUnreadTimestamp(selectedRun, state.messages || []);
    if (!latestForSelected) {
      return;
    }

    if (readMarkers[selectedRunId] === latestForSelected) {
      return;
    }

    setReadMarkers((current) => {
      if (current[selectedRunId] === latestForSelected) {
        return current;
      }
      return { ...current, [selectedRunId]: latestForSelected };
    });

    const persistedKey = `${selectedRunId}:${latestForSelected}`;
    if (persistedReadMarkerRef.current.get(selectedRunId) === persistedKey) {
      return;
    }
    persistedReadMarkerRef.current.set(selectedRunId, persistedKey);

    void runtimeApis.runs.act({
      runId: selectedRunId,
      body: { action: "mark_read" },
    }).catch((error) => {
      persistedReadMarkerRef.current.delete(selectedRunId);
      console.warn("Failed to persist conversation read marker:", error);
    });
  }, [readMarkers, runtimeApis.runs, selectedRunId, selectedRun, state.messages, setReadMarkers]);
}
