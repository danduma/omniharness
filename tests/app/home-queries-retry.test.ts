import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { refetchFailedQueries } from "@/lib/failed-query-retry";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

/** Mount a query the way `useQuery` does, so it counts as active. */
function observe(queryClient: QueryClient, queryFn: () => Promise<unknown>) {
  const observer = new QueryObserver(queryClient, {
    queryKey: ["settings"],
    queryFn,
    retry: false,
  });
  const unsubscribe = observer.subscribe(() => {});
  return { observer, unsubscribe };
}

describe("refetchFailedQueries", () => {
  it("clears a settings error once the runtime is reachable again", async () => {
    const queryClient = createQueryClient();
    const queryFn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ values: {} });
    const { observer, unsubscribe } = observe(queryClient, queryFn);

    await observer.refetch();
    expect(observer.getCurrentResult().status).toBe("error");
    expect(observer.getCurrentResult().error).toBeInstanceOf(TypeError);

    await refetchFailedQueries(queryClient);

    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(observer.getCurrentResult().status).toBe("success");
    expect(observer.getCurrentResult().error).toBeNull();

    unsubscribe();
  });

  it("leaves healthy queries alone", async () => {
    const queryClient = createQueryClient();
    const queryFn = vi.fn().mockResolvedValue({ values: {} });
    const { observer, unsubscribe } = observe(queryClient, queryFn);

    await observer.refetch();
    await refetchFailedQueries(queryClient);

    expect(queryFn).toHaveBeenCalledTimes(1);

    unsubscribe();
  });
});
