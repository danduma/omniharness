import { describe, expect, it } from "vitest";
import { resolveBusyComposerBehavior } from "@/app/home/busy-message-behavior";

describe("busy message behavior", () => {
  it("keeps stop available for empty input while a conversation is stoppable", () => {
    expect(resolveBusyComposerBehavior({
      hasBusyConversation: true,
      isConversationStoppable: true,
      hasContent: false,
      busyMessageAction: "queue",
    })).toMatchObject({
      buttonKind: "stop",
      submitAction: "stop",
      ariaLabel: "Stop conversation",
    });
  });

  it("turns the busy stop control into queue send when text exists", () => {
    expect(resolveBusyComposerBehavior({
      hasBusyConversation: true,
      isConversationStoppable: true,
      hasContent: true,
      busyMessageAction: "queue",
    })).toMatchObject({
      buttonKind: "send",
      submitAction: "send_queue",
      ariaLabel: "Queue message",
    });
  });

  it("turns the busy stop control into steer send when settings request steering", () => {
    expect(resolveBusyComposerBehavior({
      hasBusyConversation: true,
      isConversationStoppable: true,
      hasContent: true,
      busyMessageAction: "steer",
    })).toMatchObject({
      buttonKind: "send",
      submitAction: "send_steer",
      ariaLabel: "Steer active work",
    });
  });

  it("uses the normal send action when the selected conversation is not busy", () => {
    expect(resolveBusyComposerBehavior({
      hasBusyConversation: false,
      isConversationStoppable: false,
      hasContent: true,
      busyMessageAction: "queue",
    })).toMatchObject({
      buttonKind: "send",
      submitAction: "send_normal",
      ariaLabel: "Send message",
    });
  });
});
