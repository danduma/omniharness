export interface SupervisorToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export function buildSupervisorTools(): SupervisorToolDefinition[] {
  return [
    {
      type: "function",
      function: {
        name: "plan_read",
        description: "Read the plan file",
        parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
      },
    },
    {
      type: "function",
      function: {
        name: "plan_checklist_update",
        description: "Track completion of a plan item",
        parameters: { type: "object", properties: { item: { type: "string" }, status: { type: "string" } }, required: ["item", "status"] },
      },
    },
    {
      type: "function",
      function: {
        name: "worker_spawn",
        description: "Spawn a new worker agent",
        parameters: { type: "object", properties: { type: { type: "string" }, cwd: { type: "string" }, mode: { type: "string" } }, required: ["type", "cwd"] },
      },
    },
    {
      type: "function",
      function: {
        name: "worker_send_prompt",
        description: "Send a prompt to the worker",
        parameters: { type: "object", properties: { id: { type: "string" }, prompt: { type: "string" } }, required: ["id", "prompt"] },
      },
    },
    {
      type: "function",
      function: {
        name: "worker_read_output",
        description: "Fetch buffered output",
        parameters: { type: "object", properties: { id: { type: "string" }, since: { type: "string" } }, required: ["id"] },
      },
    },
    {
      type: "function",
      function: {
        name: "worker_approve",
        description: "Approve a pending permission request for a worker",
        parameters: { type: "object", properties: { id: { type: "string" }, reqId: { type: "number" } }, required: ["id", "reqId"] },
      },
    },
    {
      type: "function",
      function: {
        name: "worker_deny",
        description: "Deny a pending permission request for a worker",
        parameters: { type: "object", properties: { id: { type: "string" }, reqId: { type: "number" } }, required: ["id", "reqId"] },
      },
    },
    {
      type: "function",
      function: {
        name: "worker_set_mode",
        description: "Set worker mode (full-access / auto / read-only)",
        parameters: { type: "object", properties: { id: { type: "string" }, mode: { type: "string" } }, required: ["id", "mode"] },
      },
    },
    {
      type: "function",
      function: {
        name: "worker_cancel",
        description: "Cancel a worker task or abort",
        parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      },
    },
    {
      type: "function",
      function: {
        name: "credits_check",
        description: "Check remaining budget/reset time for an account",
        parameters: { type: "object", properties: { accountId: { type: "string" } }, required: ["accountId"] },
      },
    },
    {
      type: "function",
      function: {
        name: "credits_switch",
        description: "Apply an exhaustion strategy (swap_account, fallback_api, wait_for_reset, cross_provider)",
        parameters: { type: "object", properties: { workerId: { type: "string" }, strategy: { type: "string" } }, required: ["workerId", "strategy"] },
      },
    },
    {
      type: "function",
      function: {
        name: "plan_mark_done",
        description: "Mark the plan as done",
        parameters: { type: "object", properties: { reason: { type: "string" } }, required: ["reason"] },
      },
    },
    {
      type: "function",
      function: {
        name: "user_ask",
        description: "Ask the user a question",
        parameters: { type: "object", properties: { question: { type: "string" } }, required: ["question"] },
      },
    },
  ];
}
