import type { QueryClient } from "@tanstack/react-query";

/**
 * Retry every mounted query that is currently holding an error.
 *
 * A failed query keeps its error until some later fetch succeeds, and these
 * queries are otherwise only fetched on mount. `navigator.onLine` does not
 * notice a connection that is up but cannot reach the runtime, so React Query's
 * own `refetchOnReconnect` never fires for that case either. Without an
 * explicit retry, one dropped request left its banner ("Load saved settings —
 * Failed to fetch") on screen for the rest of the page's life, long after the
 * runtime became reachable again.
 *
 * Call this when a connection is observed to recover. Queries that fail for a
 * reason other than connectivity simply fail again and keep their error.
 */
export function refetchFailedQueries(queryClient: QueryClient) {
  return queryClient.refetchQueries({
    type: "active",
    predicate: (query) => query.state.status === "error",
  });
}
