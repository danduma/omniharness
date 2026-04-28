import type { SupervisorToolDefinition } from "./protocol";
import { SUPPORTED_WORKER_TYPES } from "./worker-types";

export function buildSupervisorTools(options?: { allowedWorkerTypes?: string[]; preferredWorkerType?: string | null }): SupervisorToolDefinition[] {
  const allowedWorkerTypes = options?.allowedWorkerTypes?.length ? options.allowedWorkerTypes : [...SUPPORTED_WORKER_TYPES];
  const preferredWorkerType = options?.preferredWorkerType?.trim() || null;
  return [
    {
      type: "function",
      function: {
        name: "worker_spawn",
        description:
          `Spawn a new external coding worker. Prefer one main worker unless a distinct independent validator or sidecar is necessary. ` +
          `Use independent validator workers to check mocked paths, fake controls, placeholder implementations, and whether the real user-facing path works. ` +
          `Only use these worker types for this run: ${allowedWorkerTypes.join(", ")}.` +
          (preferredWorkerType ? ` Prefer ${preferredWorkerType} when it is suitable.` : ""),
        parameters: {
          type: "object",
          properties: {
            type: { type: "string", description: `External harness type. Valid values for this run: ${allowedWorkerTypes.join(", ")}.` },
            cwd: { type: "string", description: "Working directory for the worker." },
            mode: { type: "string", description: "Worker permission mode such as auto, full-access, or read-only." },
            title: { type: "string", description: "Short user-visible title for this worker based on the exact task allocated to it." },
            purpose: { type: "string", description: "Short purpose for why this worker exists." },
            prompt: { type: "string", description: "Initial prompt to send immediately after spawn." },
          },
          required: ["type", "cwd", "title", "prompt"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "worker_continue",
        description: "Send a follow-up prompt to an existing worker when it needs direction, validation, or a push to continue.",
        parameters: {
          type: "object",
          properties: {
            workerId: { type: "string" },
            prompt: { type: "string" },
            interventionType: {
              type: "string",
              description: "Why the supervisor is steering the worker. Use continue, completion_gap, or recovery when applicable.",
              enum: ["continue", "completion_gap", "recovery"],
            },
          },
          required: ["workerId", "prompt"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "worker_cancel",
        description: "Cancel a worker that is no longer needed, has gone off track, or should be replaced.",
        parameters: {
          type: "object",
          properties: {
            workerId: { type: "string" },
            reason: { type: "string" },
            optionId: { type: "string", description: "Explicit permission option id such as allow_always, allow_once, or reject_once when the bridge exposes one." },
          },
          required: ["workerId", "reason"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "worker_set_mode",
        description: "Change an existing worker's mode.",
        parameters: {
          type: "object",
          properties: {
            workerId: { type: "string" },
            mode: { type: "string" },
          },
          required: ["workerId", "mode"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "worker_approve",
        description: "Approve a worker permission request when it is safe and expected.",
        parameters: {
          type: "object",
          properties: {
            workerId: { type: "string" },
            reason: { type: "string" },
            optionId: { type: "string", description: "Explicit permission option id such as allow_always, allow_once, or reject_once when the bridge exposes one." },
          },
          required: ["workerId", "reason"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "worker_deny",
        description: "Deny a worker permission request when it should not proceed.",
        parameters: {
          type: "object",
          properties: {
            workerId: { type: "string" },
            reason: { type: "string" },
            optionId: { type: "string", description: "Explicit permission option id such as reject_once or reject_always when the bridge exposes one." },
          },
          required: ["workerId", "reason"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "ask_user",
        description: "Pause the run and ask the user a clarification question.",
        parameters: {
          type: "object",
          properties: {
            question: { type: "string" },
          },
          required: ["question"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "wait_until",
        description: "Take no intervention right now and check again later.",
        parameters: {
          type: "object",
          properties: {
            seconds: { type: "number", description: "How long to wait before the next supervisory heartbeat." },
            reason: { type: "string" },
          },
          required: ["seconds", "reason"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "mark_complete",
        description: "Mark the run complete once the goal is fully achieved and any live workers can be torn down.",
        parameters: {
          type: "object",
          properties: {
            summary: { type: "string" },
          },
          required: ["summary"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "mark_failed",
        description: "Mark the run failed when the supervisor cannot continue without intervention.",
        parameters: {
          type: "object",
          properties: {
            reason: { type: "string" },
          },
          required: ["reason"],
        },
      },
    },
  ];
}
