import { startRunObserver } from "./observer";
import { scheduleSupervisorWake } from "./wake";

export function startSupervisorRun(runId: string) {
  startRunObserver(runId, scheduleSupervisorWake);
  scheduleSupervisorWake(runId, 0);
}
