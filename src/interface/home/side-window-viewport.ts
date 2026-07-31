export type ViewportMatcher = {
  matchMedia: (query: string) => { matches: boolean };
};

const DESKTOP_SIDE_WINDOW_QUERY = "(min-width: 1024px)";

export function shouldOpenMobileSideWindow(
  viewport: ViewportMatcher | null | undefined =
    typeof window === "undefined" ? null : window,
) {
  return !viewport?.matchMedia(DESKTOP_SIDE_WINDOW_QUERY).matches;
}
