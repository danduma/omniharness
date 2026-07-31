"use client";

import React from "react";
import { Check, X } from "lucide-react";
import { workerCardManager } from "@/components/component-state-managers";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  buildElicitationContent,
  hasInvalidElicitationField,
  hasMissingRequiredElicitationField,
  parseElicitationFields,
  type ElicitationValue,
} from "@/lib/acp/elicitation-schema";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import type { PendingWorkerElicitation } from "@/interface/home/worker-elicitations";

export type ElicitationResponseInput = {
  workerId: string;
  requestId: number;
  action: "accept" | "decline" | "cancel";
  content?: Record<string, ElicitationValue>;
};

function requestDraftPrefix(workerId: string, elicitation: PendingWorkerElicitation) {
  return [
    workerId,
    elicitation.sessionId ?? "session",
    elicitation.requestId,
    elicitation.toolCallId ?? "tool",
    "",
  ].join(":");
}

function optionDraftKey(prefix: string, fieldName: string, optionValue: string) {
  return `${prefix}${fieldName}:option:${optionValue}`;
}

export function InlineElicitation({
  workerId,
  elicitation,
  onRespond,
  disabled = false,
  className,
}: {
  workerId: string;
  elicitation: PendingWorkerElicitation;
  onRespond?: (input: ElicitationResponseInput) => void | Promise<unknown>;
  disabled?: boolean;
  className?: string;
}) {
  useI18nSnapshot();
  useManagerSnapshot(workerCardManager);
  const fields = parseElicitationFields(elicitation.requestedSchema);
  const isUrl = elicitation.mode === "url" && Boolean(elicitation.url);
  const safeUrl = isUrl && /^https?:\/\//i.test(elicitation.url ?? "") ? elicitation.url : null;
  const prefix = requestDraftPrefix(workerId, elicitation);
  const values = Object.fromEntries(fields.map((field) => {
    if (field.kind === "multi_select") {
      const defaults = Array.isArray(field.defaultValue) ? field.defaultValue : [];
      const selected = field.options
        .filter((option) => {
          const stored = workerCardManager.readElicitationDraft(optionDraftKey(prefix, field.name, option.value));
          return stored === "true" || (stored === "" && defaults.includes(option.value));
        })
        .map((option) => option.value);
      return [field.name, selected];
    }
    if (field.kind === "boolean") {
      const stored = workerCardManager.readElicitationDraft(`${prefix}${field.name}`);
      return [field.name, stored ? stored === "true" : field.defaultValue === true];
    }
    const stored = workerCardManager.readElicitationDraft(`${prefix}${field.name}`);
    return [field.name, stored !== "" ? stored : field.defaultValue ?? ""];
  })) as Record<string, ElicitationValue>;
  const missingRequired = hasMissingRequiredElicitationField(fields, values);
  const invalid = hasInvalidElicitationField(fields, values);

  const submit = async (action: ElicitationResponseInput["action"]) => {
    try {
      await onRespond?.({
        workerId,
        requestId: elicitation.requestId,
        action,
        ...(action === "accept" ? { content: buildElicitationContent(fields, values) } : {}),
      });
      workerCardManager.clearElicitationDrafts(prefix);
    } catch {
      // The mutation owner restores the pending interaction and surfaces the
      // error; retaining the request-token draft lets the user retry safely.
    }
  };

  return (
    <section
      className={cn(
        "rounded-2xl border border-sky-500/25 bg-sky-500/[0.055] p-4 shadow-sm dark:border-sky-300/15 dark:bg-sky-300/[0.04]",
        className,
      )}
      aria-label={t("worker.elicitation.title")}
    >
      <div className="text-xs font-semibold text-sky-800 dark:text-sky-200">
        {t("worker.elicitation.title")}
      </div>
      <p className="mt-1 text-sm leading-6 text-foreground">
        {elicitation.message || t("worker.elicitation.defaultQuestion")}
      </p>
      {safeUrl ? (
        <a
          href={safeUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-3 inline-flex rounded-lg border border-sky-500/30 bg-background px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-500/10 dark:text-sky-200"
        >
          {t("worker.elicitation.openLink")}
        </a>
      ) : null}
      <div className="mt-4 space-y-4">
        {fields.map((field) => {
          const draftKey = `${prefix}${field.name}`;
          const value = values[field.name];
          return (
            <fieldset key={field.name} className="space-y-2">
              <legend className="text-sm font-medium text-foreground">{field.label}</legend>
              {field.description ? (
                <p className="text-xs leading-5 text-muted-foreground">{field.description}</p>
              ) : null}
              {field.kind === "single_select" ? (
                <div className="grid gap-2">
                  {field.options.map((option) => (
                    <label
                      key={option.value}
                      className={cn(
                        "flex cursor-pointer gap-3 rounded-xl border p-3 text-sm transition-colors",
                        value === option.value
                          ? "border-sky-500/60 bg-sky-500/10"
                          : "border-border bg-background/70 hover:border-sky-500/35",
                      )}
                    >
                      <input
                        type="radio"
                        name={draftKey}
                        value={option.value}
                        checked={value === option.value}
                        disabled={disabled}
                        onChange={() => workerCardManager.setElicitationDraft(draftKey, option.value)}
                        className="mt-0.5 h-4 w-4 accent-sky-600"
                      />
                      <span className="leading-5">{option.label}</span>
                    </label>
                  ))}
                </div>
              ) : field.kind === "multi_select" ? (
                <div className="grid gap-2">
                  {field.options.map((option) => {
                    const optionKey = optionDraftKey(prefix, field.name, option.value);
                    const stored = workerCardManager.readElicitationDraft(optionKey);
                    const checked = stored === "true" || (stored === "" && Array.isArray(field.defaultValue) && field.defaultValue.includes(option.value));
                    return (
                      <label
                        key={option.value}
                        className={cn(
                          "flex cursor-pointer gap-3 rounded-xl border p-3 text-sm transition-colors",
                          checked
                            ? "border-sky-500/60 bg-sky-500/10"
                            : "border-border bg-background/70 hover:border-sky-500/35",
                        )}
                      >
                        <input
                          type="checkbox"
                          value={option.value}
                          checked={checked}
                          disabled={disabled}
                          onChange={(event) => workerCardManager.setElicitationDraft(optionKey, String(event.target.checked))}
                          className="mt-0.5 h-4 w-4 rounded accent-sky-600"
                        />
                        <span className="leading-5">{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              ) : field.kind === "boolean" ? (
                <Switch
                  checked={value === true}
                  disabled={disabled}
                  aria-label={field.label}
                  onCheckedChange={(checked) => workerCardManager.setElicitationDraft(draftKey, String(checked))}
                />
              ) : field.kind === "text" ? (
                <Textarea
                  value={String(value ?? "")}
                  disabled={disabled}
                  placeholder={t("worker.elicitation.inputPlaceholder")}
                  onChange={(event) => workerCardManager.setElicitationDraft(draftKey, event.target.value)}
                  className="min-h-20 resize-y bg-background/80"
                />
              ) : (
                <Input
                  type="number"
                  value={String(value ?? "")}
                  disabled={disabled}
                  placeholder={t("worker.elicitation.inputPlaceholder")}
                  onChange={(event) => workerCardManager.setElicitationDraft(draftKey, event.target.value)}
                  className="bg-background/80"
                />
              )}
            </fieldset>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
          disabled={disabled || !onRespond}
          onClick={() => { void submit("decline"); }}
        >
          <X className="h-3.5 w-3.5" />
          {t("worker.elicitation.skip")}
        </button>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled || !onRespond || missingRequired || invalid}
          onClick={() => { void submit("accept"); }}
        >
          <Check className="h-3.5 w-3.5" />
          {t(isUrl ? "worker.elicitation.done" : "worker.elicitation.submit")}
        </button>
      </div>
    </section>
  );
}
