import type { ComposerWorkerOption, ConversationModeOption, WorkerType } from "./types";
import { resolveComposerEffortValue, resolveSelectedWorkerModel } from "./utils";

/**
 * The worker identity a send is launched with, frozen at the moment the user
 * hit send.
 *
 * Reading the live composer state from inside a mutation function is not safe.
 * `runCommand.onMutate` selects the conversation it is about to create, React
 * flushes that render before the awaited mutation function runs, and React
 * Query reads `options.mutationFn` lazily — so the request went out with
 * whatever the freshly selected (draftless) conversation had fallen back to,
 * which is the first model in the worker's catalogue. Carrying the selection
 * through the mutation variables makes the launch identity immune to any
 * re-render that happens between `mutate()` and the request.
 */
export type ComposerLaunchSelection = {
  conversationMode: ConversationModeOption;
  workerType: WorkerType | null;
  isAutoWorkerSelection: boolean;
  /** `null` means "keep the model this conversation already runs on". */
  model: string | null;
  effort: string;
  accountId: string | null;
  allowedWorkerTypes: WorkerType[];
};

export function resolveComposerLaunchSelection(args: {
  conversationMode: ConversationModeOption;
  selectedCliAgent: ComposerWorkerOption;
  selectedModel: string;
  selectedEffort: string;
  selectedWorkerAccountId: string;
  autoSelectedWorkerType: WorkerType | null;
  activeAllowedWorkerTypes: WorkerType[];
  activeWorkerModelValues: string[];
}): ComposerLaunchSelection {
  const explicitWorkerType = args.selectedCliAgent === "auto" ? null : args.selectedCliAgent;
  const isAutoWorkerSelection = explicitWorkerType === null;
  const workerType = explicitWorkerType ?? args.autoSelectedWorkerType;
  const resolvedModel = workerType
    ? resolveSelectedWorkerModel(workerType, args.selectedModel).trim()
    : "";
  // An explicit worker owns the model picker, so its value is asserted as-is.
  // Under "auto" the picker follows whichever worker the policy resolves to,
  // and a model left over from a different worker is not a choice for this one
  // — leaving it out keeps the conversation on the model it already ran.
  const model = isAutoWorkerSelection
    ? args.activeWorkerModelValues.includes(resolvedModel) ? resolvedModel : null
    : resolvedModel || null;

  return {
    conversationMode: args.conversationMode,
    workerType,
    isAutoWorkerSelection,
    model,
    effort: resolveComposerEffortValue(args.selectedEffort),
    accountId: args.selectedWorkerAccountId === "auto" ? null : args.selectedWorkerAccountId,
    allowedWorkerTypes: isAutoWorkerSelection
      ? args.activeAllowedWorkerTypes
      : workerType
        ? [workerType]
        : args.activeAllowedWorkerTypes,
  };
}

/**
 * The worker-preference fields of a create/send request body.
 *
 * `preferredWorkerModel` is omitted rather than sent as null when there is no
 * model to assert: the message route reads a present-but-empty value as "reset
 * this conversation's model", and that reset is what dropped a conversation
 * back onto the first model in the catalogue on its second message.
 */
export function buildLaunchPreferenceBody(selection: ComposerLaunchSelection) {
  return {
    preferredWorkerType: selection.workerType,
    preferredWorkerEffort: selection.effort,
    preferredWorkerAccountId: selection.accountId,
    allowedWorkerTypes: selection.allowedWorkerTypes,
    ...(selection.model ? { preferredWorkerModel: selection.model } : {}),
  };
}
