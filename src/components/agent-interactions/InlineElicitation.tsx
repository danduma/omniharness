"use client";

import React from "react";
import { Check, MessageCircleQuestion, X } from "lucide-react";
import { workerCardManager } from "@/components/component-state-managers";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  applyOtherAnswer,
  buildElicitationContent,
  hasInvalidElicitationField,
  hasMissingRequiredElicitationField,
  parseElicitationFields,
  type ElicitationField,
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

function otherDraftKey(prefix: string, fieldName: string) {
  return `${prefix}${fieldName}:other`;
}

const QUESTION_FIELD_PATTERN = /^question_\d+$/;
const CUSTOM_ANSWER_FIELD = "customAnswer";

/** Only a question that offers a choice needs a free-text escape hatch. */
function acceptsOtherText(field: ElicitationField) {
  return QUESTION_FIELD_PATTERN.test(field.name)
    && (field.kind === "single_select" || field.kind === "multi_select");
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
  const questionFields = fields.filter((field) => QUESTION_FIELD_PATTERN.test(field.name));
  const usesQuestionTabs = questionFields.length > 1;
  const isUrl = elicitation.mode === "url" && Boolean(elicitation.url);
  const safeUrl = isUrl && /^https?:\/\//i.test(elicitation.url ?? "") ? elicitation.url : null;
  const prefix = requestDraftPrefix(workerId, elicitation);
  const activeQuestionDraftKey = `${prefix}active-question`;
  const storedActiveQuestion = workerCardManager.readElicitationDraft(activeQuestionDraftKey);
  const activeQuestion = questionFields.find((field) => field.name === storedActiveQuestion)
    ?? questionFields[0]
    ?? null;
  // The agent appends a single global `customAnswer` box per request. It is not
  // a question field, so under tabs it rendered inside every tab off one shared
  // draft key — one "Other" carrying across sections. Once the questions are
  // split into tabs each gets its own box folded into its own answer, and the
  // global field is dropped rather than sent alongside them.
  const customAnswerField = fields.find((field) => field.name === CUSTOM_ANSWER_FIELD) ?? null;
  const perQuestionOther = usesQuestionTabs && customAnswerField !== null;
  const answerFields = perQuestionOther
    ? fields.filter((field) => field.name !== CUSTOM_ANSWER_FIELD)
    : fields;
  const visibleFields = usesQuestionTabs
    ? answerFields.filter((field) => !QUESTION_FIELD_PATTERN.test(field.name) || field.name === activeQuestion?.name)
    : answerFields;
  const values = Object.fromEntries(answerFields.map((field) => {
    const other = perQuestionOther && acceptsOtherText(field)
      ? workerCardManager.readElicitationDraft(otherDraftKey(prefix, field.name))
      : "";
    if (field.kind === "multi_select") {
      const defaults = Array.isArray(field.defaultValue) ? field.defaultValue : [];
      const selected = field.options
        .filter((option) => {
          const stored = workerCardManager.readElicitationDraft(optionDraftKey(prefix, field.name, option.value));
          return stored === "true" || (stored === "" && defaults.includes(option.value));
        })
        .map((option) => option.value);
      return [field.name, applyOtherAnswer(field, selected, other)];
    }
    if (field.kind === "boolean") {
      const stored = workerCardManager.readElicitationDraft(`${prefix}${field.name}`);
      return [field.name, stored ? stored === "true" : field.defaultValue === true];
    }
    const stored = workerCardManager.readElicitationDraft(`${prefix}${field.name}`);
    return [field.name, applyOtherAnswer(field, stored !== "" ? stored : field.defaultValue ?? "", other)];
  })) as Record<string, ElicitationValue>;
  const missingRequired = hasMissingRequiredElicitationField(answerFields, values);
  const invalid = hasInvalidElicitationField(answerFields, values);

  const submit = async (action: ElicitationResponseInput["action"]) => {
    try {
      await onRespond?.({
        workerId,
        requestId: elicitation.requestId,
        action,
        ...(action === "accept" ? { content: buildElicitationContent(answerFields, values) } : {}),
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
        // Sits on the app's card surface like every other panel, with the sky
        // accent carried by a single edge rather than a full wash.
        "relative overflow-hidden rounded-xl bg-card p-4 pl-[1.0625rem] text-card-foreground ring-1 ring-foreground/10",
        "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-sky-500/70 dark:before:bg-sky-400/70",
        className,
      )}
      aria-label={t("worker.elicitation.title")}
    >
      {/* Eyebrow: quietest thing in the card. The question below is the title. */}
      <div className="flex items-center gap-1.5 text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        <MessageCircleQuestion className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
        {t("worker.elicitation.title")}
      </div>
      <p className="mt-1.5 text-[0.9375rem] font-semibold leading-6 text-foreground">
        {elicitation.message || t("worker.elicitation.defaultQuestion")}
      </p>
      {safeUrl ? (
        <a
          href={safeUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-3 inline-flex h-9 items-center rounded-lg bg-sky-500/10 px-3 text-sm font-medium text-sky-700 transition-colors hover:bg-sky-500/15 dark:text-sky-300"
        >
          {t("worker.elicitation.openLink")}
        </a>
      ) : null}
      {usesQuestionTabs ? (
        <div
          role="tablist"
          aria-label={t("worker.elicitation.title")}
          className="mt-4 flex flex-wrap gap-x-1 border-b border-border/70"
        >
          {questionFields.map((field, index) => {
            const selected = field.name === activeQuestion?.name;
            const tabId = `${prefix}${field.name}:tab`;
            return (
              <button
                key={field.name}
                id={tabId}
                type="button"
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                disabled={disabled}
                onClick={() => workerCardManager.setElicitationDraft(activeQuestionDraftKey, field.name)}
                onKeyDown={(event) => {
                  const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
                  const targetIndex = event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? questionFields.length - 1
                      : direction
                        ? (index + direction + questionFields.length) % questionFields.length
                        : -1;
                  const target = questionFields[targetIndex];
                  if (!target) return;
                  event.preventDefault();
                  workerCardManager.setElicitationDraft(activeQuestionDraftKey, target.name);
                  document.getElementById(`${prefix}${target.name}:tab`)?.focus();
                }}
                className={cn(
                  "-mb-px border-b-2 px-2.5 pb-2 pt-1 text-[0.8125rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50",
                  selected
                    ? "border-sky-500 text-foreground dark:border-sky-400"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {field.label}
              </button>
            );
          })}
        </div>
      ) : null}
      <div
        role={usesQuestionTabs ? "tabpanel" : undefined}
        aria-labelledby={usesQuestionTabs && activeQuestion ? `${prefix}${activeQuestion.name}:tab` : undefined}
        className="mt-4 space-y-4"
      >
        {visibleFields.map((field) => {
          const draftKey = `${prefix}${field.name}`;
          const value = values[field.name];
          const isTabbedQuestion = usesQuestionTabs && QUESTION_FIELD_PATTERN.test(field.name);
          const otherKey = perQuestionOther && acceptsOtherText(field) ? otherDraftKey(prefix, field.name) : null;
          return (
            <fieldset key={field.name} className="space-y-1.5">
              <legend className={cn("text-[0.8125rem] font-medium text-foreground", isTabbedQuestion && "sr-only")}>{field.label}</legend>
              {field.description ? (
                <p className="text-xs leading-5 text-muted-foreground">{field.description}</p>
              ) : null}
              {field.kind === "single_select" ? (
                // A bordered, shaded box per option turned a short list of words
                // into a stack of competing cards. The control is the affordance;
                // the row only needs hover and a selected tint.
                <div className="-mx-1.5 grid">
                  {field.options.map((option) => (
                    <label
                      key={option.value}
                      className={cn(
                        "flex cursor-pointer items-start gap-2.5 rounded-lg px-1.5 py-1.5 text-[0.8125rem] leading-5 transition-colors",
                        value === option.value
                          ? "bg-sky-500/10 text-foreground dark:bg-sky-400/10"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      )}
                    >
                      <input
                        type="radio"
                        name={draftKey}
                        value={option.value}
                        checked={value === option.value}
                        disabled={disabled}
                        onChange={() => workerCardManager.setElicitationDraft(draftKey, option.value)}
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-sky-600 dark:accent-sky-400"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              ) : field.kind === "multi_select" ? (
                <div className="-mx-1.5 grid">
                  {field.options.map((option) => {
                    const optionKey = optionDraftKey(prefix, field.name, option.value);
                    const stored = workerCardManager.readElicitationDraft(optionKey);
                    const checked = stored === "true" || (stored === "" && Array.isArray(field.defaultValue) && field.defaultValue.includes(option.value));
                    return (
                      <label
                        key={option.value}
                        className={cn(
                          "flex cursor-pointer items-start gap-2.5 rounded-lg px-1.5 py-1.5 text-[0.8125rem] leading-5 transition-colors",
                          checked
                            ? "bg-sky-500/10 text-foreground dark:bg-sky-400/10"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                      >
                        <input
                          type="checkbox"
                          value={option.value}
                          checked={checked}
                          disabled={disabled}
                          onChange={(event) => workerCardManager.setElicitationDraft(optionKey, String(event.target.checked))}
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded accent-sky-600 dark:accent-sky-400"
                        />
                        <span>{option.label}</span>
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
                  className="min-h-20 resize-y text-[0.8125rem]"
                />
              ) : (
                <Input
                  type="number"
                  value={String(value ?? "")}
                  disabled={disabled}
                  placeholder={t("worker.elicitation.inputPlaceholder")}
                  onChange={(event) => workerCardManager.setElicitationDraft(draftKey, event.target.value)}
                  className="text-[0.8125rem]"
                />
              )}
              {otherKey && customAnswerField ? (
                <div className="space-y-1.5 pt-1">
                  <label
                    htmlFor={otherKey}
                    className="block text-[0.8125rem] font-medium text-foreground"
                  >
                    {customAnswerField.label}
                  </label>
                  {customAnswerField.description ? (
                    <p className="text-xs leading-5 text-muted-foreground">{customAnswerField.description}</p>
                  ) : null}
                  <Textarea
                    id={otherKey}
                    value={workerCardManager.readElicitationDraft(otherKey)}
                    disabled={disabled}
                    placeholder={t("worker.elicitation.inputPlaceholder")}
                    onChange={(event) => workerCardManager.setElicitationDraft(otherKey, event.target.value)}
                    className="min-h-20 resize-y text-[0.8125rem]"
                  />
                </div>
              ) : null}
            </fieldset>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-1.5">
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          disabled={disabled || !onRespond}
          onClick={() => { void submit("decline"); }}
        >
          <X className="h-3.5 w-3.5" />
          {t("worker.elicitation.skip")}
        </button>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[0.8125rem] font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
