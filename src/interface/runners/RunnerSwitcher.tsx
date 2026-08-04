"use client";

import React from "react";
import {
  AlertTriangle,
  ChevronDown,
  CircleDot,
  LoaderCircle,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { t, useI18nSnapshot } from "@/lib/i18n";
import type { RuntimeSurface } from "@/runtime-api/types";
import type { RunnerConnectionStatus } from "./RunnerConnection";
import {
  runnerStatusMessageKey,
  type RunnerUiDialog,
} from "./RunnerUiManager";

function statusTone(status: RunnerConnectionStatus) {
  if (status === "online") return "bg-emerald-500";
  if (status === "connecting" || status === "resync") return "bg-amber-500";
  if (status === "deferred" || status === "runner-stopping") return "bg-sky-500";
  return "bg-destructive";
}

export function RunnerSwitcherButton({
  runnerName,
  status,
  expanded,
  surface = "web",
  id = "runner-switcher",
  className,
  onClick,
}: {
  runnerName: string;
  status: RunnerConnectionStatus;
  expanded: boolean;
  surface?: RuntimeSurface;
  id?: string;
  className?: string;
  onClick?: () => void;
}) {
  useI18nSnapshot();
  const statusLabel = t(runnerStatusMessageKey(status));

  return (
    <Button
      id={id}
      variant="ghost"
      className={cn(
        "h-9 min-w-0 max-w-[15rem] justify-start gap-2 px-2 motion-reduce:transition-none",
        className,
      )}
      aria-label={t("runner.switcher.aria", {
        runner: runnerName,
        status: statusLabel,
      })}
      aria-expanded={expanded}
      aria-haspopup="menu"
      onClick={onClick}
    >
      <span
        className={cn("h-2 w-2 shrink-0 rounded-full", statusTone(status))}
        aria-hidden="true"
      />
      <span className="min-w-0 truncate text-sm font-semibold">{runnerName}</span>
      <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </Button>
  );
}

const recoveryActionKeys: Partial<Record<RunnerConnectionStatus, string>> = {
  "needs-reauth": "runner.action.reauthorize",
  "tls-untrusted": "runner.action.reviewCertificate",
  "identity-mismatch": "runner.action.reviewIdentity",
  incompatible: "runner.action.updateRequired",
  deferred: "runner.action.waiting",
  offline: "common.retry",
  degraded: "common.retry",
};

export function RunnerConnectionStatusPanel({
  runnerName,
  status,
  onAction,
}: {
  runnerName: string;
  status: RunnerConnectionStatus;
  onAction?: () => void;
}) {
  useI18nSnapshot();
  const actionKey = recoveryActionKeys[status];
  if (status === "online") return null;
  const Icon = status === "connecting" || status === "resync"
    ? LoaderCircle
    : status === "deferred"
      ? CircleDot
      : AlertTriangle;

  return (
    <section
      className="flex flex-wrap items-center gap-3 border-b border-border/60 bg-muted/35 px-3 py-2 text-sm sm:px-4"
      aria-live="polite"
      aria-label={t("runner.statusPanel.aria", { runner: runnerName })}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 text-muted-foreground",
          (status === "connecting" || status === "resync")
            && "animate-spin motion-reduce:animate-none",
        )}
      />
      <span className="min-w-0 flex-1">
        {t(runnerStatusMessageKey(status))}
      </span>
      {actionKey && onAction ? (
        <Button size="sm" variant="outline" onClick={onAction}>
          {status === "deferred" ? <Play className="h-3.5 w-3.5" /> : null}
          {t(actionKey)}
        </Button>
      ) : null}
    </section>
  );
}

export function runnerDialogTitleKey(dialog: RunnerUiDialog) {
  return ({
    closed: "runner.connect.title",
    add: "runner.connect.title",
    edit: "runner.edit.title",
    forget: "runner.forget.title",
    sessions: "runner.sessions.title",
    rename: "runner.rename.title",
    tls: "runner.tls.title",
    identity: "runner.identity.title",
    restart: "runner.restart.title",
  } satisfies Record<RunnerUiDialog, string>)[dialog];
}
