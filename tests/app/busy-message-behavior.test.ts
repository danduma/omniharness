import { describe, expect, it } from "vitest";
import {
  resolveBusyComposerBehavior,
  resolveBusyMessageActionForSubmitAction,
} from "@/app/home/busy-message-behavior";

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
      ariaLabelKey: "conversation.composer.sendButton.stop",
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
      ariaLabelKey: "conversation.composer.sendButton.queue",
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
      ariaLabelKey: "conversation.composer.sendButton.steer",
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
      ariaLabelKey: "conversation.composer.sendButton.send",
    });
  });

  it("resolves the alternate busy action from the configured default", () => {
    expect(resolveBusyMessageActionForSubmitAction("send_queue")).toBe("queue");
    expect(resolveBusyMessageActionForSubmitAction("send_queue", { useAlternate: true })).toBe("steer");
    expect(resolveBusyMessageActionForSubmitAction("send_steer")).toBe("steer");
    expect(resolveBusyMessageActionForSubmitAction("send_steer", { useAlternate: true })).toBe("queue");
  });

  it("does not invent a busy action for normal sends or stop controls", () => {
    expect(resolveBusyMessageActionForSubmitAction("send_normal")).toBeUndefined();
    expect(resolveBusyMessageActionForSubmitAction("stop", { useAlternate: true })).toBeUndefined();
  });
});
