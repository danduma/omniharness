import { useEffect, useRef } from "react";
import type React from "react";
import { type UseMutationResult } from "@tanstack/react-query";
import { type AppErrorDescriptor, mergeAppErrors, requestJson } from "@/lib/app-errors";
import type { ConversationModeOption } from "@/components/ConversationModePicker";
import { COMPOSER_EFFORT_STORAGE_KEY, COMPOSER_MODE_STORAGE_KEY, COMPOSER_MODEL_STORAGE_KEY, COMPOSER_WORKER_STORAGE_KEY, EFFORT_OPTIONS, RUN_PATH_PATTERN, WORKER_OPTIONS } from "./constants";
import type { ComposerWorkerOption, EventStreamState } from "./types";
import { buildConversationPath, buildInlineError, parseCollapsedProjectPaths } from "./utils";

interface UseHomeLifecycleProps {
  appUnlocked: boolean;
  setHasReceivedInitialEventStreamPayload: React.Dispatch<React.SetStateAction<boolean>>;
  setState: React.Dispatch<React.SetStateAction<EventStreamState>>;
  setRuntimeErrors: React.Dispatch<React.SetStateAction<AppErrorDescriptor[]>>;
  routeReady: boolean;
  setRouteReady: React.Dispatch<React.SetStateAction<boolean>>;
  authEnabled: boolean;
  authConfigurationError: string | null;
  pairTokenFromUrl: string | null;
  setPairTokenFromUrl: React.Dispatch<React.SetStateAction<string | null>>;
  redeemPairMutation: UseMutationResult<{ ok: true; targetPath: string }, Error, string>;
  pairRedeemAttempted: boolean;
  setPairRedeemAttempted: React.Dispatch<React.SetStateAction<boolean>>;
  selectedRunId: string | null;
  setSelectedRunId: React.Dispatch<React.SetStateAction<string | null>>;
  draftProjectPath: string | null;
  setDraftProjectPath: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedConversationMode: React.Dispatch<React.SetStateAction<ConversationModeOption>>;
  setSelectedCliAgent: React.Dispatch<React.SetStateAction<ComposerWorkerOption>>;
  setSelectedModel: React.Dispatch<React.SetStateAction<string>>;
  setSelectedEffort: React.Dispatch<React.SetStateAction<string>>;
  setReadMarkers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  readMarkers: Record<string, string>;
  collapsedProjectPaths: Set<string>;
  setCollapsedProjectPaths: React.Dispatch<React.SetStateAction<Set<string>>>;
  rightSidebarWidth: number;
  setRightSidebarWidth: React.Dispatch<React.SetStateAction<number>>;
  isResizingRightSidebar: boolean;
  setIsResizingRightSidebar: React.Dispatch<React.SetStateAction<boolean>>;
  selectedConversationMode: ConversationModeOption;
  selectedCliAgent: ComposerWorkerOption;
  selectedModel: string;
  selectedEffort: string;
  themeMode: "day" | "night";
  setThemeMode: React.Dispatch<React.SetStateAction<"day" | "night">>;
  filterEventStreamState?: (state: EventStreamState) => EventStreamState;
}

