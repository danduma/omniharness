"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Terminal } from "@/components/Terminal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Folder, Settings, Terminal as TerminalIcon, PanelRight, Plus, Search, Blocks, Clock, CheckCircle2, XCircle, Cpu, ArrowUp, FolderPlus, MoreHorizontal, Trash2, LoaderCircle, Menu, Pencil, Sun, Moon, RotateCcw, GitBranch, AlertTriangle, ChevronDown, X } from "lucide-react";
import { FolderPickerDialog } from "@/components/FolderPickerDialog";
import { FileAttachmentPickerDialog, type AttachmentItem } from "@/components/FileAttachmentPickerDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ClarificationPanel } from "@/components/ClarificationPanel";
import { type AppErrorDescriptor, appErrorKey, mergeAppErrors, normalizeAppError, requestJson } from "@/lib/app-errors";
import { resolveProjectScope } from "@/lib/project-scope";
import { getActiveMentionQuery, replaceActiveMention } from "@/lib/mentions";
import { getRunLatestMessageTimestamp, isRunUnread } from "@/lib/conversation-state";
import { buildConversationGroups } from "@/lib/conversations";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type PlanRecord = { id: string; path: string };
type RunRecord = {
  id: string;
  planId: string;
  status: string;
  createdAt: string;
  failedAt?: string | null;
  lastError?: string | null;
  projectPath: string | null;
  title: string | null;
  preferredWorkerType?: string | null;
  preferredWorkerModel?: string | null;
  preferredWorkerEffort?: string | null;
  allowedWorkerTypes?: string | null;
};
type PlanItemRecord = { id: string; planId: string; title: string; phase: string | null; status: string };
type ClarificationRecord = { id: string; runId: string; question: string; answer: string | null; status: string };
type MessageRecord = {
  id: string;
  runId: string;
  role: string;
  kind?: string | null;
  content: string;
  createdAt: string;
};
type ExecutionEventRecord = {
  id: string;
  runId: string;
  workerId?: string | null;
  planItemId?: string | null;
  eventType: string;
  details?: string | null;
  createdAt: string;
};
type AgentSnapshot = {
  name: string;
  type?: string;
  cwd?: string;
  state: string;
  requestedModel?: string | null;
  effectiveModel?: string | null;
  requestedEffort?: string | null;
  effectiveEffort?: string | null;
  sessionMode?: string | null;
  sessionId?: string | null;
  protocolVersion?: string | number | null;
  lastError?: string | null;
  recentStderr?: string[];
  pendingPermissions?: Array<{ requestId: number; requestedAt: string; sessionId?: string | null; options?: Array<{ optionId: string; kind: string; name: string }> }>;
  createdAt?: string;
  updatedAt?: string;
  contextUsage?: {
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
    maxTokens?: number | null;
    fullnessPercent?: number | null;
  } | null;
  lastText?: string;
  currentText?: string;
  stderrBuffer?: string[];
  stopReason?: string | null;
};
type ProjectFilesResponse = { root: string; files: string[] };
type WorkerType = "codex" | "claude" | "gemini" | "opencode";
type ComposerWorkerOption = WorkerType | "auto";
type WorkerAvailability = {
  type: WorkerType;
  label: string;
  availability: {
    status: "ok" | "warning" | "error";
    binary: boolean;
    apiKey: boolean | null;
    endpoint: boolean | null;
    message?: string;
  };
};
type WorkerCatalogResponse = { workers: WorkerAvailability[] };
type SettingsResponse = { values: Record<string, string>; diagnostics?: AppErrorDescriptor[] };
type EventStreamState = {
  messages: MessageRecord[];
  plans: PlanRecord[];
  runs: RunRecord[];
  accounts: unknown[];
  agents: AgentSnapshot[];
  workers: Array<{ id: string; runId: string; type: string; status: string }>;
  planItems: PlanItemRecord[];
  clarifications: ClarificationRecord[];
  validationRuns: Array<{ runId: string }>;
  executionEvents: ExecutionEventRecord[];
  frontendErrors?: AppErrorDescriptor[];
};
type SettingsTab = "llm" | "workers";

const WORKER_OPTIONS: Array<{ value: WorkerType; label: string }> = [
  { value: "codex", label: "Codex" },
  { value: "claude", label: "Claude Code" },
  { value: "gemini", label: "Gemini" },
  { value: "opencode", label: "OpenCode" },
] as const;
const COMPOSER_WORKER_OPTIONS: Array<{ value: ComposerWorkerOption; label: string }> = [
  { value: "auto", label: "Auto" },
  ...WORKER_OPTIONS,
] as const;
const DEFAULT_ALLOWED_WORKER_TYPES = JSON.stringify(WORKER_OPTIONS.map((option) => option.value));
const MODEL_OPTIONS = ["GPT-5.4", "GPT-5.4 Mini", "Claude Sonnet 4"];
const EFFORT_OPTIONS = ["Low", "Medium", "High"];

type SidebarRun = { id: string; title: string; path: string; status: string; createdAt: string };
type SidebarGroup = { path: string; name: string; runs: SidebarRun[] };

function buildInlineError(
  error: unknown,
  fallback: Partial<AppErrorDescriptor> = {},
): AppErrorDescriptor {
  return normalizeAppError(error, fallback);
}

