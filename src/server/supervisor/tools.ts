import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { SUPPORTED_WORKER_TYPES } from "./worker-types";

const queuedToolResult = async () => ({ queued: true });

export function buildSupervisorTools(options?: { allowedWorkerTypes?: string[]; preferredWorkerType?: string | null }) {
  const allowedWorkerTypes = options?.allowedWorkerTypes?.length ? options.allowedWorkerTypes : [...SUPPORTED_WORKER_TYPES];
  const preferredWorkerType = options?.preferredWorkerType?.trim() || null;

  return {
    worker_spawn: createTool({
      id: "worker_spawn",
      description:
        `Spawn a new external coding worker. Prefer one main worker unless a distinct independent validator or sidecar is necessary. ` +
        `Use independent validator workers to check mocked paths, fake controls, placeholder implementations, and whether the real user-facing path works. ` +
        `Only use these worker types for this run: ${allowedWorkerTypes.join(", ")}.` +
        (preferredWorkerType ? ` Prefer ${preferredWorkerType} when it is suitable.` : ""),
      inputSchema: z.object({
        type: z.string().describe(`External harness type. Valid values for this run: ${allowedWorkerTypes.join(", ")}.`),
        cwd: z.string().describe("Working directory for the worker."),
        mode: z.string().optional().describe("Worker permission mode such as auto, full-access, or read-only."),
        title: z.string().describe("Short user-visible title for this worker based on the exact task allocated to it."),
        purpose: z.string().optional().describe("Short purpose for why this worker exists."),
        prompt: z.string().describe("Initial prompt to send immediately after spawn."),
      }),
      execute: queuedToolResult,
    }),
    worker_continue: createTool({
      id: "worker_continue",
      description: "Send a follow-up prompt to an existing worker when it needs direction, validation, or a push to continue.",
      inputSchema: z.object({
        workerId: z.string(),
        prompt: z.string(),
        interventionType: z.enum(["continue", "completion_gap", "recovery"]).optional()
          .describe("Why the supervisor is steering the worker."),
      }),
      execute: queuedToolResult,
    }),
    worker_cancel: createTool({
      id: "worker_cancel",
      description: "Cancel a worker that is no longer needed, has gone off track, or should be replaced.",
      inputSchema: z.object({
        workerId: z.string(),
        reason: z.string(),
        optionId: z.string().optional().describe("Explicit permission option id when the bridge exposes one."),
      }),
      execute: queuedToolResult,
    }),
    worker_set_mode: createTool({
      id: "worker_set_mode",
      description: "Change an existing worker's mode.",
      inputSchema: z.object({
        workerId: z.string(),
        mode: z.string(),
      }),
      execute: queuedToolResult,
    }),
    worker_approve: createTool({
      id: "worker_approve",
      description: "Approve a worker permission request when it is safe and expected.",
      inputSchema: z.object({
        workerId: z.string(),
        reason: z.string(),
        optionId: z.string().optional().describe("Explicit permission option id such as allow_always, allow_once, or reject_once."),
      }),
      execute: queuedToolResult,
    }),
    worker_deny: createTool({
      id: "worker_deny",
      description: "Deny a worker permission request when it should not proceed.",
      inputSchema: z.object({
        workerId: z.string(),
        reason: z.string(),
        optionId: z.string().optional().describe("Explicit permission option id such as reject_once or reject_always."),
      }),
      execute: queuedToolResult,
    }),
    ask_user: createTool({
      id: "ask_user",
      description:
        "Pause the run for preflight intent confirmation, summarize the understood job as specific outcomes and not just the artifact title, or ask the user a clarifying question.",
      inputSchema: z.object({
        question: z.string(),
      }),
      execute: queuedToolResult,
    }),
    read_file: createTool({
      id: "read_file",
      description:
        "Read a local repository file, such as a referenced spec or plan, before asking the user to summarize content the supervisor can inspect itself. Use inspect_repo for targeted searching or line-range inspection instead of rereading a whole file.",
      inputSchema: z.object({
        path: z.string().describe("Absolute path or path relative to the run project directory."),
      }),
      execute: queuedToolResult,
    }),
    inspect_repo: createTool({
      id: "inspect_repo",
      description:
        "Run a read-only repository inspection command for targeted searching, listing, or line-oriented inspection. Prefer this over repeated full-file reads. Allowed commands: rg, grep, find, sed, awk, head, tail, wc, ls, pwd.",
      inputSchema: z.object({
        command: z.enum(["rg", "grep", "find", "sed", "awk", "head", "tail", "wc", "ls", "pwd"]),
        args: z.array(z.string()).describe("Arguments passed directly to the command without a shell."),
        cwd: z.string().optional().describe("Optional working directory. Relative paths resolve under the run project directory."),
        reason: z.string().optional().describe("Short explanation of what information this inspection is looking for."),
      }),
      execute: queuedToolResult,
    }),
    wait_until: createTool({
      id: "wait_until",
      description: "Take no intervention right now and check again later.",
      inputSchema: z.object({
        seconds: z.number().describe("How long to wait before the next supervisory heartbeat."),
        reason: z.string(),
      }),
      execute: queuedToolResult,
    }),
    mark_complete: createTool({
      id: "mark_complete",
      description: "Mark the run complete once the goal is fully achieved and any live workers can be torn down.",
      inputSchema: z.object({
        summary: z.string(),
      }),
      execute: queuedToolResult,
    }),
    mark_failed: createTool({
      id: "mark_failed",
      description: "Mark the run failed when the supervisor cannot continue without intervention.",
      inputSchema: z.object({
        reason: z.string(),
      }),
      execute: queuedToolResult,
    }),
  };
}
