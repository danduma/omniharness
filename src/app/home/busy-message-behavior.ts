export type BusyMessageAction = "queue" | "steer";
export type BusyComposerButtonKind = "send" | "stop";
export type BusyComposerSubmitAction = "send_normal" | "send_queue" | "send_steer" | "stop";

export type BusyComposerBehavior = {
  buttonKind: BusyComposerButtonKind;
  submitAction: BusyComposerSubmitAction;
  ariaLabel: string;
};

export function parseBusyMessageAction(value: string | null | undefined): BusyMessageAction {
  return value === "steer" ? "steer" : "queue";
}

export function resolveBusyComposerBehavior({
  hasBusyConversation,
  isConversationStoppable,
  hasContent,
  busyMessageAction,
}: {
  hasBusyConversation: boolean;
  isConversationStoppable: boolean;
  hasContent: boolean;
  busyMessageAction: BusyMessageAction;
}): BusyComposerBehavior {
  if (isConversationStoppable && !hasContent) {
    return {
      buttonKind: "stop",
      submitAction: "stop",
      ariaLabel: "Stop conversation",
    };
  }

  if (hasBusyConversation && hasContent) {
    return busyMessageAction === "steer"
      ? {
          buttonKind: "send",
          submitAction: "send_steer",
          ariaLabel: "Steer active work",
        }
      : {
          buttonKind: "send",
          submitAction: "send_queue",
          ariaLabel: "Queue message",
        };
  }

  return {
    buttonKind: "send",
    submitAction: "send_normal",
    ariaLabel: "Send message",
  };
}
