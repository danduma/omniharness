import { useMemo } from "react";
import { type AppErrorDescriptor, mergeAppErrors } from "@/lib/app-errors";
import type { EventStreamState } from "./types";
import { buildInlineError } from "./utils";

interface UseAppErrorsProps {
  state: EventStreamState;
  runtimeErrors: AppErrorDescriptor[];
  projectFilesError: unknown;
  settingsError: unknown;
  runCommandError: unknown;
  recoverRunError: unknown;
  renameRunError: unknown;
  deleteRunError: unknown;
  stopSupervisorError?: unknown;
  stopWorkerError?: unknown;
}

export function useAppErrors({
  state,
  runtimeErrors,
  projectFilesError,
  settingsError,
  runCommandError,
  recoverRunError,
  renameRunError,
  deleteRunError,
  stopSupervisorError,
  stopWorkerError,
}: UseAppErrorsProps) {
  return useMemo(() => {
    const errors: AppErrorDescriptor[] = [];

    errors.push(...(state.frontendErrors ?? []).map((error) => buildInlineError(error)));
    errors.push(...runtimeErrors);

    if (projectFilesError) {
      errors.push(buildInlineError(projectFilesError, {
        source: "Filesystem",
        action: "Load project files",
      }));
    }

    if (settingsError) {
      errors.push(buildInlineError(settingsError, {
        source: "Settings",
        action: "Load saved settings",
      }));
    }

    if (runCommandError) {
      errors.push(buildInlineError(runCommandError, {
        source: "Supervisor",
        action: "Start a run",
      }));
    }

    if (recoverRunError) {
      errors.push(buildInlineError(recoverRunError, {
        source: "Runs",
        action: "Recover conversation",
      }));
    }

    if (renameRunError) {
      errors.push(buildInlineError(renameRunError, {
        source: "Runs",
        action: "Rename conversation",
      }));
    }

    if (deleteRunError) {
      errors.push(buildInlineError(deleteRunError, {
        source: "Runs",
        action: "Delete conversation",
      }));
    }

    if (stopSupervisorError) {
      errors.push(buildInlineError(stopSupervisorError, {
        source: "Runs",
        action: "Stop supervisor",
      }));
    }

    if (stopWorkerError) {
      errors.push(buildInlineError(stopWorkerError, {
        source: "Runs",
        action: "Stop worker",
      }));
    }

    return mergeAppErrors([], errors);
  }, [
    deleteRunError,
    projectFilesError,
    recoverRunError,
    renameRunError,
    runCommandError,
    settingsError,
    stopSupervisorError,
    stopWorkerError,
    runtimeErrors,
    state.frontendErrors,
  ]);
}
