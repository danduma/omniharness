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
  sendConversationMessageError?: unknown;
  cancelQueuedMessageError?: unknown;
  autoCommitChatError?: unknown;
  autoCommitProjectError?: unknown;
  recoverRunError: unknown;
  renameRunError: unknown;
  deleteRunError: unknown;
  stopSupervisorError?: unknown;
  stopWorkerError?: unknown;
}

function isUnsupportedRecoverRunError(error: unknown) {
  return buildInlineError(error).message === "Recovery actions are only available in direct control conversations";
}

export function useAppErrors({
  state,
  runtimeErrors,
  projectFilesError,
  settingsError,
  runCommandError,
  sendConversationMessageError,
  cancelQueuedMessageError,
  autoCommitChatError,
  autoCommitProjectError,
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

    if (sendConversationMessageError) {
      errors.push(buildInlineError(sendConversationMessageError, {
        source: "Conversations",
        action: "Send a conversation message",
      }));
    }

    if (cancelQueuedMessageError) {
      errors.push(buildInlineError(cancelQueuedMessageError, {
        source: "Conversations",
        action: "Cancel queued message",
      }));
    }

    if (autoCommitChatError) {
      errors.push(buildInlineError(autoCommitChatError, {
        source: "Conversations",
        action: "Auto commit chat",
      }));
    }

    if (autoCommitProjectError) {
      errors.push(buildInlineError(autoCommitProjectError, {
        source: "Conversations",
        action: "Auto commit project",
      }));
    }

    if (recoverRunError && !isUnsupportedRecoverRunError(recoverRunError)) {
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
    autoCommitChatError,
    autoCommitProjectError,
    cancelQueuedMessageError,
    deleteRunError,
    projectFilesError,
    recoverRunError,
    renameRunError,
    runCommandError,
    sendConversationMessageError,
    settingsError,
    stopSupervisorError,
    stopWorkerError,
    runtimeErrors,
    state.frontendErrors,
  ]);
}
