import { getPriority, setPriority } from "node:os";
import { emitNamedEvent } from "@/server/events/named-events";

// Keep the HTTP runner and ACP bridge responsive while workers compete for CPU.
// Descendants inherit this priority, including builds and emulators launched by
// the agent. Never lower the runner/bridge themselves or raise an existing nice
// value: doing so can require privileges and undo a user's scheduling policy.
const WORKER_NICE = 10;

export function lowerWorkerProcessPriority(pid: number | undefined): void {
  // setPriority(0, ...) targets this process, not a failed child spawn.
  if (!pid || pid <= 0 || pid === process.pid) return;
  try {
    const previousPriority = getPriority(pid);
    if (previousPriority >= WORKER_NICE) return;
    setPriority(pid, WORKER_NICE);
    emitNamedEvent({
      kind: "process.priority_lowered", pid, previousPriority, priority: WORKER_NICE,
    });
  } catch (error) {
    // Scheduling is best effort; callers must retain ownership and attach exit
    // handlers even when the child exits before this syscall or the OS refuses.
    emitNamedEvent({
      kind: "process.priority_failed", pid,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
