import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React from "react";
import { MarkdownContent } from "@/components/MarkdownContent";

// Helper to inspect the rendered virtual DOM tree of a React element
function findReactNodes(node: any, predicate: (n: any) => boolean): any[] {
  if (!node) return [];
  const results: any[] = [];
  if (predicate(node)) {
    results.push(node);
  }
  if (node.props && node.props.children) {
    const children = Array.isArray(node.props.children)
      ? node.props.children
      : [node.props.children];
    for (const child of children) {
      results.push(...findReactNodes(child, predicate));
    }
  }
  return results;
}

describe("MarkdownContent - Horizontal Rule rendering", () => {
  it("renders a horizontal rule for three or more dashes, asterisks, or underscores", () => {
    const hrDashes = MarkdownContent({ content: "---" });
    const hrAsterisks = MarkdownContent({ content: "***" });
    const hrUnderscores = MarkdownContent({ content: "___" });

    const hrNodesDashes = findReactNodes(hrDashes, (n) => n.type === "hr");
    const hrNodesAsterisks = findReactNodes(hrAsterisks, (n) => n.type === "hr");
    const hrNodesUnderscores = findReactNodes(hrUnderscores, (n) => n.type === "hr");

    expect(hrNodesDashes.length).toBe(1);
    expect(hrNodesAsterisks.length).toBe(1);
    expect(hrNodesUnderscores.length).toBe(1);

    expect(hrNodesDashes[0].props.className).toContain("border-t");
  });

  it("horizontal rule breaks paragraphs correctly", () => {
    const content = "Paragraph before\n---\nParagraph after";
    const tree = MarkdownContent({ content });

    const pNodes = findReactNodes(tree, (n) => n.type === "p");
    const hrNodes = findReactNodes(tree, (n) => n.type === "hr");

    expect(pNodes.length).toBe(2);
    expect(hrNodes.length).toBe(1);
  });
});

