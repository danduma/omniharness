export type ConversationSidebarRowMetrics = {
  /** Full scrollable height of the conversation list. */
  scrollHeight: number;
  /** Visible height of the list viewport. */
  clientHeight: number;
  /** Row offset measured from the top of the scrollable content. */
  rowTop: number;
  /** Row height, so a tall row centres on its middle rather than its top edge. */
  rowHeight: number;
};

export function clampScrollTop(scrollTop: number, scrollHeight: number, clientHeight: number) {
  return Math.min(Math.max(scrollTop, 0), Math.max(0, scrollHeight - clientHeight));
}

/**
 * Offset that puts a conversation row in the vertical middle of the list
 * viewport, clamped to the scrollable range so rows near either end settle
 * flush instead of asking for an offset the viewport cannot reach.
 */
export function centeredScrollTop({ scrollHeight, clientHeight, rowTop, rowHeight }: ConversationSidebarRowMetrics) {
  return clampScrollTop(rowTop - (clientHeight - rowHeight) / 2, scrollHeight, clientHeight);
}
