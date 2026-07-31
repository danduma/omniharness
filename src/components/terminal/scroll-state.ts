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