describe("MarkdownContent - Table rendering", () => {
  it("renders a standard markdown table with headers, borders and correct values", () => {
    const content = [
      "| Col A | Col B |",
      "| --- | --- |",
      "| Value 1 | Value 2 |",
      "| Value 3 | Value 4 |",
    ].join("\n");

    const tree = MarkdownContent({ content });
    const tableNodes = findReactNodes(tree, (n) => n.type === "table");
    expect(tableNodes.length).toBe(1);

    const thNodes = findReactNodes(tree, (n) => n.type === "th");
    expect(thNodes.length).toBe(2);

    const tdNodes = findReactNodes(tree, (n) => n.type === "td");
    expect(tdNodes.length).toBe(4);
  });

  it("applies column alignments correctly based on colons", () => {
    const content = [
      "| Left | Center | Right |",
      "| :--- | :---: | ---: |",
      "| L1 | C1 | R1 |",
    ].join("\n");

    const tree = MarkdownContent({ content });

    const thNodes = findReactNodes(tree, (n) => n.type === "th");
    expect(thNodes[0].props.className).toContain("text-left");
    expect(thNodes[1].props.className).toContain("text-center");
    expect(thNodes[2].props.className).toContain("text-right");

    const tdNodes = findReactNodes(tree, (n) => n.type === "td");
    expect(tdNodes[0].props.className).toContain("text-left");
    expect(tdNodes[1].props.className).toContain("text-center");
    expect(tdNodes[2].props.className).toContain("text-right");
  });

  it("renders inline formatted styling (like backticks or strong) inside table cells", () => {
    const content = [
      "| Styled Header |",
      "| --- |",
      "| **Bold** cell with `code` |",
    ].join("\n");

    const tree = MarkdownContent({ content });

    const codeNodes = findReactNodes(tree, (n) => n.type === "code");
    const strongNodes = findReactNodes(tree, (n) => n.type === "strong");

    expect(codeNodes.length).toBe(1);
    expect(strongNodes.length).toBe(1);
  });

  it("handles empty or mismatched cell values gracefully", () => {
    const content = [
      "| Col A | Col B |",
      "| --- | --- |",
      "| Value 1 |", // missing second cell
    ].join("\n");

    const tree = MarkdownContent({ content });
    const tdNodes = findReactNodes(tree, (n) => n.type === "td");
    expect(tdNodes.length).toBe(2); // should still render 2 columns corresponding to the 2 headers
  });

  it("tables interrupt paragraphs correctly", () => {
    const content = [
      "Some paragraph writing",
      "| Col A | Col B |",
      "| --- | --- |",
      "| Val A | Val B |",
      "Continuing normal writing",
    ].join("\n");

    const tree = MarkdownContent({ content });
    const pNodes = findReactNodes(tree, (n) => n.type === "p");
    const tableNodes = findReactNodes(tree, (n) => n.type === "table");

    expect(pNodes.length).toBe(2);
    expect(tableNodes.length).toBe(1);
  });

  it("renders the entire complex report from session 00d43e0c7102 successfully without crashing", () => {
    const content = [
      "# Architectural Report: Empowering and Generalizing the Supervisor Omni",
      "",
      "This report analyzes the existing **OmniHarness Supervisor** architecture, diagnoses its current capabilities and limitations, and proposes a concrete, actionable plan to give the supervisor direct filesystem and execution powers.",
      "",
      "---",
      "",
      "## 1. Executive Summary",
      "",
      "Under the current OmniHarness architecture, the **Supervisor Omni** behaves exclusively as a **High-Level Orchestrator & Coordinator**. It cannot make code edits or run verification scripts directly; instead, it is entirely dependent on spawning and steering external **CLI Workers** (e.g., Claude Code, Codex, Gemini, OpenCode) to mutate the workspace.",
      "",
      "While this separation of concerns is elegant, it introduces severe latency, high token usage, and fragility for minor remediation or verification steps. By equipping the supervisor with **direct surgical filesystem mutation** and **local sandboxed execution powers**, we can transform it into a hybrid agent capable of both high-level multi-worker coordination and low-level self-implementation.",
      "",
      "---",
      "",
      "## 2. Current Architectural Paradigm",
      "",
      "The supervisor's runtime behavior is centered around a periodic \"wake\" loop (`executeSupervisorWake` in `src/server/supervisor/wake.ts`), which instantiates the `Supervisor` class (`src/server/supervisor/index.ts`) and queries a Mastra-powered agent.",
      "",
      "### Existing Toolset Constraints",
      "As defined in `src/server/supervisor/tools.ts`, the supervisor's active toolset is strictly read-only or steering-oriented:",
      "*   **Reading/Inspection**: `read_file` (reads a complete file) and `inspect_repo` (executes safe, whitelisted, read-only commands).",
      "*   **Worker Steering**: `worker_spawn`, `worker_continue`, `worker_cancel`, `worker_approve`, `worker_deny`.",
      "*   **Lifecycle**: `ask_user`, `confirm_ready_to_implement`, `send_user_message`, `end_turn`, `wait_until`, `mark_complete`, `mark_failed`.",
      "*   **Durable Memory**: `memory_read`, `memory_write`, `memory_append`.",
      "",
      "### The Worker Delegation Flow",
      "When the supervisor needs to make an edit or verify a change, it must:",
      "1. Spawn a heavy CLI worker (e.g., Claude Code).",
      "2. Wait for the worker to boot, mount credentials, and execute.",
      "3. If the worker reports completion, the supervisor *must* spawn an independent \"Validator Worker\" to run the tests and verify behavior.",
      "4. Process the validator's report to determine if the run can be marked complete.",
      "",
      "---",
      "",
      "## 3. Key Limitations & Operational Pain Points",
      "",
      "1.  **The \"Single-Character Fix\" Tax (High Latency & Token Overhead)**",
      "    If a linter reports a missing import or a compiler reports a minor syntax error, the supervisor must coordinate a full worker turn to fix it.",
      "2.  **The \"Telephone Game\" of Test Verification**",
      "    Because the supervisor cannot execute commands like `npm test` or `cargo test` directly, it must trust worker output.",
      "3.  **Environment Jamming & Self-Remediation Gaps**",
      "    If a worker gets stuck due to a localized environment issue, the supervisor cannot execute recovery commands.",
      "",
      "---",
      "",
      "## 4. The Three-Tiered Empowerment Framework",
      "",
      "We recommend an incremental, backwards-compatible expansion of the supervisor’s toolset, categorized into three levels of empowerment:",
      "",
      "```",
      "┌────────────────────────────────────────────────────────────────────────┐",
      "│                      Supervisor Omni (Mastra Agent)                    │",
      "└────────────────────────────────────┬───────────────────────────────────┘",
      "                                     │",
      "         ┌───────────────────────────┼───────────────────────────┐",
      "         ▼                           ▼                           ▼",
      " ┌───────────────┐           ┌───────────────┐           ┌───────────────┐",
      " │    Tier 1     │           │    Tier 2     │           │    Tier 3     │",
      " │ Direct Edits  │           │ Direct Test   │           │ Hybrid Loop  │",
      " │ (Surgical)    │           │ (Verification)│           │ (Autonomy)    │",
      " └───────────────┘           └───────────────┘           └───────────────┘",
      "```",
      "",
      "### Tier 1: Direct Surgical Mutations (Filesystem Power)",
      "Equip the supervisor with tools that allow high-confidence, surgical workspace corrections without spawning an external CLI worker.",
      "",
      "*   **`replace_in_file` (Structured Editing)**:",
      "    *   *Description*: Search and replace exactly **one** occurrence of a specific code block in a file.",
      "    *   *Parameters*: `path`, `old_string`, `new_string`, `explanation`.",
      "    *   *Use Case*: Fixing minor compilation/linter issues, adding imports, or adjusting configuration parameters discovered during verification.",
      "*   **`write_file` (Targeted File Creation)**:",
      "    *   *Description*: Write the complete content of a file (typically small utility scripts, tests, or config files).",
      "    *   *Parameters*: `path`, `content`, `reason`.",
      "*   **`delete_file` / `remove_path` (Workspace Cleanup)**:",
      "    *   *Description*: Safely delete temporary files, build caches, or obsolete artifacts.",
      "    *   *Parameters*: `path`, `reason`.",
      "",
      "### Tier 2: Direct Execution & Verification (Local Command Power)",
      "Allow the supervisor to run non-interactive, verification-oriented shell scripts directly on the host machine.",
      "",
      "*   **`run_verification_command`**:",
      "    *   *Description*: Run a non-interactive build, lint, typecheck, or test script on the host.",
      "    *   *Parameters*: `command` (whitelisted e.g., `npm`, `pnpm`, `vitest`, `tsc`, `cargo`, `pytest`), `args`, `cwd`, `timeoutMs`.",
      "    *   *Why this is revolutionary*: The supervisor can run the test suite directly! If the tests pass, it can immediately call `mark_complete` without spawning a separate validation worker.",
      "",
      "### Tier 3: Hybrid Autonomy (Self-Implementation vs. Delegation Loop)",
      "Update the supervisor’s decision-making logic (`src/server/supervisor/prompts/supervisor.md` and `index.ts`) to choose between **Direct Intervention** and **Worker Delegation**:",
      "",
      "1.  **Complexity Assessment (Preflight Phase)**:",
      "    *   *Low Complexity* (e.g., \"Add a unit test for helper X\", \"Fix a lint warning in index.ts\"): The supervisor decides to **self-implement** using `replace_in_file`, runs `run_verification_command`, and finishes.",
      "    *   *High Complexity* (e.g., \"Implement a new OAuth authentication provider\"): The supervisor defaults to its traditional behavior, drafting a plan and spawning specialized workers.",
      "2.  **The \"Friction Handoff\" Protocol (Failover)**:",
      "    *   If the supervisor tries to self-implement but fails its own verification tests more than **3 times**, it must automatically package its work-in-progress, generate a git diff, stash its changes, and spawn an expert worker to resolve the bottleneck.",
      "",
      "---",
      "",
      "## 5. Proposed Code Modifications & Implementation Design",
      "",
      "Implementing these changes is highly straightforward due to the modular design of the supervisor.",
      "",
      "### A. Updating `src/server/supervisor/tools.ts`",
      "We can add the new tools to `buildSupervisorTools` under a new config option (`directControlEnabled`):",
      "",
      "```typescript",
      "// Proposed extension inside src/server/supervisor/tools.ts",
      "export function buildSupervisorTools(options?: {",
      "  allowedWorkerTypes?: string[];",
      "  preferredWorkerType?: string | null;",
      "  memoryEnabled?: boolean;",
      "  directControlEnabled?: boolean; // New Flag",
      "}) {",
      "  const baseTools = { ... };",
      "  ",
      "  const directControlTools = options?.directControlEnabled ? {",
      "    replace_in_file: createTool({",
      "      id: \"replace_in_file\",",
      "      description: \"Replace exact string matches within a file for surgical edits.\",",
      "      inputSchema: z.object({",
      "        path: z.string().describe(\"Path relative to the run project directory.\"),",
      "        old_string: z.string().describe(\"Exact substring to find.\"),",
      "        new_string: z.string().describe(\"Literal string to replace with.\"),",
      "        explanation: z.string().describe(\"Why this edit is being made.\")",
      "      }),",
      "      execute: queuedToolResult,",
      "    }),",
      "    run_verification_command: createTool({",
      "      id: \"run_verification_command\",",
      "      description: \"Run non-interactive test, lint, or build commands directly.\",",
      "      inputSchema: z.object({",
      "        command: z.enum([\"npm\", \"pnpm\", \"yarn\", \"cargo\", \"pytest\", \"tsc\", \"vitest\", \"eslint\"]),",
      "        args: z.array(z.string()),",
      "        cwd: z.string().optional(),",
      "      }),",
      "      execute: queuedToolResult,",
      "    })",
      "  } : {};",
      "",
      "  return Object.assign({}, baseTools, memoryTools, directControlTools);",
      "}",
      "```",
      "",
      "### B. Updating `src/server/supervisor/index.ts`",
      "We add execution blocks in the supervisor's main `run()` turn-step router:",
      "",
      "```typescript",
      "// Proposed handlers in src/server/supervisor/index.ts",
      "switch (action.name) {",
      "  case \"replace_in_file\": {",
      "    const relativePath = asString(action.args.path, \"path\");",
      "    const oldString = asString(action.args.old_string, \"old_string\");",
      "    const newString = asString(action.args.new_string, \"new_string\");",
      "    ",
      "    const run = await db.select().from(runs).where(eq(runs.id, this.runId)).get();",
      "    const absolutePath = path.resolve(run?.projectPath, relativePath);",
      "    ",
      "    // Perform surgical replace",
      "    const content = fs.readFileSync(absolutePath, \"utf8\");",
      "    if (!content.includes(oldString)) {",
      "      throw new Error(`Target string not found in ${relativePath}`);",
      "    }",
      "    const updatedContent = content.replace(oldString, newString);",
      "    fs.writeFileSync(absolutePath, updatedContent, \"utf8\");",
      "    ",
      "    await insertExecutionEvent(this.runId, \"supervisor_file_edited\", {",
      "      summary: `Supervisor surgically edited ${relativePath}.`,",
      "      path: relativePath,",
      "      explanation: action.args.explanation,",
      "    });",
      "    continue;",
      "  }",
      "  ",
      "  case \"run_verification_command\": {",
      "    const command = asString(action.args.command, \"command\");",
      "    const args = asStringArray(action.args.args, \"args\");",
      "    const run = await db.select().from(runs).where(eq(runs.id, this.runId)).get();",
      "    const cwd = path.resolve(run?.projectPath, asString(action.args.cwd ?? \"\", \"cwd\"));",
      "    ",
      "    // Execute process synchronously with timeout",
      "    const result = spawnSync(command, args, { cwd, timeout: 30000, encoding: 'utf8' });",
      "    ",
      "    await insertExecutionEvent(this.runId, \"supervisor_verification_executed\", {",
      "      summary: `Supervisor ran verification: ${command} ${args.join(\" \")}`,",
      "      exitCode: result.status,",
      "      stdout: result.stdout,",
      "      stderr: result.stderr,",
      "    });",
      "    continue;",
      "  }",
      "}",
      "```",
      "",
      "---",
      "",
      "## 6. Safety and Security Invariants",
      "",
      "Giving the supervisor write and execution permissions requires strict guardrails:",
      "",
      "1.  **Git Backup & Snapshot Invariant**:",
      "    Before executing *any* `replace_in_file` or `write_file` tool call, the runtime should verify if the git tree is clean, or create a temporary supervisor checkpoint branch/stash.",
      "2.  **YOLO Mode Gate**:",
      "    Direct-control actions should honor the workspace `YOLO` settings. If `YOLO_MODE_MUTATING` is false, the supervisor should generate the proposed change and pause, requesting user confirmation.",
      "3.  **Command Execution Isolation**:",
      "    The command whitelist should explicitly block any interactive prompts and terminate immediately upon receiving any input requests.",
      "",
      "---",
      "",
      "## 7. Recommendation Summary",
      "",
      "| Power Tier | Recommended Tool | Core Benefit | Complexity to Implement |",
      "| :--- | :--- | :--- | :--- |",
      "| **Tier 1 (Surgical Edits)** | `replace_in_file`, `write_file` | Bypasses worker spawning overhead for simple bug fixes/linters. | **Low** (Simple file read/write APIs). |",
      "| **Tier 2 (Direct Tests)** | `run_verification_command` | Speeds up validation; allows supervisor to verify code directly. | **Medium** (Process spawning and output capture). |",
      "| **Tier 3 (Hybrid Autonomy)**| Refined prompt/failover system | Integrates both modes natively, maximizing efficiency. | **Medium** (Prompt engineering and loop design). |",
      "",
      "### Conclusion",
      "By transitioning the Supervisor Omni from a **passive manager** to a **playing coach** that can make surgical adjustments and run tests directly, we dramatically compress task completion times, eliminate massive token overhead, and make the overall OmniHarness platform more resilient and autonomous.",
    ].join("\n");

    const tree = MarkdownContent({ content });
    expect(tree).toBeDefined();

    const tableNodes = findReactNodes(tree, (n) => n.type === "table");
    expect(tableNodes.length).toBe(1);

    const h3Nodes = findReactNodes(tree, (n) => n.type === "h3");
    expect(h3Nodes.length).toBe(8); // 8 h2/h3 level headers in this snippet

    const preNodes = findReactNodes(tree, (n) => n.type === "pre");
    expect(preNodes.length).toBe(3); // ASCII art + 2 code blocks
  });
});
