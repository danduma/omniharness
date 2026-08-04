const TERMINAL_BOTTOM_THRESHOLD_PX = 1;

export function shouldTerminalFollowLatest(
  metrics: Pick<HTMLDivElement, "scrollTop" | "clientHeight" | "scrollHeight">,
) {
  return metrics.scrollHeight - metrics.clientHeight - metrics.scrollTop
    <= TERMINAL_BOTTOM_THRESHOLD_PX;
}

export function shouldTerminalKeepFollowingLatest(
  metrics: Pick<HTMLDivElement, "scrollTop" | "clientHeight" | "scrollHeight">,
  previousScrollTop: number,
) {
  if (metrics.scrollTop < previousScrollTop) {
    return false;
  }

  return shouldTerminalFollowLatest(metrics);
}

/**
 * Keep the viewport on the content the reader was looking at when a page of
 * older history is prepended.
 *
 * A prepend grows `scrollHeight` above the viewport while leaving `scrollTop`
 * alone, so the reader stays pinned at the top with more content above them.
 * That is not just a lost place: the top boundary is what triggers the next
 * page, so staying there requested page after page until the whole transcript
 * had loaded. Shifting `scrollTop` by the height that was inserted holds the
 * reader at the boundary they stopped at and moves them off the trigger.
 *
 * Returns the corrected offset, or `null` when this commit was not a prepend
 * and the position must be left alone.
 */
export function resolveTerminalPrependedScrollTop({
  previousFirstActivityId,
  nextFirstActivityId,
  isPreviousFirstActivityStillRendered,
  previousScrollHeight,
  nextScrollHeight,
  scrollTop,
}: {
  previousFirstActivityId: string | null;
  nextFirstActivityId: string | null;
  isPreviousFirstActivityStillRendered: boolean;
  previousScrollHeight: number;
  nextScrollHeight: number;
  scrollTop: number;
}) {
  // A different first row with the old one gone is a replaced transcript —
  // switching conversations, or a rewind dropping rows. Only a first row that
  // moved down while staying rendered is history arriving above it.
  if (
    previousFirstActivityId === null
    || nextFirstActivityId === null
    || previousFirstActivityId === nextFirstActivityId
    || !isPreviousFirstActivityStillRendered
  ) {
    return null;
  }

  const insertedHeight = nextScrollHeight - previousScrollHeight;
  if (insertedHeight <= 0) {
    return null;
  }

  return scrollTop + insertedHeight;
}

export function shouldTerminalResetInitialPosition({
  previousFirstActivityId,
  nextFirstActivityId,
  scrollAnchorChanged,
}: {
  previousFirstActivityId: string | null;
  nextFirstActivityId: string | null;
  scrollAnchorChanged: boolean;
}) {
  return scrollAnchorChanged
    || (previousFirstActivityId === null && nextFirstActivityId !== null);
}
