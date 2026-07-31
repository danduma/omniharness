import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetNamedEventsForTests,
  getNamedEventsSince,
} from "@/server/events/named-events";
import { emitRunnerStaticUiStatus } from "@/server/runner/static-ui-status";

describe("runner static UI startup event", () => {
  beforeEach(() => {
    __resetNamedEventsForTests();
  });

  it.each([
    [true, "/tmp/interface", false, "runner.static_ui_enabled"],
    [false, "/tmp/interface", false, "runner.static_ui_missing"],
    [false, null, true, "runner.static_ui_missing"],
  ] as const)("emits exactly one status event", (enabled, staticDir, staticDisabled, kind) => {
    emitRunnerStaticUiStatus({ staticDir, staticDisabled }, enabled);

    const events = getNamedEventsSince(0).events
      .map((entry) => entry.event)
      .filter((event) => event.kind.startsWith("runner.static_ui_"));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind });
  });
});
