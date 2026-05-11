import { useEffect, useRef } from "react";
import type React from "react";
import { type UseMutationResult } from "@tanstack/react-query";
import { type AppErrorDescriptor, mergeAppErrors } from "@/lib/app-errors";
import type { ConversationModeOption } from "@/components/ConversationModePicker";
import {
  clampConversationSidebarWidth,
  clampWorkersSidebarWidth,
  COMPOSER_EFFORT_STORAGE_KEY,
  COMPOSER_MODE_STORAGE_KEY,
  COMPOSER_MODEL_STORAGE_KEY,
  COMPOSER_WORKER_STORAGE_KEY,
  EFFORT_OPTIONS,
  getDefaultConversationSidebarWidth,
  getDefaultWorkersSidebarWidth,
  RUN_PATH_PATTERN,
  WORKER_OPTIONS,
} from "./constants";
import { conversationNotificationManager } from "./ConversationNotificationManager";
import { LiveEventConnectionManager } from "./LiveEventConnectionManager";
import type { ComposerWorkerOption, EventStreamState } from "./types";
import { buildConversationPath, buildInlineError, parseCollapsedProjectPaths } from "./utils";

const lightThemeColor = "#ffffff";
const darkThemeColor = "#0b0d10";

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
  leftSidebarWidth: number;
  setLeftSidebarWidth: React.Dispatch<React.SetStateAction<number>>;
  rightSidebarWidth: number;
  setRightSidebarWidth: React.Dispatch<React.SetStateAction<number>>;
  isResizingLeftSidebar: boolean;
  setIsResizingLeftSidebar: React.Dispatch<React.SetStateAction<boolean>>;
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

