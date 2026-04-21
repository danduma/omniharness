interface PersistedMessage {
  role: string;
  kind?: string | null;
  content: string;
}

export function buildSupervisorConversation(
  persistedMessages: PersistedMessage[],
  planContent: string,
) {
  const conversation = persistedMessages.flatMap((message) => {
    const content = message.content.trim();
    if (!content || message.kind === "error" || message.role !== "user") {
      return [];
    }

    return [{ role: "user", content }];
  });

  if (conversation.length > 0) {
    return conversation;
  }

  const trimmedPlan = planContent.trim();
  if (!trimmedPlan) {
    return [];
  }

  return [{
    role: "user",
    content: `Execute this request:\n\n${trimmedPlan}`,
  }];
}
