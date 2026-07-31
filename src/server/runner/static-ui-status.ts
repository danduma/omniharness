import { emitNamedEvent } from "@/server/events/named-events";
import type { RunnerConfig } from "./config";

export function emitRunnerStaticUiStatus(
  config: Pick<RunnerConfig, "staticDir" | "staticDisabled">,
  enabled: boolean,
) {
  return emitNamedEvent(enabled
    ? {
        kind: "runner.static_ui_enabled",
        staticDir: config.staticDir!,
      }
    : {
        kind: "runner.static_ui_missing",
        staticDir: config.staticDir,
        reason: config.staticDisabled ? "disabled" : "not_found",
      });
}
