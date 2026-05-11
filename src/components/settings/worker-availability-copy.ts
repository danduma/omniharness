import type { WorkerAvailability } from "@/app/home/types";
import { t } from "@/lib/i18n";

export function getWorkerSetupCommand(worker: WorkerAvailability) {
  return worker.authentication?.setupCommand ?? worker.installation?.command ?? worker.type;
}

export function getWorkerAvailabilityMessage(worker: WorkerAvailability) {
  const command = getWorkerSetupCommand(worker);

  if (worker.authentication?.status === "not_authenticated") {
    return t("settings.agents.auth.notAuthenticated", { worker: worker.label, command });
  }

  if (worker.authentication?.status === "unknown") {
    return t("settings.agents.auth.unknown", { worker: worker.label, command });
  }

  if (!worker.availability.binary) {
    return t("settings.agents.auth.notInstalled", { worker: worker.label, command: worker.installation?.command ?? worker.type });
  }

  if (worker.availability.status !== "ok") {
    return worker.availability.message || t("settings.agents.unavailableNow");
  }

  return null;
}
