import { useEffect } from "react";
import type React from "react";
import { getRunLatestMessageTimestamp } from "@/lib/conversation-state";
import type { ConversationModeOption } from "@/components/ConversationModePicker";
import type { ComposerWorkerOption, MessageRecord, RunRecord, WorkerType } from "./types";
import { parseWorkerType, resolveComposerEffortLabel, resolveComposerModelValue } from "./utils";

interface UseRunSelectionEffectsProps {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  state: { messages?: MessageRecord[]; agents?: unknown[] };
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
  // Auto-scroll chat to bottom
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [state.messages, selectedRunId, state.agents]);

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
  }, [apiKeys.WORKER_DEFAULT_TYPE, availableWorkerTypes, configuredAllowedWorkerTypes]);

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
  }, [selectedRunId, state.messages]);
}
