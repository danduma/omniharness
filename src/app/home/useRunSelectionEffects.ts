import { useEffect, useRef } from "react";
import type React from "react";
import { conversationMainManager } from "@/components/component-state-managers";
import { getRunLatestMessageTimestamp } from "@/lib/conversation-state";
import type { ConversationModeOption } from "@/components/ConversationModePicker";
import type { AgentSnapshot, ComposerWorkerOption, MessageRecord, RunRecord, WorkerType } from "./types";
import { parseWorkerType, resolveComposerEffortLabel, resolveComposerModelValue } from "./utils";

const CONVERSATION_BOTTOM_THRESHOLD_PX = 8;
const SCROLL_AREA_VIEWPORT_SELECTOR = '[data-slot="scroll-area-viewport"], [data-radix-scroll-area-viewport]';

export function shouldConversationFollowLatest(
  metrics: Pick<HTMLDivElement, "scrollTop" | "clientHeight" | "scrollHeight">,
) {
  return metrics.scrollHeight - metrics.clientHeight - metrics.scrollTop <= CONVERSATION_BOTTOM_THRESHOLD_PX;
}

export function shouldConversationShowOutputBelow(
  metrics: Pick<HTMLDivElement, "scrollTop" | "clientHeight" | "scrollHeight">,
) {
  return !shouldConversationFollowLatest(metrics);
}

export function shouldConversationKeepFollowingLatest(
  metrics: Pick<HTMLDivElement, "scrollTop" | "clientHeight" | "scrollHeight">,
  previousScrollTop: number,
) {
  if (metrics.scrollTop < previousScrollTop) {
    return false;
  }

  return shouldConversationFollowLatest(metrics);
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
    .map((message) => `${message.id}:${message.createdAt}:${message.content.length}`)
    .join("|");
  const agentVersion = (agents ?? [])
    .map((agent) => {
      const outputEntriesVersion = (agent.outputEntries ?? [])
        .map((entry) => `${entry.id}:${entry.text.length}:${entry.timestamp}`)
        .join(",");
      return `${agent.name}:${agent.currentText?.length ?? 0}:${agent.lastText?.length ?? 0}:${outputEntriesVersion}`;
    })
    .join("|");

  return `${selectedRunId}::${messageVersion}::${agentVersion}`;
}

interface UseRunSelectionEffectsProps {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  state: { messages?: MessageRecord[]; agents?: AgentSnapshot[] };
  selectedRunId: string | null;
  selectedRun: RunRecord | null;
  activeComposerMode: ConversationModeOption;
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
  availableWorkerTypes: WorkerType[];
  configuredAllowedWorkerTypes: WorkerType[];
  apiKeys: Record<string, string>;
  setApiKeys: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setReadMarkers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
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
  availableWorkerTypes,
  configuredAllowedWorkerTypes,
  apiKeys,
  setApiKeys,
  setReadMarkers,
}: UseRunSelectionEffectsProps) {
  const shouldFollowLatestRef = useRef(true);
  const previousScrollTopRef = useRef(0);
  const previousSelectedRunIdRef = useRef<string | null>(null);
  const previousOutputVersionRef = useRef<string | null>(null);
  const outputVersion = getConversationOutputVersion(selectedRunId, state.messages, state.agents);

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector(SCROLL_AREA_VIEWPORT_SELECTOR) as HTMLDivElement | null;
    if (!viewport) {
      conversationMainManager.setHasOutputBelow(false);
      return;
    }

    const updateOutputBelowState = () => {
      conversationMainManager.setHasOutputBelow(shouldConversationShowOutputBelow(viewport));
    };

    previousScrollTopRef.current = viewport.scrollTop;

    const updateFollowState = () => {
      shouldFollowLatestRef.current = shouldConversationKeepFollowingLatest(viewport, previousScrollTopRef.current);
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
  }, [scrollRef, selectedRunId]);

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector(SCROLL_AREA_VIEWPORT_SELECTOR) as HTMLDivElement | null;
    if (!viewport) {
      return;
    }

    const runChanged = previousSelectedRunIdRef.current !== selectedRunId;
    previousSelectedRunIdRef.current = selectedRunId;
    const outputChanged = previousOutputVersionRef.current !== outputVersion;
    previousOutputVersionRef.current = outputVersion;

    if (!runChanged && !outputChanged) {
      return;
    }

    if (!runChanged && !shouldFollowLatestRef.current) {
      return;
    }

    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: runChanged ? "auto" : "smooth",
    });
    shouldFollowLatestRef.current = true;
    previousScrollTopRef.current = viewport.scrollHeight;
  }, [scrollRef, outputVersion, selectedRunId]);

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

    const preferredFromRun = parseWorkerType(selectedRun.preferredWorkerType);
    const nextSelected: ComposerWorkerOption = preferredFromRun && activeAllowedWorkerTypes.includes(preferredFromRun)
      ? preferredFromRun
      : "auto";
    if (nextSelected !== selectedCliAgent) {
      setSelectedCliAgent(nextSelected);
    }
    const nextModel = resolveComposerModelValue(selectedRun.preferredWorkerModel);
    if (nextModel && nextModel !== selectedModel) {
      setSelectedModel(nextModel);
    }
    const nextEffort = resolveComposerEffortLabel(selectedRun.preferredWorkerEffort);
    if (nextEffort && nextEffort !== selectedEffort) {
      setSelectedEffort(nextEffort);
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
    selectedRun,
    selectedRunId,
    setHydratedRunSelectionId,
    setSelectedCliAgent,
    setSelectedEffort,
    setSelectedModel,
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

    const latestForSelected = getRunLatestMessageTimestamp(selectedRunId, state.messages || []);
    if (!latestForSelected) {
      return;
    }

    setReadMarkers((current) => {
      if (current[selectedRunId] === latestForSelected) {
        return current;
      }
      return { ...current, [selectedRunId]: latestForSelected };
    });
  }, [selectedRunId, state.messages, setReadMarkers]);
}