function applyDocumentTheme(themeMode: "day" | "night") {
  document.documentElement.classList.toggle("dark", themeMode === "night");
  document.documentElement.style.colorScheme = themeMode === "night" ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    themeMode === "night" ? darkThemeColor : lightThemeColor,
  );
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
  leftSidebarWidth,
  setLeftSidebarWidth,
  rightSidebarWidth,
  setRightSidebarWidth,
  isResizingLeftSidebar,
  setIsResizingLeftSidebar,
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
  const didHydrateConversationSidebarWidthRef = useRef(false);
  const didSkipConversationSidebarInitialPersistRef = useRef(false);
  const didHydrateWorkersSidebarWidthRef = useRef(false);
  const didSkipWorkersSidebarInitialPersistRef = useRef(false);

  useEffect(() => {
    if (!shouldStartLiveEventConnection({ appUnlocked, routeReady })) {
      setHasReceivedInitialEventStreamPayload(false);
      return;
    }

    let isActive = true;
    const applyEventStreamUpdate = (data: EventStreamState) => {
      if (!isActive) {
        return;
      }

      const nextState = filterEventStreamState?.(data) ?? data;
      setState(nextState);
      conversationNotificationManager.handleEventStreamState(nextState);
      setHasReceivedInitialEventStreamPayload(true);
      setRuntimeErrors((current) => mergeAppErrors(
        current.filter((error) => error.source !== "Events"),
        (nextState.frontendErrors ?? []).map((error: unknown) => buildInlineError(error)),
      ));
    };

    const connectionManager = new LiveEventConnectionManager({
      selectedRunId,
      applyUpdate: applyEventStreamUpdate,
      reportError: (error) => {
        if (!isActive) {
          return;
        }
        setRuntimeErrors((current) => mergeAppErrors(current, [buildInlineError(error)]));
      },
    });
    connectionManager.start();

    return () => {
      isActive = false;
      connectionManager.stop();
    };
  }, [
    appUnlocked,
    filterEventStreamState,
    routeReady,
    selectedRunId,
    setHasReceivedInitialEventStreamPayload,
    setRuntimeErrors,
    setState,
  ]);

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
  }, [
    setDraftProjectPath,
    setPairTokenFromUrl,
    setRouteReady,
    setSelectedCliAgent,
    setSelectedConversationMode,
    setSelectedEffort,
    setSelectedModel,
    setSelectedRunId,
  ]);

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
    setPairRedeemAttempted,
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

    const saved = window.localStorage.getItem("omni-conversations-sidebar-width");
    if (!saved) {
      setLeftSidebarWidth(getDefaultConversationSidebarWidth(window.innerWidth));
      didHydrateConversationSidebarWidthRef.current = true;
      return;
    }

    const parsed = Number(saved);
    if (!Number.isFinite(parsed)) {
      setRuntimeErrors((current) => mergeAppErrors(current, [{
        message: "The saved conversations sidebar width in localStorage is invalid.",
        source: "Frontend",
        action: "Restore local layout state",
        suggestion: "Clear the omni-conversations-sidebar-width localStorage entry and reload the page if the conversations sidebar size looks wrong.",
      }]));
      didHydrateConversationSidebarWidthRef.current = true;
      return;
    }

    setLeftSidebarWidth(clampConversationSidebarWidth(parsed, window.innerWidth));
    didHydrateConversationSidebarWidthRef.current = true;
  }, [setLeftSidebarWidth, setRuntimeErrors]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const saved = window.localStorage.getItem("omni-workers-sidebar-width");
    if (!saved) {
      setRightSidebarWidth(getDefaultWorkersSidebarWidth(window.innerWidth));
      didHydrateWorkersSidebarWidthRef.current = true;
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
      didHydrateWorkersSidebarWidthRef.current = true;
      return;
    }

    setRightSidebarWidth(clampWorkersSidebarWidth(parsed, window.innerWidth));
    didHydrateWorkersSidebarWidthRef.current = true;
  }, [setRightSidebarWidth, setRuntimeErrors]);

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
  }, [readMarkers, setRuntimeErrors]);

  useEffect(() => {
    if (typeof window === "undefined" || !didHydrateConversationSidebarWidthRef.current) {
      return;
    }

    if (!didSkipConversationSidebarInitialPersistRef.current) {
      didSkipConversationSidebarInitialPersistRef.current = true;
      return;
    }

    try {
      window.localStorage.setItem("omni-conversations-sidebar-width", String(leftSidebarWidth));
    } catch {
      setRuntimeErrors((current) => mergeAppErrors(current, [{
        message: "Failed to persist conversations sidebar width to localStorage.",
        source: "Frontend",
        action: "Persist local layout state",
      }]));
    }
  }, [leftSidebarWidth, setRuntimeErrors]);

  useEffect(() => {
    if (typeof window === "undefined" || !didHydrateWorkersSidebarWidthRef.current) {
      return;
    }

    if (!didSkipWorkersSidebarInitialPersistRef.current) {
      didSkipWorkersSidebarInitialPersistRef.current = true;
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
  }, [rightSidebarWidth, setRuntimeErrors]);

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
    if (!isResizingLeftSidebar || typeof window === "undefined") {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const nextWidth = event.clientX;
      setLeftSidebarWidth(clampConversationSidebarWidth(nextWidth, window.innerWidth));
    };
    const stopResizing = () => {
      setIsResizingLeftSidebar(false);
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
  }, [isResizingLeftSidebar, setIsResizingLeftSidebar, setLeftSidebarWidth]);

  useEffect(() => {
    if (!isResizingRightSidebar || typeof window === "undefined") {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const nextWidth = window.innerWidth - event.clientX;
      setRightSidebarWidth(clampWorkersSidebarWidth(nextWidth, window.innerWidth));
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
  }, [isResizingRightSidebar, setIsResizingRightSidebar, setRightSidebarWidth]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedThemeMode = window.localStorage.getItem("omni-theme-mode");
    if (savedThemeMode === "day" || savedThemeMode === "night") {
      setThemeMode(savedThemeMode);
    }
  }, [setThemeMode]);

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
    applyDocumentTheme(themeMode);
  }, [themeMode, setRuntimeErrors]);

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

export function shouldStartLiveEventConnection(args: { appUnlocked: boolean; routeReady: boolean }) {
  return args.appUnlocked && args.routeReady;
}
