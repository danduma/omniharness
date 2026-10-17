"use client";

import { ArrowDownLeft, ArrowUpRight, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import type { AgentCommunication } from "@/lib/agent-communication";
import { t, useI18nSnapshot } from "@/lib/i18n";

export function AgentCommunicationCard({ communication, direction, status, details }: {
  communication: AgentCommunication;
  direction: "incoming" | "outgoing";
  status?: string;
  details?: ReactNode;
}) {
  useI18nSnapshot();
  const failed = ["failed", "error", "cancelled", "canceled"].includes(status ?? "");
  const pending = direction === "outgoing" && !failed && !["completed", "done"].includes(status ?? "");
  const label = direction === "incoming" ? "received" : failed ? "failed" : pending ? "sending" : "sent";
  const Icon = direction === "incoming" ? ArrowDownLeft : ArrowUpRight;
  return (
    <section data-agent-communication={direction} className="my-1 min-w-0 rounded-xl border border-border bg-muted/30 px-4 py-3">
      <div className="flex min-w-0 items-start gap-2 text-sm font-medium">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 [overflow-wrap:anywhere]">{t(`conversation.agentCommunication.${label}`, {
          peer: communication.peer ?? t("conversation.agentCommunication.unknownAgent"),
        })}</span>
        {pending ? <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden="true" /> : null}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-[length:var(--terminal-message-size)] leading-[1.55] [overflow-wrap:anywhere]">{communication.text}</p>
      {details ? (
        <details className="mt-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t("conversation.agentCommunication.details")}</summary>
          <div className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap [overflow-wrap:anywhere]">{details}</div>
        </details>
      ) : null}
    </section>
  );
}
