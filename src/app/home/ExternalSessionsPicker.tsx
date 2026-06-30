"use client";

import type React from "react";
import { useMemo } from "react";
import { StateManager } from "@/lib/state-manager";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FolderOpen, Search, SquareTerminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { requestJson } from "@/lib/app-errors";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface ExternalSession {
  sessionId: string;
  projectDir: string;
  projectPath: string;
  sessionFilePath: string;
  lastModified: string;
  title: string | null;
  recentOutput: string | null;
  messageCount: number;
}

interface ExternalSessionsResponse {
  sessions: ExternalSession[];
  claude?: ExternalSession[];
  gemini?: ExternalSession[];
}

interface ExternalSessionsPickerProps {
  open: boolean;
  onClose: () => void;
  onResumed: (runId: string) => void;
}

function formatRelativeTime(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return t("externalSessions.relative.justNow");
  if (minutes < 60) return t("externalSessions.relative.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("externalSessions.relative.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t("externalSessions.relative.daysAgo", { count: days });
  const months = Math.floor(days / 30);
  return t("externalSessions.relative.monthsAgo", { count: months });
}

function shortProjectPath(full: string): string {
  const parts = full.split("/").filter(Boolean);
  if (parts.length <= 2) return full;
  return `…/${parts.slice(-2).join("/")}`;
}

export function ExternalSessionsPicker({ open, onClose, onResumed }: ExternalSessionsPickerProps) {
  useI18nSnapshot();
  const manager = useMemo(() => new StateManager({ resumingId: null as string | null, query: "", activeTab: "claude" as "claude" | "gemini" }), []);
  const { resumingId, query, activeTab } = useManagerSnapshot(manager);

  const { data, isLoading, isError, refetch } = useQuery<ExternalSessionsResponse>({
    queryKey: ["external-sessions"],
    queryFn: () => requestJson<ExternalSessionsResponse>("/api/external-sessions", undefined, {
      source: t("externalSessions.errorSource"),
      action: t("externalSessions.listAction"),
    }),
    enabled: open,
    staleTime: 30_000,
  });

  const resumeMutation = useMutation({
    mutationFn: async (session: ExternalSession) =>
      requestJson<{ runId: string }>("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          externalClaudeSessionId: session.sessionId,
          projectPath: session.projectPath,
          command: "",
          preferredWorkerType: activeTab,
        }),
      }, {
        source: t("externalSessions.errorSource"),
        action: t("externalSessions.resumeAction"),
      }),
    onSuccess: (result) => {
      manager.setKey("resumingId", null);
      if (result.runId) onResumed(result.runId);
      onClose();
    },
    onError: () => manager.setKey("resumingId", null),
  });

  function handleResume(session: ExternalSession) {
    if (resumingId) return;
    manager.setKey("resumingId", session.sessionId);
    resumeMutation.mutate(session);
  }

  const allSessions = useMemo(() => {
    if (activeTab === "gemini") {
      return data?.gemini ?? [];
    }
    return data?.claude ?? data?.sessions ?? [];
  }, [data, activeTab]);

  const sessions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allSessions;
    return allSessions.filter((s) =>
      s.title?.toLowerCase().includes(q) ||
      s.projectPath.toLowerCase().includes(q) ||
      s.recentOutput?.toLowerCase().includes(q),
    );
  }, [allSessions, query]);
  const isEmpty = !isLoading && !isError && allSessions.length === 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { manager.setKey("query", ""); onClose(); } }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SquareTerminal className="h-5 w-5" />
            {t("externalSessions.title")}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs Bar */}
        <div className="inline-flex rounded-xl border border-border/60 bg-muted/30 p-1 self-start">
          <button
            type="button"
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              activeTab === "claude"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={activeTab === "claude"}
            onClick={() => manager.setKey("activeTab", "claude")}
          >
            {t("externalSessions.provider.claudeCode")}
          </button>
          <button
            type="button"
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              activeTab === "gemini"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={activeTab === "gemini"}
            onClick={() => manager.setKey("activeTab", "gemini")}
          >
            {t("externalSessions.provider.gemini")}
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("externalSessions.filterPlaceholder")}
            value={query}
            onChange={(e) => manager.setKey("query", e.target.value)}
            className="pl-8"
            autoFocus
          />
        </div>

        <ScrollArea className="max-h-[520px]">
          {isLoading && (
            <div className="py-10 text-center text-sm text-muted-foreground">{t("externalSessions.loading")}</div>
          )}
          {isError && (
            <div className="space-y-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">{t("externalSessions.failed")}</p>
              <Button variant="ghost" size="sm" onClick={() => refetch()}>{t("common.retry")}</Button>
            </div>
          )}
          {isEmpty && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {t("externalSessions.empty", { path: "" })}{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                {activeTab === "gemini" ? "~/.gemini/tmp/ or .omniharness/" : "~/.claude/projects/"}
              </code>
            </div>
          )}
          {!isLoading && !isError && !isEmpty && sessions.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">{t("externalSessions.noFilterResults")}</div>
          )}
          {sessions.length > 0 && (
            <div className="space-y-px pr-1">
              <div className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <SquareTerminal className="h-3.5 w-3.5" />
                {activeTab === "gemini"
                  ? t("externalSessions.provider.gemini")
                  : t("externalSessions.provider.claudeCode")}
              </div>
              {sessions.map((session) => {
                const isResuming = resumingId === session.sessionId;
                const title = session.title?.trim() || t("externalSessions.untitled");
                return (
                  <button
                    key={session.sessionId}
                    type="button"
                    disabled={resumingId !== null}
                    onClick={() => handleResume(session)}
                    className={cn(
                      "group w-full rounded-md px-3 py-2.5 text-left transition-colors",
                      "hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none",
                      isResuming && "opacity-60",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {isResuming ? t("externalSessions.resuming") : title}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatRelativeTime(session.lastModified)}
                      </span>
                    </div>
                    {session.recentOutput && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {session.recentOutput}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground/70">
                      <FolderOpen className="h-3 w-3 shrink-0" />
                      <span className="truncate font-mono">{shortProjectPath(session.projectPath)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