function ErrorNotice({
  error,
}: {
  error: AppErrorDescriptor;
}) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm shadow-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <div>
            <div className="font-semibold text-destructive">{error.action || error.source || "Error"}</div>
            <div className="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground">
              {error.message}
            </div>
          </div>
          {error.suggestion ? (
            <div className="mt-2 text-xs leading-relaxed text-muted-foreground">{error.suggestion}</div>
          ) : null}
          {error.details?.length ? (
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              {error.details.map((detail) => (
                <div key={detail} className="whitespace-pre-wrap break-words font-mono">
                  {detail}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface ConversationSidebarProps {
  filteredProjects: SidebarGroup[];
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  selectedRunId: string | null;
  messages: Array<{ runId: string; createdAt: string }> | undefined;
  readMarkers: Record<string, string>;
  showSettings: boolean;
  setShowSettings: React.Dispatch<React.SetStateAction<boolean>>;
  openFolderPicker: () => void;
  startNewPlan: () => void;
  beginConversationInProject: (projectPath: string) => void;
  handleRemoveProject: (pathToRemove: string) => void;
  selectRun: (runId: string) => void;
  renamingRunId: string | null;
  renameValue: string;
  setRenameValue: (value: string) => void;
  startRenamingRun: (run: SidebarRun) => void;
  commitRenamingRun: (runId: string) => void;
  cancelRenamingRun: () => void;
  deleteRun: (run: SidebarRun) => void;
}

type LlmProfileTab = "supervisor" | "fallback";
type LlmFieldPrefix = "SUPERVISOR_LLM" | "SUPERVISOR_FALLBACK_LLM";

const LLM_PROVIDER_OPTIONS = [
  { value: "gemini", label: "Gemini" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "openai-compatible", label: "OpenAI-Compatible" },
] as const;

function parseWorkerTypes(value: string | null | undefined): WorkerType[] {
  if (!value?.trim()) {
    return WORKER_OPTIONS.map((option) => option.value);
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return WORKER_OPTIONS.map((option) => option.value);
    }

    const allowed = new Set(WORKER_OPTIONS.map((option) => option.value));
    const normalized = parsed
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry): entry is WorkerType => allowed.has(entry as WorkerType));

    return normalized.length > 0 ? Array.from(new Set(normalized)) : WORKER_OPTIONS.map((option) => option.value);
  } catch {
    return WORKER_OPTIONS.map((option) => option.value);
  }
}

function parseProjectList(value: string | null | undefined) {
  if (!value?.trim()) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

function parseWorkerType(value: string | null | undefined): WorkerType | null {
  if (!value?.trim()) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return WORKER_OPTIONS.some((option) => option.value === normalized) ? normalized as WorkerType : null;
}

function parseBooleanSetting(value: string | null | undefined, defaultValue: boolean) {
  if (!value?.trim()) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

function summarizeThought(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 220);
}

function parseExecutionEventDetails(details: string | null | undefined) {
  if (!details) {
    return {} as Record<string, unknown>;
  }

  try {
    const parsed = JSON.parse(details) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function summarizeExecutionEvent(event: ExecutionEventRecord) {
  const details = parseExecutionEventDetails(event.details);
  const summary = typeof details.summary === "string" ? details.summary.trim() : "";
  const reason = typeof details.reason === "string" ? details.reason.trim() : "";
  const error = typeof details.error === "string" ? details.error.trim() : "";
  const seconds = typeof details.seconds === "number" ? details.seconds : null;
  const mode = typeof details.mode === "string" ? details.mode.trim() : "";
  const workerLabel = event.workerId || "worker";

  if (event.eventType === "supervisor_wait") {
    const waitReason = summary || reason || "Waiting before the next supervisor check";
    return seconds ? `Waiting ${seconds}s: ${waitReason}` : waitReason;
  }

  if (event.eventType === "run_failed") {
    return `Run failed${reason || summary || error ? `: ${reason || summary || error}` : ""}`;
  }

  if (event.eventType === "run_completed") {
    return `Completed${summary ? `: ${summary}` : ""}`;
  }

  if (event.eventType === "worker_prompt_failed") {
    return `Failed to send task to ${workerLabel}${error ? `: ${error}` : ""}`;
  }

  if (event.eventType === "worker_spawned") {
    return `Started ${workerLabel}`;
  }

  if (event.eventType === "worker_prompted") {
    return `Sent task to ${workerLabel}`;
  }

  if (event.eventType === "worker_mode_changed") {
    return `Changed ${workerLabel} to ${mode || "requested"} mode`;
  }

  if (event.eventType === "worker_permission_requested") {
    return `${workerLabel} requested permission`;
  }

  if (event.eventType === "worker_permission_approved") {
    return `Approved permission for ${workerLabel}`;
  }

  if (event.eventType === "worker_permission_auto_approved") {
    return `Auto-approved permission for ${workerLabel}`;
  }

  if (event.eventType === "worker_session_resumed") {
    return `Resumed ${workerLabel} from saved session`;
  }

  if (event.eventType === "worker_permission_denied") {
    return `Denied permission for ${workerLabel}`;
  }

  if (event.eventType === "worker_cancelled") {
    return `Cancelled ${workerLabel}`;
  }

  if (event.eventType === "worker_output_changed") {
    return `${workerLabel} produced new output`;
  }

  if (event.eventType === "worker_idle") {
    return `${workerLabel} is waiting`;
  }

  if (event.eventType === "worker_stuck") {
    return `${workerLabel} appears stuck`;
  }

  if (event.eventType === "worker_error") {
    return `${workerLabel} reported an error`;
  }

  if (event.eventType === "worker_stopped") {
    return `${workerLabel} stopped`;
  }

  if (event.eventType === "clarification_requested") {
    return `Waiting for your reply${summary ? `: ${summary}` : ""}`;
  }

  return summary || reason || error || event.eventType.replace(/_/g, " ");
}

function formatExecutionTimestamp(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function describeAgentActivity(agent: AgentSnapshot) {
  if ((agent.pendingPermissions?.length ?? 0) > 0) {
    return `${agent.name}: waiting for permission`;
  }

  if (agent.state === "starting") {
    return `${agent.name}: connecting to ACP bridge`;
  }

  if (agent.state === "working" && agent.currentText?.trim()) {
    return `${agent.name}: ${summarizeThought(agent.currentText)}`;
  }

  if (agent.state === "working") {
    return `${agent.name}: waiting for LLM API`;
  }

  if (agent.state === "error") {
    return `${agent.name}: ${agent.lastError || agent.stopReason || "worker error"}`;
  }

  if (agent.state === "stopped") {
    return `${agent.name}: stopped${agent.stopReason ? ` (${agent.stopReason})` : ""}`;
  }

  if (agent.state === "idle") {
    return `${agent.name}: waiting for more work`;
  }

  return `${agent.name}: ${agent.state}`;
}

function resolveSelectedWorkerModel(workerType: WorkerType, selectedModel: string) {
  if (workerType === "opencode") {
    if (selectedModel === "GPT-5.4") return "openai/gpt-5.4";
    if (selectedModel === "GPT-5.4 Mini") return "openai/gpt-5.4-mini";
    if (selectedModel === "Claude Sonnet 4") return "anthropic/claude-sonnet-4";
  }

  if (workerType === "codex") {
    if (selectedModel === "GPT-5.4") return "gpt-5.4";
    if (selectedModel === "GPT-5.4 Mini") return "gpt-5.4-mini";
    if (selectedModel === "Claude Sonnet 4") return "claude-sonnet-4";
  }

  return selectedModel;
}

function LlmSettingsForm({
  prefix,
  title,
  description,
  apiKeys,
  setApiKeys,
}: {
  prefix: LlmFieldPrefix;
  title: string;
  description: string;
  apiKeys: Record<string, string>;
  setApiKeys: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const providerKey = `${prefix}_PROVIDER`;
  const modelKey = `${prefix}_MODEL`;
  const baseUrlKey = `${prefix}_BASE_URL`;
  const apiKeyKey = `${prefix}_API_KEY`;
  const defaultProvider = prefix === "SUPERVISOR_LLM" ? "gemini" : "openai";
  const provider = apiKeys[providerKey] || defaultProvider;
  const apiKey = apiKeys[apiKeyKey] || "";
  const currentModel = apiKeys[modelKey] || "";

  const geminiModelsQuery = useQuery({
    queryKey: ["llm-models", prefix, provider, apiKey],
    enabled: provider === "gemini" && apiKey.trim().length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      return requestJson<{ models: Array<{ id: string; label: string }> }>("/api/llm-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey,
        }),
      }, {
        source: "LLM Settings",
        action: "Fetch available models",
      });
    },
  });
  const availableModels = useMemo(() => geminiModelsQuery.data?.models ?? [], [geminiModelsQuery.data?.models]);

  useEffect(() => {
    if (provider !== "gemini") {
      return;
    }

    if (!availableModels.length) {
      return;
    }

    if (!currentModel.trim()) {
      setApiKeys((previous) => ({ ...previous, [modelKey]: availableModels[0].id }));
    }
  }, [availableModels, currentModel, modelKey, provider, setApiKeys]);

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
      <div className="space-y-1">
        <div className="text-sm font-semibold">{title}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor={providerKey}>
            Provider
          </label>
          <select
            id={providerKey}
            className="h-8 w-full rounded border bg-muted/50 px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
            value={apiKeys[providerKey] || defaultProvider}
            onChange={(e) => setApiKeys((previous) => ({ ...previous, [providerKey]: e.target.value }))}
          >
            {LLM_PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor={modelKey}>
            Model
          </label>
          {provider === "gemini" ? (
            <Combobox
              items={availableModels}
              value={availableModels.find((model) => model.id === currentModel) ?? null}
              itemToStringValue={(model) => model.label}
              onValueChange={(model) => {
                setApiKeys((previous) => ({
                  ...previous,
                  [modelKey]: model?.id ?? "",
                }));
              }}
              disabled={!apiKey.trim() || geminiModelsQuery.isPending}
            >
              <ComboboxInput
                id={modelKey}
                aria-label="Model"
                placeholder={
                  !apiKey.trim()
                    ? "Enter API key first"
                    : geminiModelsQuery.isPending
                      ? "Loading models..."
                      : "Search Gemini models"
                }
                className="w-full"
              />
              <ComboboxContent className="w-[var(--anchor-width)]">
                <ComboboxEmpty>
                  {!apiKey.trim()
                    ? "Enter API key first"
                    : geminiModelsQuery.isPending
                      ? "Loading models..."
                      : "No Gemini models available"}
                </ComboboxEmpty>
                <ComboboxList>
                  {(model) => (
                    <ComboboxItem key={model.id} value={model}>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">{model.label}</span>
                        <span className="truncate text-[11px] text-muted-foreground">{model.id}</span>
                      </div>
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          ) : (
            <Input
              id={modelKey}
              value={currentModel}
              onChange={(e) => setApiKeys((previous) => ({ ...previous, [modelKey]: e.target.value }))}
              placeholder={prefix === "SUPERVISOR_LLM" ? "gemini-3.1-pro-preview" : "gpt-5.4-mini"}
              className="h-8 bg-muted/50 text-xs"
            />
          )}
          {provider === "gemini" ? (
            <p className="text-[11px] text-muted-foreground">
              Gemini model ids load automatically from the API key and appear in a searchable dropdown.
            </p>
          ) : null}
          {geminiModelsQuery.isError ? (
            <p className="text-[11px] text-destructive">
              {geminiModelsQuery.error instanceof Error ? geminiModelsQuery.error.message : "Unable to fetch available models."}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor={baseUrlKey}>
            Endpoint
          </label>
          <Input
            id={baseUrlKey}
            value={apiKeys[baseUrlKey] || ""}
            onChange={(e) => setApiKeys((previous) => ({ ...previous, [baseUrlKey]: e.target.value }))}
            placeholder="Optional custom base URL"
            className="h-8 bg-muted/50 text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor={apiKeyKey}>
            API Key
          </label>
          <Input
            id={apiKeyKey}
            type="password"
            value={apiKeys[apiKeyKey] || ""}
            onChange={(e) => setApiKeys((previous) => ({ ...previous, [apiKeyKey]: e.target.value }))}
            placeholder="Provider credential"
            className="h-8 bg-muted/50 text-xs"
          />
        </div>
      </div>
    </div>
  );
}

function ConversationSidebar({
  filteredProjects,
  searchQuery,
  setSearchQuery,
  selectedRunId,
  messages,
  readMarkers,
  showSettings,
  setShowSettings,
  openFolderPicker,
  startNewPlan,
  beginConversationInProject,
  handleRemoveProject,
  selectRun,
  renamingRunId,
  renameValue,
  setRenameValue,
  startRenamingRun,
  commitRenamingRun,
  cancelRenamingRun,
  deleteRun,
}: ConversationSidebarProps) {
  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-muted/30">
      <div className="mt-2 space-y-1 p-3">
        <Button variant="ghost" className="h-9 w-full justify-start px-2 text-sm" onClick={startNewPlan}>
          <Plus className="mr-2 h-4 w-4" /> New chat
        </Button>
        <div className="relative mt-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full border-transparent bg-muted/50 pl-8 text-sm transition-all hover:border-border focus-visible:border-border focus-visible:bg-background focus-visible:ring-1"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full px-3">
          <div className="space-y-4 py-4">
          <div className="ml-2 mr-1 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted-foreground">PROJECTS</h3>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={openFolderPicker}>
              <FolderPlus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {filteredProjects.length > 0 ? (
            filteredProjects.map((group) => (
              <Collapsible key={group.path} defaultOpen>
                <div className="group mb-1 flex items-center justify-between rounded px-2 hover:bg-muted/30">
                  <CollapsibleTrigger className="flex flex-1 items-center gap-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                    <Folder className="h-4 w-4 shrink-0 text-primary/70" />
                    <span className="truncate">{group.name}</span>
                  </CollapsibleTrigger>

                  {group.path !== "other" && (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground opacity-100 hover:text-foreground lg:opacity-0 lg:group-hover:opacity-100"
                        title={`New conversation in ${group.name}`}
                        onClick={() => beginConversationInProject(group.path)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sm font-medium text-muted-foreground opacity-100 transition-colors ring-offset-background hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 lg:opacity-0 lg:group-hover:opacity-100">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem className="cursor-pointer whitespace-nowrap text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => handleRemoveProject(group.path)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Remove Project
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>

                <CollapsibleContent className="space-y-0.5">
                  {group.runs.length === 0 && (
                    <div className="py-1 pl-8 text-xs italic text-muted-foreground/60">No conversations</div>
                  )}
                  {group.runs.map((run) => (
                    <div
                      key={run.id}
                      onClick={() => selectRun(run.id)}
                      className={`ml-3 group flex min-w-0 cursor-pointer gap-2 overflow-hidden rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                        selectedRunId === run.id
                          ? "border-primary/20 bg-primary/10 font-medium text-primary"
                          : "border-transparent text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      <div className="flex w-4 shrink-0 items-center justify-center">
                        {run.status === "running" ? (
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin text-blue-500" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="min-w-0 flex items-center justify-between gap-2" title={run.path}>
                          {renamingRunId === run.id ? (
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
                          <div className="flex shrink-0 items-center gap-1">
                            {isRunUnread({
                              latestMessageAt: getRunLatestMessageTimestamp(run.id, messages || []),
                              lastReadAt: readMarkers[run.id] ?? null,
                            }) ? (
                              <div className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                            ) : run.status === "done" ? (
                              <CheckCircle2 className="ml-2 h-3 w-3 shrink-0 text-green-500" />
                            ) : run.status === "failed" ? (
                              <XCircle className="ml-2 h-3 w-3 shrink-0 text-red-500" />
                            ) : null}
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                onClick={(event) => event.stopPropagation()}
                                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sm font-medium text-muted-foreground opacity-100 transition-colors ring-offset-background hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 lg:opacity-0 lg:group-hover:opacity-100"
                                aria-label={`Conversation actions for ${run.title}`}
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  className="cursor-pointer whitespace-nowrap"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    startRenamingRun(run);
                                  }}
                                >
                                  <Pencil className="mr-2 h-4 w-4" /> Rename conversation
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  className="cursor-pointer whitespace-nowrap"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    deleteRun(run);
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete conversation
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] opacity-70">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(run.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ))
          ) : (
            <p className="pl-2 text-sm text-muted-foreground">No projects added.</p>
          )}
          </div>
        </ScrollArea>
      </div>

      <div className="mt-auto shrink-0 border-t border-border/60 bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Button variant="ghost" className="h-9 w-full justify-start px-2 text-sm text-muted-foreground hover:text-foreground" onClick={() => setShowSettings(!showSettings)}>
          <Settings className="mr-2 h-4 w-4" /> Settings
        </Button>
      </div>
    </div>
  );
}

interface WorkersSidebarProps {
  agents: AgentSnapshot[];
  preferredModel: string | null;
  preferredEffort: string | null;
  onClose?: () => void;
}

interface ThemeModeToggleProps {
  themeMode: "day" | "night";
  setThemeMode: React.Dispatch<React.SetStateAction<"day" | "night">>;
}

function ThemeModeToggle({ themeMode, setThemeMode }: ThemeModeToggleProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground hover:text-foreground"
      aria-label={themeMode === "night" ? "Switch to day mode" : "Switch to night mode"}
      title={themeMode === "night" ? "Switch to day mode" : "Switch to night mode"}
      onClick={() => setThemeMode((current) => (current === "day" ? "night" : "day"))}
    >
      {themeMode === "night" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function renderContextMeter(fullnessPercent: number | null | undefined) {
  const normalized = typeof fullnessPercent === "number" && Number.isFinite(fullnessPercent)
    ? Math.min(100, Math.max(0, Math.round(fullnessPercent)))
    : null;
  const meterTone = normalized === null
    ? "#3f3f46"
    : normalized >= 85
      ? "#f43f5e"
      : normalized >= 60
        ? "#f59e0b"
        : "#34d399";
  const meterFill = normalized === null ? 0 : normalized;

  return (
    <div
      aria-label={normalized === null ? "Context usage unavailable" : `Context usage ${normalized}%`}
      className="relative h-7 w-7 shrink-0 rounded-full border border-white/10 bg-black/20"
      title={normalized === null ? "Context usage unavailable" : `Context usage ${normalized}%`}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: `conic-gradient(${meterTone} ${meterFill}%, rgba(255,255,255,0.08) ${meterFill}% 100%)` }}
      />
      <div className="absolute inset-[4px] rounded-full bg-[#0d0f12]" />
    </div>
  );
}

function formatWorkerRuntime(type: string | undefined) {
  if (!type) {
    return null;
  }

  return WORKER_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

type PendingPermissionRecord = NonNullable<AgentSnapshot["pendingPermissions"]>[number];

function PermissionWarning({ pendingPermissions }: { pendingPermissions: PendingPermissionRecord[] }) {
  const [open, setOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const permissionCount = pendingPermissions.length;
  const summary = `${permissionCount} permission request${permissionCount === 1 ? "" : "s"} waiting`;

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!popupRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div ref={popupRef} className="relative">
      <button
        type="button"
        aria-label={summary}
        title={summary}
        className="group relative flex h-7 w-7 items-center justify-center rounded-full border border-amber-400/30 bg-amber-500/12 text-amber-200 transition-colors hover:bg-amber-500/18"
        onClick={() => setOpen((current) => !current)}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        {!open ? (
          <div className="pointer-events-none absolute right-0 top-8 hidden min-w-max rounded-md border border-amber-400/20 bg-[#17120a] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100 shadow-lg group-hover:block">
            Permissions waiting
          </div>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-9 z-30 w-80 rounded-xl border border-amber-400/20 bg-[#17120a] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200">Permissions waiting</div>
          <div className="space-y-2">
            {pendingPermissions.map((permission) => (
              <div key={permission.requestId} className="rounded-lg border border-white/10 bg-black/20 p-2 text-[11px] text-zinc-200">
                <div className="font-semibold text-amber-100">Request {permission.requestId}</div>
                <div className="mt-1 text-zinc-400">{permission.requestedAt}</div>
                {permission.options?.length ? (
                  <div className="mt-2 space-y-1">
                    {permission.options.map((option) => (
                      <div key={option.optionId} className="rounded-md bg-white/5 px-2 py-1">
                        <span className="font-medium text-zinc-100">{option.kind}</span>
                        <span className="text-zinc-400"> {option.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-zinc-400">No option details available yet.</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WorkersSidebar({ agents, preferredModel, preferredEffort, onClose }: WorkersSidebarProps) {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-muted/10">
      <div className="flex items-center justify-between border-b p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Cpu className="h-4 w-4" /> Conversation Workers
        </h3>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onClose}>
            <XCircle className="h-4 w-4" />
          </Button>
        )}
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className={cn(agents.length > 0 ? "space-y-4" : "flex h-full min-h-full flex-col")}>
          {agents.length > 0 ? (
            agents.map((agent) => {
              const configuredModel = agent.requestedModel || preferredModel;
              const configuredEffort = agent.requestedEffort || preferredEffort;
              const activeModel = agent.effectiveModel || configuredModel;
              const activeEffort = agent.effectiveEffort || configuredEffort;
              const pendingPermissions = agent.pendingPermissions ?? [];
              const runtimeLabel = formatWorkerRuntime(agent.type);

              return (
                <div key={agent.name} className="overflow-hidden rounded-xl border border-white/10 bg-[#0d0f12] text-zinc-100 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
                  <div className="border-b border-white/10 bg-[#13161b] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1.5">
                        <div className="break-all font-mono text-xs font-semibold leading-5" title={agent.name}>
                          {agent.name}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {runtimeLabel ? (
                            <span className="rounded-md border border-cyan-400/30 bg-cyan-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-100">
                              {runtimeLabel}
                            </span>
                          ) : null}
                          {activeModel ? (
                            <span className="max-w-full truncate rounded-md border border-fuchsia-400/25 bg-fuchsia-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-fuchsia-100" title={activeModel}>
                              {activeModel}
                            </span>
                          ) : null}
                          {activeEffort ? <span className="text-[11px] text-zinc-400">{activeEffort}</span> : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {pendingPermissions.length > 0 ? <PermissionWarning pendingPermissions={pendingPermissions} /> : null}
                        {renderContextMeter(agent.contextUsage?.fullnessPercent)}
                        {agent.state === "working" ? <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> : null}
                        <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-300">
                          {agent.state}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="relative h-44 w-full bg-[#050607]">
                    <Terminal agentName={agent.name} />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex h-full min-h-[16rem] flex-1 flex-col items-center justify-center rounded-md border border-dashed bg-transparent text-xs text-muted-foreground">
              <TerminalIcon className="mb-2 h-6 w-6 opacity-30" />
              No workers running for this conversation.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function Home() {
  const [command, setCommand] = useState("");
  const [themeMode, setThemeMode] = useState<"day" | "night">("day");
  const [showSettings, setShowSettings] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>("llm");
  const [activeLlmProfileTab, setActiveLlmProfileTab] = useState<LlmProfileTab>("supervisor");
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({
    SUPERVISOR_LLM_PROVIDER: 'gemini',
    SUPERVISOR_LLM_MODEL: 'gemini-3.1-pro-preview',
    SUPERVISOR_LLM_BASE_URL: '',
    SUPERVISOR_LLM_API_KEY: '',
    SUPERVISOR_FALLBACK_LLM_PROVIDER: 'openai',
    SUPERVISOR_FALLBACK_LLM_MODEL: 'gpt-5.4-mini',
    SUPERVISOR_FALLBACK_LLM_BASE_URL: '',
    SUPERVISOR_FALLBACK_LLM_API_KEY: '',
    CREDIT_STRATEGY: 'swap_account',
    WORKER_DEFAULT_TYPE: 'codex',
    WORKER_ALLOWED_TYPES: DEFAULT_ALLOWED_WORKER_TYPES,
    WORKER_YOLO_MODE: 'true',
    PROJECTS: '[]',
  });
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(420);
  const [isResizingRightSidebar, setIsResizingRightSidebar] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileWorkersOpen, setMobileWorkersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [draftProjectPath, setDraftProjectPath] = useState<string | null>(null);
  const [commandCursor, setCommandCursor] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [readMarkers, setReadMarkers] = useState<Record<string, string>>({});
  const [renamingRunId, setRenamingRunId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageValue, setEditingMessageValue] = useState("");
  const [executionDetailsOpen, setExecutionDetailsOpen] = useState(false);
  const [selectedCliAgent, setSelectedCliAgent] = useState<ComposerWorkerOption>("auto");
  const [selectedModel, setSelectedModel] = useState("GPT-5.4");
  const [selectedEffort, setSelectedEffort] = useState("High");
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  
  const [state, setState] = useState<EventStreamState>({
    messages: [],
    plans: [],
    runs: [],
    accounts: [],
    agents: [],
    workers: [],
    planItems: [],
    clarifications: [],
    validationRuns: [],
    executionEvents: [],
    frontendErrors: [],
  });
  const [runtimeErrors, setRuntimeErrors] = useState<AppErrorDescriptor[]>([]);
  const [settingsDiagnostics, setSettingsDiagnostics] = useState<AppErrorDescriptor[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const commandInputRef = useRef<HTMLTextAreaElement>(null);

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const data = await requestJson<SettingsResponse>("/api/settings", undefined, {
        source: "Settings",
        action: "Load saved settings",
      });
      setApiKeys(prev => ({ ...prev, ...(data.values || {}) }));
      setSettingsDiagnostics(data.diagnostics ?? []);
      return data;
    },
  });

  const workerCatalogQuery = useQuery<WorkerCatalogResponse & { diagnostics?: AppErrorDescriptor[] }>({
    queryKey: ["worker-catalog"],
    staleTime: 60_000,
    queryFn: async () => {
      return requestJson<WorkerCatalogResponse & { diagnostics?: AppErrorDescriptor[] }>("/api/agents/catalog", undefined, {
        source: "Bridge",
        action: "Load worker availability",
      });
    },
  });

  const explicitProjects = useMemo(() => parseProjectList(apiKeys.PROJECTS), [apiKeys.PROJECTS]);

  useEffect(() => {
    const eventSource = new EventSource("/api/events");
    eventSource.addEventListener("update", (e) => {
      try {
        const data = JSON.parse(e.data);
        setState(data);
        setRuntimeErrors((current) => mergeAppErrors(
          current.filter((error) => error.source !== "Events"),
          (data.frontendErrors ?? []).map((error: unknown) => buildInlineError(error)),
        ));
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
    };

    return () => {
      eventSource.close();
    };
  }, []);

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
  }, []);

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
    if (!selectedRunId) {
      setRightSidebarOpen(false);
      setMobileWorkersOpen(false);
    }
  }, [selectedRunId]);

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

  const saveSettings = useMutation({
    mutationFn: async () => {
      await requestJson<{ ok: true }>("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiKeys),
      }, {
        source: "Settings",
        action: "Save settings",
      });
    },
    onSuccess: () => setShowSettings(false),
  });

  const answerClarification = useMutation({
    mutationFn: async ({ clarificationId, answer }: { clarificationId: string; answer: string }) => {
      if (!selectedRunId) throw new Error("No run selected");
      return requestJson(`/api/runs/${selectedRunId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clarificationId, answer }),
      }, {
        source: "Clarifications",
        action: "Answer clarification",
      });
    },
  });

  const renameRun = useMutation({
    mutationFn: async ({ runId, title }: { runId: string; title: string }) => {
      return requestJson(`/api/runs/${runId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      }, {
        source: "Runs",
        action: "Rename conversation",
      });
    },
    onSuccess: (_data, variables) => {
      setState((current: typeof state) => ({
        ...current,
        runs: (current.runs || []).map((run: RunRecord) =>
          run.id === variables.runId ? { ...run, title: variables.title } : run
        ),
      }));
      setRenamingRunId(null);
      setRenameValue("");
    },
  });

  const deleteRun = useMutation({
    mutationFn: async ({ runId }: { runId: string }) => {
      return requestJson(`/api/runs/${runId}`, {
        method: "DELETE",
      }, {
        source: "Runs",
        action: "Delete conversation",
      });
    },
    onSuccess: (_data, variables) => {
      const runToDelete = (state.runs || []).find((run: RunRecord) => run.id === variables.runId);
      const workerIds = (state.workers || [])
        .filter((worker: { runId: string; id: string }) => worker.runId === variables.runId)
        .map((worker: { id: string }) => worker.id);

      setState((current: typeof state) => ({
        ...current,
        runs: (current.runs || []).filter((run: RunRecord) => run.id !== variables.runId),
        messages: (current.messages || []).filter((message: { runId: string }) => message.runId !== variables.runId),
        workers: (current.workers || []).filter((worker: { runId: string }) => worker.runId !== variables.runId),
        clarifications: (current.clarifications || []).filter((item: { runId: string }) => item.runId !== variables.runId),
        validationRuns: (current.validationRuns || []).filter((item: { runId: string }) => item.runId !== variables.runId),
        executionEvents: (current.executionEvents || []).filter((item: { runId: string; workerId?: string | null }) =>
          item.runId !== variables.runId && (!item.workerId || !workerIds.includes(item.workerId))
        ),
        plans: runToDelete
          ? (current.plans || []).filter((plan: PlanRecord) => plan.id !== runToDelete.planId)
          : current.plans,
        planItems: runToDelete
          ? (current.planItems || []).filter((item: PlanItemRecord) => item.planId !== runToDelete.planId)
          : current.planItems,
      }));

      if (selectedRunId === variables.runId) {
        setSelectedRunId(null);
      }
      if (renamingRunId === variables.runId) {
        setRenamingRunId(null);
        setRenameValue("");
      }
    },
  });

  const recoverRun = useMutation({
    mutationFn: async ({ runId, action, targetMessageId, content }: { runId: string; action: "retry" | "edit" | "fork"; targetMessageId: string; content?: string }) => {
      return requestJson<{ runId?: string }>(`/api/runs/${runId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, targetMessageId, content }),
      }, {
        source: "Runs",
        action: "Recover conversation",
      });
    },
    onSuccess: (data) => {
      if (data.runId) {
        setSelectedRunId(data.runId);
      }
      setEditingMessageId(null);
      setEditingMessageValue("");
    },
  });

  const runCommand = useMutation({
    mutationFn: async (cmd: string) => {
      const isAutoWorkerSelection = selectedCliAgent === "auto";
      const resolvedSelectedModel = isAutoWorkerSelection ? null : resolveSelectedWorkerModel(selectedCliAgent, selectedModel);
      return requestJson<{ runId?: string }>("/api/supervisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: cmd,
          projectPath: currentProjectScope,
          preferredWorkerType: isAutoWorkerSelection ? null : selectedCliAgent,
          preferredWorkerModel: resolvedSelectedModel,
          preferredWorkerEffort: selectedEffort.toLowerCase(),
          allowedWorkerTypes: isAutoWorkerSelection ? activeAllowedWorkerTypes : [selectedCliAgent],
          attachments: attachments.map(({ kind, name, path }) => ({ kind, name, path })),
        }),
      }, {
        source: "Supervisor",
        action: "Start a run",
      });
    },
    onSuccess: (data) => {
      setCommand("");
      setAttachments([]);
      if (data.runId) setSelectedRunId(data.runId);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim()) {
      runCommand.mutate(command);
    }
  };

  const handleStartNewPlan = () => {
    setSelectedRunId(null);
    setDraftProjectPath(null);
    setCommand("");
    setAttachments([]);
    setMobileNavOpen(false);
  };

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [state.messages, selectedRunId, state.agents]);

  const handleAddProject = (newPath: string) => {
    if (!explicitProjects.includes(newPath)) {
      const newProjects = [...explicitProjects, newPath];
      const updatedKeys = { ...apiKeys, PROJECTS: JSON.stringify(newProjects) };
      setApiKeys(updatedKeys);
      fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatedKeys) });
    }
  };

  const handleRemoveProject = (pathToRemove: string) => {
    const newProjects = explicitProjects.filter((p: string) => p !== pathToRemove);
    const updatedKeys = { ...apiKeys, PROJECTS: JSON.stringify(newProjects) };
    setApiKeys(updatedKeys);
    fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatedKeys) });
  };

  const beginConversationInProject = (projectPath: string) => {
    setSelectedRunId(null);
    setDraftProjectPath(projectPath);
    setCommand("");
    setAttachments([]);
    setMobileNavOpen(false);
    requestAnimationFrame(() => {
      commandInputRef.current?.focus();
      commandInputRef.current?.setSelectionRange(0, 0);
    });
  };

  const groupedProjects = buildConversationGroups({
    explicitProjects,
    plans: (state.plans || []) as PlanRecord[],
    runs: (state.runs || []) as RunRecord[],
  });

  const filteredProjects = groupedProjects.map((group: { path: string, name: string, runs: unknown[] }) => {
    if (!searchQuery) return group;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runs = (group.runs as any[]).filter((run: { path: string; title: string }) =>
      run.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      run.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return { ...group, runs };
  }).filter((group: { name: string, runs: unknown[] }) => group.runs.length > 0 || group.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleSelectRun = (runId: string) => {
    setSelectedRunId(runId);
    setDraftProjectPath(null);
    setMobileNavOpen(false);
  };

  const handleStartRenamingRun = (run: SidebarRun) => {
    setRenamingRunId(run.id);
    setRenameValue(run.title);
  };

  const handleCancelRenamingRun = () => {
    setRenamingRunId(null);
    setRenameValue("");
  };

  const handleCommitRenamingRun = (runId: string) => {
    const nextTitle = renameValue.trim().replace(/\s+/g, " ");
    const existingRun = (state.runs || []).find((run: RunRecord) => run.id === runId);
    if (!nextTitle || nextTitle === (existingRun?.title || "New conversation")) {
      handleCancelRenamingRun();
      return;
    }

    renameRun.mutate({ runId, title: nextTitle });
  };

  const handleDeleteRun = (run: SidebarRun) => {
    if (!window.confirm(`Delete "${run.title}"? This cannot be undone.`)) {
      return;
    }

    deleteRun.mutate({ runId: run.id });
  };

  const runs = (state.runs || []) as RunRecord[];
  const plans = (state.plans || []) as PlanRecord[];
  const clarifications = (state.clarifications || []) as ClarificationRecord[];
  const selectedRun = selectedRunId ? runs.find((run) => run.id === selectedRunId) ?? null : null;
  useEffect(() => {
    setExecutionDetailsOpen(false);
  }, [selectedRunId]);
  const catalogWorkers = useMemo(
    () => workerCatalogQuery.data?.workers ?? [],
    [workerCatalogQuery.data?.workers],
  );
  const availableWorkerTypes = useMemo(
    () => catalogWorkers
      .filter((worker) => worker.availability.status === "ok")
      .map((worker) => worker.type),
    [catalogWorkers],
  );
  const configuredAllowedWorkerTypes = useMemo(
    () => parseWorkerTypes(apiKeys.WORKER_ALLOWED_TYPES),
    [apiKeys.WORKER_ALLOWED_TYPES],
  );
  const selectedRunAllowedWorkerTypes = useMemo(
    () => parseWorkerTypes(selectedRun?.allowedWorkerTypes),
    [selectedRun?.allowedWorkerTypes],
  );
  const activeAllowedWorkerTypes = useMemo(() => {
    const configured = selectedRun ? selectedRunAllowedWorkerTypes : configuredAllowedWorkerTypes;
    if (availableWorkerTypes.length === 0) {
      return configured;
    }

    const availableSet = new Set(availableWorkerTypes);
    const filtered = configured.filter((type) => availableSet.has(type));
    return filtered.length > 0 ? filtered : [...availableWorkerTypes];
  }, [availableWorkerTypes, configuredAllowedWorkerTypes, selectedRun, selectedRunAllowedWorkerTypes]);
  const composerWorkerOptions = useMemo(() => {
    const allowedSet = new Set(activeAllowedWorkerTypes);
    return COMPOSER_WORKER_OPTIONS.filter((option) => option.value === "auto" || allowedSet.has(option.value));
  }, [activeAllowedWorkerTypes]);
  const settingsWorkers = useMemo(() => {
    if (catalogWorkers.length > 0) {
      return catalogWorkers;
    }

    return WORKER_OPTIONS.map((option) => ({
      type: option.value,
      label: option.label,
      availability: {
        status: "warning" as const,
        binary: false,
        apiKey: null,
        endpoint: null,
        message: "Worker availability has not loaded yet.",
      },
    }));
  }, [catalogWorkers]);
  const configuredAllowedWorkerSet = useMemo(
    () => new Set(configuredAllowedWorkerTypes),
    [configuredAllowedWorkerTypes],
  );
  const filteredMessages = selectedRunId 
    ? state.messages?.filter((m: { runId: string }) => m.runId === selectedRunId) 
    : [];

  // Active agents for the selected conversation
  const conversationWorkers = useMemo(() => {
    if (!selectedRunId || !state.workers || !state.agents) {
      return [];
    }

    return state.workers.filter((w: { runId: string, id: string }) => (
      w.runId === selectedRunId && state.agents.some((a: AgentSnapshot) => a.name === w.id)
    ));
  }, [selectedRunId, state.workers, state.agents]);
  const selectedRunWorkers = useMemo(() => {
    if (!selectedRunId || !state.workers) {
      return [] as Array<{ id: string; runId: string; type: string; status: string }>;
    }

    return (state.workers || []).filter((worker: { runId: string }) => worker.runId === selectedRunId);
  }, [selectedRunId, state.workers]);
  const conversationAgentQueries = useQueries({
    queries: conversationWorkers.map((worker: { id: string }) => ({
      queryKey: ["conversation-agent", worker.id],
      queryFn: async () => {
        return requestJson<AgentSnapshot>(`/api/agents/${worker.id}`, undefined, {
          source: "Bridge",
          action: `Load worker details for ${worker.id}`,
        });
      },
      refetchInterval: 2000,
    })),
  });
  const conversationAgents = useMemo(() => {
    const detailedAgents = conversationAgentQueries
      .map((query) => query.data)
      .filter((agent): agent is AgentSnapshot => Boolean(agent));
    if (detailedAgents.length > 0) {
      return detailedAgents;
    }

    if (!conversationWorkers.length || !state.agents?.length) {
      return [] as AgentSnapshot[];
    }

    const workerIds = new Set(conversationWorkers.map((worker: { id: string }) => worker.id));
    return (state.agents as AgentSnapshot[]).filter((agent) => workerIds.has(agent.name));
  }, [conversationAgentQueries, conversationWorkers, state.agents]);
  const latestUserCheckpoint = selectedRunId
    ? [...((filteredMessages || []) as MessageRecord[])]
        .filter((message) => message.role === "user")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null
    : null;
  const liveThoughts = useMemo(() => {
    const seen = new Set<string>();

    return conversationAgents
      .map((agent) => {
        const rawThought = agent.currentText?.trim() || agent.lastText?.trim() || "";
        const snippet = summarizeThought(rawThought);
        if (!snippet) {
          return null;
        }

        const key = `${agent.name}:${snippet}`;
        if (seen.has(key)) {
          return null;
        }
        seen.add(key);

        return {
          agentName: agent.name,
          snippet,
          isLive: Boolean(agent.currentText?.trim()),
        };
      })
      .filter((thought): thought is { agentName: string; snippet: string; isLive: boolean } => Boolean(thought))
      .slice(0, 3);
  }, [conversationAgents]);
  const selectedRunExecutionEvents = useMemo(() => (
    ((state.executionEvents || []) as ExecutionEventRecord[])
      .filter((event) => event.runId === selectedRunId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  ), [selectedRunId, state.executionEvents]);
  const recentExecutionEvents = selectedRunExecutionEvents.slice(0, 6);
  const latestExecutionEvent = selectedRunExecutionEvents[0] ?? null;
  const agentQueryErrors = conversationAgentQueries
    .flatMap((query, index) => query.error ? [buildInlineError(query.error, {
      source: "Bridge",
      action: `Load worker details for ${conversationWorkers[index]?.id ?? "worker"}`,
    })] : []);
  const pendingPermissionAgent = conversationAgents.find((agent) => (agent.pendingPermissions?.length ?? 0) > 0) ?? null;
  const erroredAgent = conversationAgents.find((agent) => agent.state === "error" || Boolean(agent.lastError) || Boolean(agent.stopReason)) ?? null;
  const latestWaitEvent = selectedRunExecutionEvents.find((event) => event.eventType === "supervisor_wait") ?? null;
  const latestStuckEvent = selectedRunExecutionEvents.find((event) => event.eventType === "worker_stuck") ?? null;
  const hasStuckWorker = selectedRunWorkers.some((worker) => worker.status === "stuck")
    || conversationAgents.some((agent) => agent.state === "stuck")
    || Boolean(latestStuckEvent);
  const hasActiveWorker = conversationAgents.some((agent) => (
    agent.state === "working"
    || agent.state === "starting"
    || Boolean(agent.currentText?.trim())
  ));
  const latestExecutionAgeMs = latestExecutionEvent
    ? Date.now() - new Date(latestExecutionEvent.createdAt).getTime()
    : Number.POSITIVE_INFINITY;
  const showRecoverableRunningState = Boolean(
    selectedRun?.status === "running"
      && latestUserCheckpoint
      && !pendingPermissionAgent
      && !hasActiveWorker
      && (
        hasStuckWorker
        || (selectedRunWorkers.length === 0 && latestExecutionAgeMs >= 30_000)
      )
  );
  const liveExecutionStatus = useMemo(() => {
    if (selectedRun?.status === "failed") {
      return {
        label: "Bridge error",
        detail: selectedRun.lastError || (latestExecutionEvent ? summarizeExecutionEvent(latestExecutionEvent) : "The run failed."),
        tone: "error" as const,
      };
    }

    if (erroredAgent) {
      return {
        label: "Bridge error",
        detail: erroredAgent.lastError || erroredAgent.stopReason || "A worker reported an error.",
        tone: "error" as const,
      };
    }

    if (pendingPermissionAgent) {
      const requestCount = pendingPermissionAgent.pendingPermissions?.length ?? 0;
      return {
        label: "Awaiting permission",
        detail: `${pendingPermissionAgent.name} is waiting on ${requestCount} permission ${requestCount === 1 ? "decision" : "decisions"}.`,
        tone: "warning" as const,
      };
    }

    if (selectedRun?.status === "awaiting_user") {
      return {
        label: "Awaiting input",
        detail: "The supervisor asked for clarification before continuing.",
        tone: "warning" as const,
      };
    }

    if (hasStuckWorker) {
      return {
        label: "Stuck",
        detail: latestStuckEvent
          ? summarizeExecutionEvent(latestStuckEvent)
          : "The worker stopped making progress. Retry the latest message to restart the turn.",
        tone: "warning" as const,
      };
    }

    if (showRecoverableRunningState) {
      return {
        label: "Needs recovery",
        detail: "This conversation is still marked running, but nothing active is attached to it. Retry the latest message to unstick it.",
        tone: "warning" as const,
      };
    }

    if (latestWaitEvent && !conversationAgents.some((agent) => agent.state === "working")) {
      const details = parseExecutionEventDetails(latestWaitEvent.details);
      const seconds = typeof details.seconds === "number" ? details.seconds : null;
      return {
        label: seconds ? `Waiting ${seconds}s` : "Waiting",
        detail: summarizeExecutionEvent(latestWaitEvent),
        tone: "muted" as const,
      };
    }

    if (conversationAgents.some((agent) => agent.state === "working" || Boolean(agent.currentText?.trim()))) {
      return {
        label: "Thinking",
        detail: liveThoughts[0]?.snippet || "The worker is actively reasoning.",
        tone: "active" as const,
      };
    }

    if (selectedRun?.status === "done") {
      return {
        label: "Completed",
        detail: latestExecutionEvent ? summarizeExecutionEvent(latestExecutionEvent) : "The run finished.",
        tone: "muted" as const,
      };
    }

    return {
      label: "Thinking",
      detail: latestExecutionEvent ? summarizeExecutionEvent(latestExecutionEvent) : "The supervisor is still checking the run.",
      tone: "active" as const,
    };
  }, [conversationAgents, erroredAgent, hasStuckWorker, latestExecutionEvent, latestStuckEvent, latestWaitEvent, liveThoughts, pendingPermissionAgent, selectedRun, showRecoverableRunningState]);
  const executionDetailLines = useMemo(() => {
    const lines: Array<{ text: string; createdAt?: string }> = [];

    const pushLine = (text: string, createdAt?: string) => {
      if (!text || lines.some((line) => line.text === text)) {
        return;
      }
      lines.push({ text, createdAt });
    };

    if (conversationAgents.length === 0 && selectedRun?.status === "running" && !showRecoverableRunningState) {
      pushLine("Connecting to ACP bridge");
    }

    for (const agent of conversationAgents) {
      pushLine(describeAgentActivity(agent));
    }

    for (const event of recentExecutionEvents) {
      pushLine(summarizeExecutionEvent(event), event.createdAt);
    }

    if (agentQueryErrors.length > 0) {
      for (const error of agentQueryErrors.slice(0, 2)) {
        pushLine(error.message || "Failed to load worker details");
      }
    }

    if (lines.length === 0 && selectedRun?.status === "failed" && selectedRun.lastError) {
      pushLine(selectedRun.lastError);
    }

    return lines.slice(0, 6);
  }, [agentQueryErrors, conversationAgents, recentExecutionEvents, selectedRun, showRecoverableRunningState]);
  const isConversationThinking = selectedRun?.status === "running" || conversationAgents.some((agent) => agent.state === "working");
  const showConversationExecution = Boolean(
    selectedRun && (isConversationThinking || selectedRun.status === "failed" || selectedRunExecutionEvents.length > 0)
  );
  const conversationThinking = (
    <div className="group flex w-full flex-col text-sm">
      <div className="mb-1.5 flex items-center gap-2 px-1">
        <span
          className={cn(
            "text-xs font-semibold tracking-wide",
            liveExecutionStatus.tone === "error"
              ? "text-destructive"
              : liveExecutionStatus.tone === "warning"
                ? "text-amber-700"
                : "text-amber-600",
          )}
        >
          {liveExecutionStatus.label}
        </span>
        <div className="flex items-center gap-1" aria-hidden={liveExecutionStatus.tone !== "active"}>
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                liveExecutionStatus.tone === "error"
                  ? "bg-destructive/70"
                  : liveExecutionStatus.tone === "warning"
                    ? "bg-amber-500/80"
                    : "bg-amber-500/80 animate-pulse",
              )}
              style={{ animationDelay: `${index * 180}ms` }}
            />
          ))}
        </div>
      </div>
      {liveExecutionStatus.detail ? (
        <p className="mb-2 px-1 text-xs leading-relaxed text-muted-foreground">{liveExecutionStatus.detail}</p>
      ) : null}
      {liveThoughts.length > 0 ? (
        <div className="mb-1 space-y-1 px-1">
          {liveThoughts.map((thought) => (
            <p key={`${thought.agentName}:${thought.snippet}`} className="text-xs leading-relaxed text-muted-foreground">
              {thought.agentName}: {thought.snippet}
            </p>
          ))}
        </div>
      ) : null}
      <Collapsible open={executionDetailsOpen} onOpenChange={setExecutionDetailsOpen}>
        <CollapsibleTrigger className="mt-2 flex items-center gap-2 px-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", executionDetailsOpen ? "rotate-180" : "")} />
          <span>{executionDetailsOpen ? "Hide details" : "Show details"}</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-1 pt-2 pl-6">
          {executionDetailLines.length > 0 ? executionDetailLines.map((line, index) => {
            return (
              <p key={`${line.text}-${index}`} className="text-xs leading-relaxed text-muted-foreground">
                {line.createdAt ? `${formatExecutionTimestamp(line.createdAt)} ` : ""}
                {line.text}
              </p>
            );
          }) : (
            <p className="text-xs leading-relaxed text-muted-foreground">No execution details yet.</p>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );

  const currentProjectScope = resolveProjectScope({
    draftProjectPath,
    selectedRunId,
    plans,
    runs,
    explicitProjects,
  });

  const projectFilesQuery = useQuery<ProjectFilesResponse>({
    queryKey: ["project-files", currentProjectScope],
    queryFn: async () => {
      return requestJson<ProjectFilesResponse>(`/api/fs/files?root=${encodeURIComponent(currentProjectScope || "")}`, undefined, {
        source: "Filesystem",
        action: "Load project files",
      });
    },
    enabled: Boolean(currentProjectScope),
    staleTime: 60_000,
  });

  const activePlan = selectedRunId && runs.length && plans.length
    ? plans.find((p) => p.id === runs.find((r) => r.id === selectedRunId)?.planId) ?? null
    : null;
  const selectedClarifications = selectedRunId ? clarifications.filter((item) => item.runId === selectedRunId) : [];
  const appErrors = useMemo(() => {
    const errors: AppErrorDescriptor[] = [];

    errors.push(...(state.frontendErrors ?? []).map((error) => buildInlineError(error)));
    errors.push(...runtimeErrors);
    errors.push(...agentQueryErrors);

    if (projectFilesQuery.error) {
      errors.push(buildInlineError(projectFilesQuery.error, {
        source: "Filesystem",
        action: "Load project files",
      }));
    }

    if (settingsQuery.error) {
      errors.push(buildInlineError(settingsQuery.error, {
        source: "Settings",
        action: "Load saved settings",
      }));
    }

    if (runCommand.error) {
      errors.push(buildInlineError(runCommand.error, {
        source: "Supervisor",
        action: "Start a run",
      }));
    }

    if (recoverRun.error) {
      errors.push(buildInlineError(recoverRun.error, {
        source: "Runs",
        action: "Recover conversation",
      }));
    }

    if (renameRun.error) {
      errors.push(buildInlineError(renameRun.error, {
        source: "Runs",
        action: "Rename conversation",
      }));
    }

    if (deleteRun.error) {
      errors.push(buildInlineError(deleteRun.error, {
        source: "Runs",
        action: "Delete conversation",
      }));
    }

    return mergeAppErrors([], errors);
  }, [
    agentQueryErrors,
    deleteRun.error,
    projectFilesQuery.error,
    recoverRun.error,
    renameRun.error,
    runCommand.error,
    settingsQuery.error,
    runtimeErrors,
    state.frontendErrors,
  ]);

  useEffect(() => {
    if (selectedRun) {
      const preferredFromRun = parseWorkerType(selectedRun.preferredWorkerType);
      const nextSelected: ComposerWorkerOption = preferredFromRun && activeAllowedWorkerTypes.includes(preferredFromRun)
        ? preferredFromRun
        : "auto";
      if (nextSelected && nextSelected !== selectedCliAgent) {
        setSelectedCliAgent(nextSelected);
      }
      return;
    }

    if (selectedCliAgent !== "auto") {
      setSelectedCliAgent("auto");
    }
  }, [activeAllowedWorkerTypes, apiKeys.WORKER_DEFAULT_TYPE, selectedCliAgent, selectedRun]);

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
  const activeMention = getActiveMentionQuery(command, commandCursor);
  const filteredProjectFiles = useMemo(() => {
    if (!activeMention) {
      return [];
    }

    const files = projectFilesQuery.data?.files ?? [];
    const needle = activeMention.query.toLowerCase();
    return files
      .filter((filePath) => needle.length === 0 || filePath.toLowerCase().includes(needle))
      .slice(0, 12);
  }, [activeMention, projectFilesQuery.data?.files]);
  const showMentionPicker = Boolean(
    activeMention && currentProjectScope && (filteredProjectFiles.length > 0 || projectFilesQuery.isFetched)
  );

  useEffect(() => {
    setMentionIndex(0);
  }, [activeMention?.query, currentProjectScope]);

  const applyMention = (filePath: string) => {
    if (!activeMention) {
      return;
    }

    const nextValue = replaceActiveMention(command, activeMention, filePath);
    const nextCursor = activeMention.start + filePath.length + 2;
    setCommand(nextValue);
    setCommandCursor(nextCursor);
    requestAnimationFrame(() => {
      commandInputRef.current?.focus();
      commandInputRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleAttachFiles = (nextAttachments: AttachmentItem[]) => {
    setAttachments((current) => {
      const seen = new Set(current.map((attachment) => attachment.path));
      const merged = [...current];

      for (const attachment of nextAttachments) {
        if (!seen.has(attachment.path)) {
          seen.add(attachment.path);
          merged.push(attachment);
        }
      }

      return merged;
    });
  };

  const handleRemoveAttachment = (attachmentPath: string) => {
    setAttachments((current) => current.filter((attachment) => attachment.path !== attachmentPath));
  };

  const handleToggleAllowedWorker = (workerType: WorkerType, checked: boolean) => {
    const currentlyAllowed = parseWorkerTypes(apiKeys.WORKER_ALLOWED_TYPES);
    const nextAllowed = checked
      ? Array.from(new Set([...currentlyAllowed, workerType]))
      : currentlyAllowed.filter((type) => type !== workerType);

    if (nextAllowed.length === 0) {
      return;
    }

    setApiKeys((current) => ({
      ...current,
      WORKER_ALLOWED_TYPES: JSON.stringify(nextAllowed),
      WORKER_DEFAULT_TYPE: nextAllowed.includes(current.WORKER_DEFAULT_TYPE as WorkerType)
        ? current.WORKER_DEFAULT_TYPE
        : nextAllowed[0],
    }));
  };

  const composer = (className: string) => (
    <div className={`relative z-20 w-full shrink-0 bg-background p-3 sm:p-4 ${className}`}>
      <form onSubmit={handleSubmit} className="group relative mx-auto max-w-3xl">
        {showMentionPicker && (
          <div className="absolute inset-x-0 bottom-full mb-3 overflow-hidden rounded-2xl border border-border bg-background shadow-xl">
            <div className="border-b border-border/60 px-4 py-2 text-xs text-muted-foreground">
              {currentProjectScope}
            </div>
            <div className="max-h-72 overflow-y-auto p-2">
              {filteredProjectFiles.length > 0 ? (
                filteredProjectFiles.map((filePath, index) => (
                  <button
                    key={filePath}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyMention(filePath)}
                    className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      index === mentionIndex ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <span className="truncate">{filePath}</span>
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  No matching files in this project.
                </div>
              )}
            </div>
          </div>
        )}
        <div
          className={cn(
            "rounded-[1.5rem] px-4 pb-0.5 pt-3 transition-all sm:px-5 sm:pb-1 sm:pt-4",
            themeMode === "night"
              ? "border border-transparent bg-muted/80 shadow-[0_18px_50px_-24px_rgba(0,0,0,0.45)] focus-within:bg-muted/90 dark:bg-[#2f2f2f] dark:focus-within:bg-[#343434]"
              : "border border-[#d8d8d8] bg-[#fbfbfa] shadow-[0_24px_60px_-34px_rgba(24,24,27,0.22),0_1px_0_rgba(255,255,255,0.92)_inset] focus-within:bg-white",
          )}
        >
          <textarea
            ref={commandInputRef}
            value={command}
            onChange={(e) => {
              setCommand(e.target.value);
              setCommandCursor(e.target.selectionStart ?? e.target.value.length);
            }}
            onClick={(e) => setCommandCursor(e.currentTarget.selectionStart ?? 0)}
            onKeyUp={(e) => setCommandCursor(e.currentTarget.selectionStart ?? 0)}
            onKeyDown={(e) => {
              if (showMentionPicker) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setMentionIndex((current) => (current + 1) % Math.max(filteredProjectFiles.length, 1));
                  return;
                }

                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setMentionIndex((current) =>
                    current === 0 ? Math.max(filteredProjectFiles.length - 1, 0) : current - 1
                  );
                  return;
                }

                if ((e.key === "Enter" || e.key === "Tab") && filteredProjectFiles[mentionIndex]) {
                  e.preventDefault();
                  applyMention(filteredProjectFiles[mentionIndex]);
                  return;
                }

                if (e.key === "Escape") {
                  e.preventDefault();
                  setCommandCursor(0);
                  return;
                }
              }

              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!runCommand.isPending && command.trim()) {
                  runCommand.mutate(command);
                }
              }
            }}
            placeholder="Ask Omni anything. @ to refer to files"
            disabled={runCommand.isPending}
            rows={1}
            className={cn(
              "min-h-[56px] w-full resize-none bg-transparent text-[15px] leading-6 outline-none",
              themeMode === "night"
                ? "text-foreground placeholder:text-muted-foreground/80"
                : "text-[#454545] placeholder:text-[#c4c4c2]",
            )}
          />

          {attachments.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.path}
                  className={cn(
                    "inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-xs shadow-sm",
                    themeMode === "night"
                      ? "bg-background/65 text-foreground dark:bg-black/20"
                      : "border border-[#e2e2df] bg-white/95 text-[#4d4d4d]",
                  )}
                >
                  <span className="truncate">{attachment.relativePath}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(attachment.path)}
                    className={cn(
                      "inline-flex h-4 w-4 items-center justify-center rounded-full transition-colors",
                      themeMode === "night"
                        ? "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                        : "text-[#8f8f8f] hover:bg-black/5 hover:text-[#5c5c5c]",
                    )}
                    aria-label={`Remove ${attachment.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-0.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowAttachmentPicker(true)}
                className={cn(
                  "h-10 w-10 rounded-full",
                  themeMode === "night"
                    ? "text-muted-foreground hover:bg-background/45 hover:text-foreground"
                    : "text-[#959595] hover:bg-black/[0.04] hover:text-[#666666]",
                )}
                aria-label="Attach files"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="relative">
                <select
                  value={selectedCliAgent}
                  onChange={(event) => setSelectedCliAgent(event.target.value as ComposerWorkerOption)}
                  className={cn(
                    "h-9 appearance-none border-0 bg-transparent pl-3 pr-8 text-sm outline-none transition-colors",
                    themeMode === "night"
                      ? "text-muted-foreground hover:text-foreground"
                      : "text-[#8f8f8f] hover:text-[#5e5e5e]",
                  )}
                >
                  {composerWorkerOptions.map((agent) => (
                    <option key={agent.value} value={agent.value}>{agent.label}</option>
                  ))}
                </select>
                <ChevronDown className={cn(
                  "pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2",
                  themeMode === "night" ? "text-muted-foreground" : "text-[#9a9a9a]",
                )} />
              </div>

              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={(event) => setSelectedModel(event.target.value)}
                  className={cn(
                    "h-9 appearance-none border-0 bg-transparent pl-3 pr-8 text-sm outline-none transition-colors",
                    themeMode === "night"
                      ? "text-muted-foreground hover:text-foreground"
                      : "text-[#8f8f8f] hover:text-[#5e5e5e]",
                  )}
                >
                  {MODEL_OPTIONS.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
                <ChevronDown className={cn(
                  "pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2",
                  themeMode === "night" ? "text-muted-foreground" : "text-[#9a9a9a]",
                )} />
              </div>

              <div className="relative">
                <select
                  value={selectedEffort}
                  onChange={(event) => setSelectedEffort(event.target.value)}
                  className={cn(
                    "h-9 appearance-none border-0 bg-transparent pl-3 pr-8 text-sm outline-none transition-colors",
                    themeMode === "night"
                      ? "text-muted-foreground hover:text-foreground"
                      : "text-[#8f8f8f] hover:text-[#5e5e5e]",
                  )}
                >
                  {EFFORT_OPTIONS.map((effort) => (
                    <option key={effort} value={effort}>{effort}</option>
                  ))}
                </select>
                <ChevronDown className={cn(
                  "pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2",
                  themeMode === "night" ? "text-muted-foreground" : "text-[#9a9a9a]",
                )} />
              </div>

              <Button
                type="submit"
                size="icon"
                disabled={runCommand.isPending || !command.trim()}
                className={cn(
                  "h-10 w-10 rounded-full transition-all",
                  themeMode === "night"
                    ? "bg-foreground text-background hover:bg-foreground/90 disabled:bg-foreground/50"
                    : "bg-[#9d9d9d] text-white hover:bg-[#8b8b8b] disabled:bg-[#c9c9c9]",
                )}
              >
                {runCommand.isPending ? (
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                ) : (
                  <ArrowUp className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );

  const handleRetryMessage = (messageId: string) => {
    if (!selectedRunId) return;
    recoverRun.mutate({ runId: selectedRunId, action: "retry", targetMessageId: messageId });
  };

  const handleStartEditingMessage = (message: MessageRecord) => {
    setEditingMessageId(message.id);
    setEditingMessageValue(message.content);
  };

  const handleCancelEditingMessage = () => {
    setEditingMessageId(null);
    setEditingMessageValue("");
  };

  const handleSaveEditedMessage = (messageId: string) => {
    if (!selectedRunId) return;
    const content = editingMessageValue.trim();
    if (!content) return;
    recoverRun.mutate({ runId: selectedRunId, action: "edit", targetMessageId: messageId, content });
  };

  const handleForkMessage = (message: MessageRecord) => {
    if (!selectedRunId) return;
    const content = window.prompt("Fork with this prompt:", message.content)?.trim();
    if (!content) return;
    recoverRun.mutate({ runId: selectedRunId, action: "fork", targetMessageId: message.id, content });
  };

  const handleRightSidebarResizeStart = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsResizingRightSidebar(true);
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground lg:h-screen">
      <div className="relative z-30 hidden h-full w-[280px] shrink-0 overflow-hidden border-r border-border lg:flex">
        <ConversationSidebar
          filteredProjects={filteredProjects as SidebarGroup[]}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedRunId={selectedRunId}
          messages={state.messages}
          readMarkers={readMarkers}
          showSettings={showSettings}
          setShowSettings={setShowSettings}
          openFolderPicker={() => setShowFolderPicker(true)}
          startNewPlan={handleStartNewPlan}
          beginConversationInProject={beginConversationInProject}
          handleRemoveProject={handleRemoveProject}
          selectRun={handleSelectRun}
          renamingRunId={renamingRunId}
          renameValue={renameValue}
          setRenameValue={setRenameValue}
          startRenamingRun={handleStartRenamingRun}
          commitRenamingRun={handleCommitRenamingRun}
          cancelRenamingRun={handleCancelRenamingRun}
          deleteRun={handleDeleteRun}
        />
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col bg-background">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/50 px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}>
                <Menu className="h-4 w-4" />
              </Button>
              <SheetContent side="left" className="w-[min(22rem,calc(100vw-1rem))] p-0 lg:hidden" showCloseButton={false}>
                <SheetHeader className="border-b border-border/60">
                  <SheetTitle>Navigation</SheetTitle>
                </SheetHeader>
                <ConversationSidebar
                  filteredProjects={filteredProjects as SidebarGroup[]}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  selectedRunId={selectedRunId}
                  messages={state.messages}
                  readMarkers={readMarkers}
                  showSettings={showSettings}
                  setShowSettings={setShowSettings}
                  openFolderPicker={() => setShowFolderPicker(true)}
                  startNewPlan={handleStartNewPlan}
                  beginConversationInProject={beginConversationInProject}
                  handleRemoveProject={handleRemoveProject}
                  selectRun={handleSelectRun}
                  renamingRunId={renamingRunId}
                  renameValue={renameValue}
                  setRenameValue={setRenameValue}
                  startRenamingRun={handleStartRenamingRun}
                  commitRenamingRun={handleCommitRenamingRun}
                  cancelRenamingRun={handleCancelRenamingRun}
                  deleteRun={handleDeleteRun}
                />
              </SheetContent>
            </Sheet>

            {selectedRun ? (
              <div className="flex min-w-0 flex-col">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-sm">{selectedRun.title || "New conversation"}</span>
                  {selectedRun?.status === "failed" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
                      <AlertTriangle className="h-3 w-3" /> Failed
                    </span>
                  ) : null}
                  {selectedRun?.status === "cancelling" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                      Cancelling
                    </span>
                  ) : null}
                </div>
                <span className="max-w-[24rem] truncate text-xs text-muted-foreground" title={selectedRun.projectPath || activePlan?.path || undefined}>
                  {selectedRun.projectPath || activePlan?.path || "Ad hoc request"}
                </span>
              </div>
            ) : draftProjectPath ? (
              <div className="flex min-w-0 flex-col">
                <span className="font-semibold text-sm">New Session</span>
                <span className="max-w-[24rem] truncate text-xs text-muted-foreground" title={draftProjectPath}>
                  Starting in {draftProjectPath}
                </span>
              </div>
            ) : (
              <span className="font-semibold text-sm">New Session</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {(selectedRun?.status === "failed" || showRecoverableRunningState || hasStuckWorker) && latestUserCheckpoint ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRetryMessage(latestUserCheckpoint.id)}
                disabled={recoverRun.isPending}
              >
                <RotateCcw className="mr-2 h-4 w-4" /> {selectedRun?.status === "failed" ? "Retry latest" : "Unstick latest"}
              </Button>
            ) : null}
            <ThemeModeToggle themeMode={themeMode} setThemeMode={setThemeMode} />
            {selectedRunId ? (
              <>
                <Button variant="ghost" size="icon" className="hidden h-8 w-8 text-muted-foreground hover:text-foreground lg:inline-flex" title="Toggle Conversation Workers" onClick={() => setRightSidebarOpen(!rightSidebarOpen)}>
                  <PanelRight className="h-4 w-4" />
                </Button>
                <Sheet open={mobileWorkersOpen} onOpenChange={setMobileWorkersOpen}>
                  <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" aria-label="Open workers" onClick={() => setMobileWorkersOpen(true)}>
                    <PanelRight className="h-4 w-4" />
                  </Button>
                  <SheetContent side="right" className="w-[min(22rem,calc(100vw-1rem))] p-0 lg:hidden" showCloseButton={false}>
                    <SheetHeader className="border-b border-border/60">
                      <SheetTitle>Workers</SheetTitle>
                    </SheetHeader>
                    <WorkersSidebar
                      agents={conversationAgents}
                      preferredModel={selectedRun?.preferredWorkerModel ?? null}
                      preferredEffort={selectedRun?.preferredWorkerEffort ?? null}
                      onClose={() => setMobileWorkersOpen(false)}
                    />
                  </SheetContent>
                </Sheet>
              </>
            ) : null}
          </div>
        </header>

        <ScrollArea className="min-h-0 flex-1" ref={scrollRef}>
          {selectedRunId ? (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 pb-24 sm:gap-6 sm:p-6 sm:pb-20">
              {appErrors.length > 0 ? (
                <div className="space-y-3">
                  {appErrors.map((error) => (
                    <ErrorNotice key={appErrorKey(error)} error={error} />
                  ))}
                </div>
              ) : null}
              {selectedRun?.status === "failed" && selectedRun.lastError ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive shadow-sm">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-semibold">Run failed</div>
                      <div className="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground">
                        {selectedRun.lastError}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
              {filteredMessages && filteredMessages.length > 0 ? (
                filteredMessages.map((msg: MessageRecord) => (
                  <div key={msg.id} className="group flex w-full flex-col text-sm">
                    <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
                      <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold capitalize tracking-wider ${msg.role === "user" ? "text-primary" : (msg.role === "system" ? "text-muted-foreground" : "text-emerald-600")}`}>
                        {msg.role === "user" ? "You" : msg.role}
                      </span>
                      {msg.kind === "error" ? (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
                          Run failed
                        </span>
                      ) : null}
                      <span className="text-[10px] text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100">
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                      {msg.role === "user" ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            aria-label="Message actions"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem disabled={recoverRun.isPending} onClick={() => handleRetryMessage(msg.id)}>
                              <RotateCcw className="mr-2 h-4 w-4" /> Retry from here
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={recoverRun.isPending} onClick={() => handleStartEditingMessage(msg)}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit in place
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={recoverRun.isPending} onClick={() => handleForkMessage(msg)}>
                              <GitBranch className="mr-2 h-4 w-4" /> Fork from here
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>
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
                    ) : (
                      <div className={`overflow-x-auto whitespace-pre-wrap rounded-xl border p-4 leading-relaxed ${msg.kind === "error"
                        ? "border-destructive/30 bg-destructive/5 text-destructive"
                        : msg.role === "user"
                          ? "border-transparent bg-muted/30 text-foreground"
                          : msg.role === "system"
                            ? "border-border/50 bg-background font-mono text-[11px] text-muted-foreground"
                            : msg.role === "worker"
                              ? "border-[#333] bg-[#1e1e1e] font-mono text-[12px] text-emerald-400 shadow-sm"
                              : "border-border bg-card"}`}>
                        {msg.content}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 pt-24 text-sm text-muted-foreground sm:pt-32">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                    <Blocks className="h-6 w-6 opacity-50" />
                  </div>
                  <p>No output recorded yet for this run.</p>
                </div>
              )}

              {showConversationExecution ? conversationThinking : null}

              {selectedClarifications.length > 0 && (
                <div className="max-w-xl">
                  <ClarificationPanel
                    clarifications={selectedClarifications}
                    onAnswer={(clarificationId, answer) => answerClarification.mutate({ clarificationId, answer })}
                    errorMessage={answerClarification.error ? buildInlineError(answerClarification.error, {
                      source: "Clarifications",
                      action: "Answer clarification",
                    }).message : null}
                  />
                </div>
              )}

              {conversationWorkers.length > 0 && (
                <div className="mt-4 border-t border-border/50 pt-6 sm:mt-8">
                  <div className="mb-4 flex items-center gap-2 pl-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Cpu className="h-4 w-4" /> Live CLI Agents
                  </div>
                  <div className="flex flex-col gap-6">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {conversationWorkers.map((worker: any) => {
                      const agent = conversationAgents.find((item) => item.name === worker.id);
                      const activeModel = agent?.effectiveModel || agent?.requestedModel || selectedRun?.preferredWorkerModel || null;
                      const activeEffort = agent?.effectiveEffort || agent?.requestedEffort || selectedRun?.preferredWorkerEffort || null;
                      const contextUsage = agent?.contextUsage?.fullnessPercent;
                      const pendingPermissions = agent?.pendingPermissions ?? [];
                      const runtimeLabel = formatWorkerRuntime(agent?.type || worker.type);
                      const details = [
                        activeModel ? { label: "Model", value: activeModel } : null,
                        activeEffort ? { label: "Effort", value: activeEffort } : null,
                        typeof contextUsage === "number" ? { label: "Context", value: `${Math.round(contextUsage)}% full` } : null,
                      ].filter((detail): detail is { label: string; value: string } => Boolean(detail));

                      return (
                        <div key={worker.id} className="flex flex-col overflow-hidden rounded-[1.25rem] border border-white/10 bg-[#0d0f12] text-zinc-100 shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
                          <div className="flex items-center justify-between border-b border-white/10 bg-[#13161b] p-3">
                            <span className="flex items-center gap-2 font-mono text-xs font-semibold text-zinc-100">
                              <TerminalIcon className="h-3 w-3" /> {worker.id}
                            </span>
                            <div className="flex items-center gap-2">
                              {pendingPermissions.length > 0 ? <PermissionWarning pendingPermissions={pendingPermissions} /> : null}
                              {agent?.state === "working" && <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />}
                              {runtimeLabel ? (
                                <span className="rounded-md border border-amber-300/20 bg-amber-300/6 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-100/90">
                                  {runtimeLabel}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          {details.length > 0 ? (
                            <div className="grid gap-3 border-b border-white/10 bg-[#101318] p-3 sm:grid-cols-3">
                              {details.map((detail) => (
                                <div key={detail.label} className="space-y-1 text-xs">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{detail.label}</div>
                                  <div className="break-all font-mono text-zinc-200">{detail.value}</div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {agent?.lastError ? (
                            <div className="border-b border-white/10 bg-[#101318] px-3 py-2">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Last error</div>
                              <div className="mt-1 break-all font-mono text-xs text-zinc-300">{agent.lastError}</div>
                            </div>
                          ) : null}
                          <div className="relative h-72 w-full bg-[#050607] sm:h-[26rem]">
                            <Terminal agentName={worker.id} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mx-auto flex h-full w-full max-w-3xl flex-col items-center justify-center px-6 text-center">
              {appErrors.length > 0 ? (
                <div className="mb-6 w-full space-y-3 text-left">
                  {appErrors.map((error) => (
                    <ErrorNotice key={appErrorKey(error)} error={error} />
                  ))}
                </div>
              ) : null}
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Blocks className="h-8 w-8 text-primary" />
              </div>
              <h1 className="mb-2 text-2xl font-semibold">Welcome to OmniHarness</h1>
              <p className="mb-8 max-w-md text-sm text-muted-foreground">
                Enter a plan path or plain-English command below to spin up a supervised pool of headless CLI agents (Claude Code, Codex) and drive the work forward.
              </p>
              {composer("mt-6 w-full")}
            </div>
          )}
        </ScrollArea>

        {selectedRunId ? composer("w-full") : null}
      </div>

      {rightSidebarOpen && selectedRunId ? (
        <div className="relative hidden h-full shrink-0 border-l border-border lg:flex" style={{ width: rightSidebarWidth }}>
          <button
            type="button"
            className="absolute inset-y-0 left-0 z-10 flex w-3 -translate-x-1/2 cursor-col-resize items-center justify-center bg-transparent"
            aria-label="Resize workers sidebar"
            onPointerDown={handleRightSidebarResizeStart}
          >
            <span className="h-14 w-1 rounded-full bg-border/80 transition-colors hover:bg-foreground/30" />
          </button>
          <div className="flex h-full min-w-0 flex-1 pl-2">
            <WorkersSidebar
              agents={conversationAgents}
              preferredModel={selectedRun?.preferredWorkerModel ?? null}
              preferredEffort={selectedRun?.preferredWorkerEffort ?? null}
              onClose={() => setRightSidebarOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>OmniHarness Configuration</DialogTitle>
            <DialogDescription>
              Configure primary and fallback supervisor LLM credentials for this workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="inline-flex rounded-xl border border-border/60 bg-muted/30 p-1">
              <button
                type="button"
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  activeSettingsTab === "llm"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={activeSettingsTab === "llm"}
                onClick={() => setActiveSettingsTab("llm")}
              >
                LLM Settings
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  activeSettingsTab === "workers"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={activeSettingsTab === "workers"}
                onClick={() => setActiveSettingsTab("workers")}
              >
                Worker Agents
              </button>
            </div>

            {activeSettingsTab === "llm" ? (
              <>
                <div className="space-y-3">
                  <div className="inline-flex rounded-xl border border-border/60 bg-muted/30 p-1">
                    <button
                      type="button"
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                        activeLlmProfileTab === "supervisor"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      aria-pressed={activeLlmProfileTab === "supervisor"}
                      onClick={() => setActiveLlmProfileTab("supervisor")}
                    >
                      Supervisor Credentials
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                        activeLlmProfileTab === "fallback"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      aria-pressed={activeLlmProfileTab === "fallback"}
                      onClick={() => setActiveLlmProfileTab("fallback")}
                    >
                      Fallback Credentials
                    </button>
                  </div>

                  {activeLlmProfileTab === "supervisor" ? (
                    <LlmSettingsForm
                      prefix="SUPERVISOR_LLM"
                      title="Supervisor LLM"
                      description="Configure the provider, model, endpoint, and credentials used first for supervisor turns."
                      apiKeys={apiKeys}
                      setApiKeys={setApiKeys}
                    />
                  ) : (
                    <LlmSettingsForm
                      prefix="SUPERVISOR_FALLBACK_LLM"
                      title="Fallback LLM"
                      description="Use a second provider profile if the primary supervisor credentials are unavailable."
                      apiKeys={apiKeys}
                      setApiKeys={setApiKeys}
                    />
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Credit Exhaustion Strategy</label>
                  <select
                    className="h-8 w-full rounded border bg-muted/50 px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                    value={apiKeys.CREDIT_STRATEGY || "swap_account"}
                    onChange={e => setApiKeys(p => ({ ...p, CREDIT_STRATEGY: e.target.value }))}
                  >
                    <option value="swap_account">Swap Account</option>
                    <option value="fallback_api">Fallback API</option>
                    <option value="wait_for_reset">Wait for Reset</option>
                    <option value="cross_provider">Cross Provider</option>
                  </select>
                </div>
              </>
            ) : (
              <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="space-y-1">
                  <div className="text-sm font-semibold">Worker Agents</div>
                  <p className="text-xs text-muted-foreground">
                    Only currently available bridge workers can be enabled for new conversations.
                  </p>
                </div>

                <div className="space-y-2">
                  {settingsWorkers.map((worker) => {
                    const isAvailable = worker.availability.status === "ok";
                    const isChecked = configuredAllowedWorkerSet.has(worker.type);
                    const availabilityTone =
                      worker.availability.status === "ok"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : worker.availability.status === "warning"
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          : "bg-destructive/10 text-destructive";

                    return (
                      <label
                        key={worker.type}
                        className={cn(
                          "flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-background/70 p-3",
                          !isAvailable && "opacity-70",
                        )}
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 rounded border-border"
                            checked={isChecked}
                            disabled={!isAvailable || (isChecked && configuredAllowedWorkerTypes.length === 1)}
                            onChange={(event) => handleToggleAllowedWorker(worker.type, event.target.checked)}
                          />
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium break-words">{worker.label}</span>
                              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]", availabilityTone)}>
                                {worker.availability.status}
                              </span>
                            </div>
                            <p className="text-xs break-words text-muted-foreground">
                              {worker.availability.message || (isAvailable ? "Ready to spawn from the bridge." : "Unavailable right now.")}
                            </p>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground" htmlFor="WORKER_DEFAULT_TYPE">
                    Default Worker Agent
                  </label>
                  <select
                    id="WORKER_DEFAULT_TYPE"
                    className="h-8 w-full rounded border bg-muted/50 px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                    value={parseWorkerType(apiKeys.WORKER_DEFAULT_TYPE) ?? configuredAllowedWorkerTypes[0] ?? "codex"}
                    onChange={(event) => setApiKeys((current) => ({ ...current, WORKER_DEFAULT_TYPE: event.target.value }))}
                  >
                    {WORKER_OPTIONS
                      .filter((option) => configuredAllowedWorkerSet.has(option.value))
                      .map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-background/70 p-3" htmlFor="WORKER_YOLO_MODE">
                  <div className="min-w-0 space-y-1">
                    <div className="text-sm font-medium">YOLO Worker Mode</div>
                    <p className="text-xs text-muted-foreground">
                      Default new workers to the bridge&apos;s most permissive mode so routine approvals rarely interrupt execution.
                    </p>
                  </div>
                  <input
                    id="WORKER_YOLO_MODE"
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-border"
                    checked={parseBooleanSetting(apiKeys.WORKER_YOLO_MODE, true)}
                    onChange={(event) => setApiKeys((current) => ({
                      ...current,
                      WORKER_YOLO_MODE: event.target.checked ? "true" : "false",
                    }))}
                  />
                </label>

                {workerCatalogQuery.isError ? (
                  <ErrorNotice
                    error={buildInlineError(workerCatalogQuery.error, {
                      source: "Bridge",
                      action: "Load worker availability",
                    })}
                  />
                ) : null}
              </div>
            )}

            {settingsDiagnostics.length > 0 ? (
              <div className="space-y-3">
                {settingsDiagnostics.map((error) => (
                  <ErrorNotice key={appErrorKey(error)} error={error} />
                ))}
              </div>
            ) : null}

            {workerCatalogQuery.data?.diagnostics?.length ? (
              <div className="space-y-3">
                {workerCatalogQuery.data.diagnostics.map((error) => (
                  <ErrorNotice key={appErrorKey(error)} error={error} />
                ))}
              </div>
            ) : null}

            {saveSettings.error ? (
              <ErrorNotice
                error={buildInlineError(saveSettings.error, {
                  source: "Settings",
                  action: "Save settings",
                })}
              />
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSettings(false)}>Cancel</Button>
            <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FolderPickerDialog 
        open={showFolderPicker} 
        onOpenChange={setShowFolderPicker} 
        onSelect={handleAddProject} 
      />
      <FileAttachmentPickerDialog
        open={showAttachmentPicker}
        onOpenChange={setShowAttachmentPicker}
        rootPath={currentProjectScope}
        onSelect={handleAttachFiles}
      />
    </div>
  );
}
