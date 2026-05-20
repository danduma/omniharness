export function getRunLatestMessageTimestamp(
  runId: string,
  messages: Array<{ runId: string; createdAt: string }>
) {
  let latest: string | null = null;

  for (const message of messages) {
    if (message.runId !== runId) {
      continue;
    }

    if (!latest || new Date(message.createdAt).getTime() > new Date(latest).getTime()) {
      latest = message.createdAt;
    }
  }

  return latest;
}

function timestampMs(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function laterTimestamp(left: string | null, right: string | null | undefined) {
  if (!right) {
    return left;
  }

  if (!left || timestampMs(right) > timestampMs(left)) {
    return right;
  }

  return left;
}

export function getRunLatestUnreadTimestamp(
  run: { id: string; status?: string | null; updatedAt?: string | null; createdAt?: string | null },
  messages: Array<{ runId: string; createdAt: string }>
) {
  const latestMessageAt = getRunLatestMessageTimestamp(run.id, messages);
  const status = run.status?.trim().toLowerCase().split(":")[0]?.trim() ?? "";

  if (status === "done" || status === "awaiting_user" || status === "failed" || status === "needs_recovery") {
    return laterTimestamp(latestMessageAt, run.updatedAt ?? run.createdAt ?? null);
  }

  return latestMessageAt;
}

export function isRunUnread(args: {
  latestMessageAt: string | null;
  lastReadAt: string | null;
}) {
  if (!args.latestMessageAt) {
    return false;
  }

  if (!args.lastReadAt) {
    return true;
  }

  return new Date(args.latestMessageAt).getTime() > new Date(args.lastReadAt).getTime();
}
