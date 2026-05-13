export type BusyMessageAction = "queue" | "steer";
export type BusyComposerButtonKind = "send" | "stop";
export type BusyComposerSubmitAction = "send_normal" | "send_queue" | "send_steer" | "stop";

export type BusyComposerBehavior = {
  buttonKind: BusyComposerButtonKind;
  submitAction: BusyComposerSubmitAction;
  ariaLabelKey: string;
  allowAlternateBusyAction: boolean;
};

export function parseBusyMessageAction(value: string | null | undefined): BusyMessageAction {
  return value === "steer" ? "steer" : "queue";
}

export function resolveBusyComposerBehavior({
  hasBusyConversation,
  isConversationStoppable,
  hasContent,
  busyMessageAction,
  forceSteer,
}: {
  hasBusyConversation: boolean;
  isConversationStoppable: boolean;
  hasContent: boolean;
  busyMessageAction: BusyMessageAction;
  forceSteer?: boolean;
}): BusyComposerBehavior {
  if (isConversationStoppable && !hasContent) {
    return {
      buttonKind: "stop",
      submitAction: "stop",
      ariaLabelKey: "conversation.composer.sendButton.stop",
      allowAlternateBusyAction: false,
    };
  }

  if (hasBusyConversation && hasContent) {
    return busyMessageAction === "steer" || forceSteer
      ? {
          buttonKind: "send",
          submitAction: "send_steer",
          ariaLabelKey: "conversation.composer.sendButton.steer",
          allowAlternateBusyAction: !forceSteer,
        }
      : {
          buttonKind: "send",
          submitAction: "send_queue",
          ariaLabelKey: "conversation.composer.sendButton.queue",
          allowAlternateBusyAction: true,
        };
  }

  return {
    buttonKind: "send",
    submitAction: "send_normal",
    ariaLabelKey: "conversation.composer.sendButton.send",
    allowAlternateBusyAction: false,
  };
}

export function resolveBusyMessageActionForSubmitAction(
  submitAction: BusyComposerSubmitAction,
  options: { useAlternate?: boolean } = {},
): BusyMessageAction | undefined {
  if (submitAction === "send_queue") {
    return options.useAlternate ? "steer" : "queue";
  }

  if (submitAction === "send_steer") {
    return options.useAlternate ? "queue" : "steer";
  }

  return undefined;
}
