export type MentionMatch = {
  start: number;
  end: number;
  query: string;
};

export function getActiveMentionQuery(value: string, cursor: number): MentionMatch | null {
  const beforeCursor = value.slice(0, cursor);
  const mentionStart = beforeCursor.lastIndexOf("@");

  if (mentionStart === -1) {
    return null;
  }

  const charBeforeMention = mentionStart === 0 ? " " : beforeCursor[mentionStart - 1];
  if (!/\s/.test(charBeforeMention)) {
    return null;
  }

  const query = beforeCursor.slice(mentionStart + 1);
  if (/\s/.test(query)) {
    return null;
  }

  return {
    start: mentionStart,
    end: cursor,
    query,
  };
}

export function replaceActiveMention(value: string, mention: MentionMatch, filePath: string) {
  return `${value.slice(0, mention.start)}@${filePath} ${value.slice(mention.end)}`;
}