export function useHomeLifecycle({
  appUnlocked,
  setHasReceivedInitialEventStreamPayload,
  setState,
  setRuntimeErrors,
  routeReady,
  setRouteReady,
  authEnabled,
  authConfigurationError,
  pairTokenFromUrl,
  setPairTokenFromUrl,
  redeemPairMutation,
  pairRedeemAttempted,
  setPairRedeemAttempted,
  selectedRunId,
  setSelectedRunId,
  draftProjectPath,
  setDraftProjectPath,
  setSelectedConversationMode,
  setSelectedCliAgent,
  setSelectedModel,
  setSelectedEffort,
  setReadMarkers,
  readMarkers,
  collapsedProjectPaths,
  setCollapsedProjectPaths,
  rightSidebarWidth,
  setRightSidebarWidth,
  isResizingRightSidebar,
  setIsResizingRightSidebar,
  selectedConversationMode,
  selectedCliAgent,
  selectedModel,
  selectedEffort,
  themeMode,
  setThemeMode,
  filterEventStreamState,
}: UseHomeLifecycleProps) {
  const didMountThemeEffectRef = useRef(false);
  const didHydrateCollapsedProjectsRef = useRef(false);
  const didSkipCollapsedProjectsInitialPersistRef = useRef(false);

  useEffect(() => {
    if (!appUnlocked) {
      setHasReceivedInitialEventStreamPayload(false);
      return;
    }

    let isActive = true;
    let isPollingSnapshot = false;

    const applyEventStreamUpdate = (data: EventStreamState) => {
      if (!isActive) {
        return;
      }

      const nextState = filterEventStreamState?.(data) ?? data;
      setState(nextState);
      setHasReceivedInitialEventStreamPayload(true);
      setRuntimeErrors((current) => mergeAppErrors(
        current.filter((error) => error.source !== "Events"),
        (nextState.frontendErrors ?? []).map((error: unknown) => buildInlineError(error)),
      ));
    };

    const pollSnapshot = async () => {
      if (isPollingSnapshot) {
        return;
      }

      isPollingSnapshot = true;
      try {
        const data = await requestJson<EventStreamState>("/api/events?snapshot=1", undefined, {
          source: "Events",
          action: "Load live state snapshot",
        });
        applyEventStreamUpdate(data);
      } catch (error) {
        if (!isActive) {
          return;
        }
        setRuntimeErrors((current) => mergeAppErrors(current, [
          buildInlineError(error, {
            source: "Events",
            action: "Load live state snapshot",
          }),
        ]));
      } finally {
        isPollingSnapshot = false;
      }
    };

    const eventSource = new EventSource("/api/events");
    eventSource.addEventListener("update", (e) => {
      try {
        const data = JSON.parse(e.data);
        applyEventStreamUpdate(data);
      } catch {
        setRuntimeErrors((current) => mergeAppErrors(current, [{
          message: "The frontend received a malformed update payload from /api/events.",
          source: "Events",
          action: "Process live updates",
          suggestion: "Inspect the events route response payload and server logs, then refresh the page after fixing the malformed data.",
        }]));
      }
    });
    eventSource.addEventListener("update_error", (e) => {
      try {
        const data = JSON.parse(e.data);
        setRuntimeErrors((current) => mergeAppErrors(current, [
          buildInlineError(data, {
            source: "Events",
            action: "Stream live updates",
          }),
        ]));
      } catch {
        setRuntimeErrors((current) => mergeAppErrors(current, [{
          message: "The live event stream reported a malformed error payload.",
          source: "Events",
          action: "Stream live updates",
        }]));
      }
    });
    eventSource.onerror = () => {
      setRuntimeErrors((current) => mergeAppErrors(current, [{
        message: "The frontend lost its live connection to /api/events.",
        source: "Events",
        action: "Stream live updates",
        suggestion: "Keep this page open while the app reconnects. If the error persists, refresh the page and inspect the server logs for the events route.",
      }]));
      void pollSnapshot();
    };
    const snapshotPollInterval = window.setInterval(() => {
      void pollSnapshot();
    }, 1_500);
    void pollSnapshot();

    return () => {
      isActive = false;
      window.clearInterval(snapshotPollInterval);
      eventSource.close();
    };
  }, [appUnlocked, filterEventStreamState]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const pathnameMatch = window.location.pathname.match(RUN_PATH_PATTERN);
    const routeRunId = pathnameMatch?.[1]?.trim() || "";
    const params = new URLSearchParams(window.location.search);
    const routeProjectPath = params.get("project")?.trim() || "";
    const routePairToken = params.get("pair")?.trim() || "";
    const savedMode = window.localStorage.getItem(COMPOSER_MODE_STORAGE_KEY)?.trim() || "";
    const savedWorker = window.localStorage.getItem(COMPOSER_WORKER_STORAGE_KEY)?.trim() || "";
    const savedModel = window.localStorage.getItem(COMPOSER_MODEL_STORAGE_KEY)?.trim() || "";
    const savedEffort = window.localStorage.getItem(COMPOSER_EFFORT_STORAGE_KEY)?.trim() || "";

    setPairTokenFromUrl(routePairToken || null);

    if (routeRunId) {
      setSelectedRunId(routeRunId);
      setDraftProjectPath(null);
    } else if (routeProjectPath) {
      setDraftProjectPath(routeProjectPath);
      setSelectedRunId(null);
    }

    if (savedMode === "planning" || savedMode === "implementation" || savedMode === "direct") {
      setSelectedConversationMode(savedMode);
    }
    if (savedWorker === "auto" || WORKER_OPTIONS.some((option) => option.value === savedWorker)) {
      setSelectedCliAgent(savedWorker as ComposerWorkerOption);
    }
    if (savedModel) {
      setSelectedModel(savedModel);
    }
    if (EFFORT_OPTIONS.includes(savedEffort)) {
      setSelectedEffort(savedEffort);
    }

    setRouteReady(true);
  }, []);

  useEffect(() => {
    if (!routeReady || !authEnabled || authConfigurationError || appUnlocked || !pairTokenFromUrl || redeemPairMutation.isPending || pairRedeemAttempted) {
      return;
    }

    setPairRedeemAttempted(true);
    void redeemPairMutation.mutateAsync(pairTokenFromUrl);
  }, [
    appUnlocked,
    authConfigurationError,
    authEnabled,
    pairRedeemAttempted,
    pairTokenFromUrl,
    redeemPairMutation,
    routeReady,
  ]);

  useEffect(() => {
    if (typeof window === "undefined" || !routeReady) {
      return;
    }

    if (pairTokenFromUrl && !appUnlocked) {
      return;
    }

    const nextPath = buildConversationPath(selectedRunId, draftProjectPath);
    const currentPath = `${window.location.pathname}${window.location.search}`;
    if (currentPath !== nextPath) {
      window.history.replaceState(window.history.state, "", nextPath);
    }
  }, [appUnlocked, draftProjectPath, pairTokenFromUrl, routeReady, selectedRunId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const saved = window.localStorage.getItem("omni-read-markers");
      if (saved) {
        setReadMarkers(JSON.parse(saved));
      }
    } catch {
      setRuntimeErrors((current) => mergeAppErrors(current, [{
        message: "The saved read marker state in localStorage is malformed.",
        source: "Frontend",
        action: "Restore local conversation state",
        suggestion: "Clear the omni-read-markers localStorage entry and reload the page if unread markers look wrong.",
      }]));
    }
  }, [setReadMarkers, setRuntimeErrors]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      setCollapsedProjectPaths(parseCollapsedProjectPaths(window.localStorage.getItem("omni-collapsed-projects")));
    } catch {
      setRuntimeErrors((current) => mergeAppErrors(current, [{
        message: "The saved project group state in localStorage is malformed.",
        source: "Frontend",
        action: "Restore local navigation state",
        suggestion: "Clear the omni-collapsed-projects localStorage entry and reload the page if project expansion looks wrong.",
      }]));
    } finally {
      didHydrateCollapsedProjectsRef.current = true;
    }
  }, [setCollapsedProjectPaths, setRuntimeErrors]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const saved = window.localStorage.getItem("omni-workers-sidebar-width");
    if (!saved) {
      return;
    }

    const parsed = Number(saved);
    if (!Number.isFinite(parsed)) {
      setRuntimeErrors((current) => mergeAppErrors(current, [{
        message: "The saved worker sidebar width in localStorage is invalid.",
        source: "Frontend",
        action: "Restore local layout state",
        suggestion: "Clear the omni-workers-sidebar-width localStorage entry and reload the page if the worker sidebar size looks wrong.",
      }]));
      return;
    }

    setRightSidebarWidth(Math.min(720, Math.max(320, parsed)));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem("omni-read-markers", JSON.stringify(readMarkers));
    } catch {
      setRuntimeErrors((current) => mergeAppErrors(current, [{
        message: "Failed to persist read marker state to localStorage.",
        source: "Frontend",
        action: "Persist local conversation state",
      }]));
    }
  }, [readMarkers]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem("omni-workers-sidebar-width", String(rightSidebarWidth));
    } catch {
      setRuntimeErrors((current) => mergeAppErrors(current, [{
        message: "Failed to persist worker sidebar width to localStorage.",
        source: "Frontend",
        action: "Persist local layout state",
      }]));
    }
  }, [rightSidebarWidth]);

  useEffect(() => {
    if (typeof window === "undefined" || !didHydrateCollapsedProjectsRef.current) {
      return;
    }

    if (!didSkipCollapsedProjectsInitialPersistRef.current) {
      didSkipCollapsedProjectsInitialPersistRef.current = true;
      return;
    }

    try {
      window.localStorage.setItem("omni-collapsed-projects", JSON.stringify(Array.from(collapsedProjectPaths)));
    } catch {
      setRuntimeErrors((current) => mergeAppErrors(current, [{
        message: "Failed to persist project group state to localStorage.",
        source: "Frontend",
        action: "Persist local navigation state",
      }]));
    }
  }, [collapsedProjectPaths, setRuntimeErrors]);

  useEffect(() => {
    if (!isResizingRightSidebar || typeof window === "undefined") {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const nextWidth = window.innerWidth - event.clientX;
      setRightSidebarWidth(Math.min(720, Math.max(320, nextWidth)));
    };
    const stopResizing = () => {
      setIsResizingRightSidebar(false);
    };
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
    };
  }, [isResizingRightSidebar]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedThemeMode = window.localStorage.getItem("omni-theme-mode");
    if (savedThemeMode === "day" || savedThemeMode === "night") {
      setThemeMode(savedThemeMode);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!didMountThemeEffectRef.current) {
      didMountThemeEffectRef.current = true;
      return;
    }

    try {
      window.localStorage.setItem("omni-theme-mode", themeMode);
    } catch {
      setRuntimeErrors((current) => mergeAppErrors(current, [{
        message: "Failed to persist theme mode to localStorage.",
        source: "Frontend",
        action: "Persist theme preference",
      }]));
    }
    document.documentElement.classList.toggle("dark", themeMode === "night");
    document.documentElement.style.colorScheme = themeMode === "night" ? "dark" : "light";
  }, [themeMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(COMPOSER_MODE_STORAGE_KEY, selectedConversationMode);
  }, [selectedConversationMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(COMPOSER_WORKER_STORAGE_KEY, selectedCliAgent);
  }, [selectedCliAgent]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(COMPOSER_MODEL_STORAGE_KEY, selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(COMPOSER_EFFORT_STORAGE_KEY, selectedEffort);
  }, [selectedEffort]);
}
