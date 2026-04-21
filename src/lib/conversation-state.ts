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
