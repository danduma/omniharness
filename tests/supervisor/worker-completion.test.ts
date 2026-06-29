import { describe, expect, it } from "vitest";
import { isLongWorkerCompletionText, workerTurnRecheckDelayMs } from "@/server/supervisor/worker-completion";

describe("worker completion heuristics", () => {
  it("does not treat long future-tense progress chatter as completion", () => {
    const progressText = [
      "I will begin by initializing our narrative topic and reading the launch plan.",
      "I will search the project directory for files using glob patterns to locate the database, migrations, source code, and configuration files.",
      "I will list the directory structure and files in the customer's repository to see what source files and strategies we can leverage or build upon.",
      "I will run a shell command to list the contents of the repository to verify what files are available for extraction and reference.",
      "I will inspect package files, migrations, and test directories before deciding where implementation work belongs.",
      "I will continue gathering context before making edits so the next action uses the correct project root.",
    ].join(" ");

    expect(progressText.length).toBeGreaterThan(600);
    expect(isLongWorkerCompletionText(progressText)).toBe(false);
    expect(workerTurnRecheckDelayMs({
      responseText: progressText,
      defaultDelayMs: 5_000,
    })).toBe(5_000);
  });

  it("does not treat architecture feedback requests as completion", () => {
    const feedbackRequest = [
      "### Key Requirements & Architectural Overview",
      "We are building the complete growth control plane from scratch, focusing on backend, CLI operations, and data verification.",
      "Option A uses an in-process Bun and Drizzle task runner. This option is simple, solid, and makes tests and verification extremely reliable.",
      "Option B uses a decoupled outbox and worker pattern. This approach is more scalable but requires more operational machinery.",
      "Both options support the current plan, but they make different tradeoffs for database structure, privacy hashing, and ledger constraints.",
      "Which option do you prefer, or do you have any specific changes to the database structure, privacy hashing, or ledger constraints you'd like to adjust?",
      "Once you confirm, I will proceed to draft the detailed implementation plan in our temporary directory and present it for your feedback.",
    ].join(" ");

    expect(feedbackRequest.length).toBeGreaterThan(600);
    expect(isLongWorkerCompletionText(feedbackRequest)).toBe(false);
  });

  it("does not treat active implementation plans as completion even when they mention verification", () => {
    const activePlanText = [
      "I will create the connection probe script without using backticks to avoid trigger security filters, then run it.",
      "I will run a command to create the database in our active PostgreSQL server so that our project has its own dedicated database.",
      "I will check if there is an existing API key defined in the shell environment.",
      "I will create the local environment file using the database and key parameters we just verified.",
      "I will write the database schema file and migration runner next.",
      "I will run typecheck and build verification after the files are written.",
      "I will continue implementing repositories, privacy utilities, and tests until the checklist is complete.",
    ].join(" ");

    expect(activePlanText.length).toBeGreaterThan(600);
    expect(isLongWorkerCompletionText(activePlanText)).toBe(false);
  });

  it("recognizes long completion summaries with verification evidence", () => {
    const completionText = [
      "Implemented the recovery fix and verified the focused tests.",
      "",
      "Summary:",
      "- Added API key account resolution from hydrated runtime settings.",
      "- Skipped unusable automatic API-key account rows.",
      "- Recovered the run through the manual recovery path.",
      "- Normalized legacy project memory paths.",
      "",
      "Verification:",
      "- Account resolver tests passed.",
      "- Account allocator tests passed.",
      "- Supervisor observer tests passed.",
      "- Memory path tests passed.",
      "- Memory tool tests passed.",
      "- The recovered worker has a live bridge session with no last error.",
      "- The run no longer reports the saved API-key failure.",
      "- The supervisor can now continue from the recovered state without misclassifying credential, memory, or observer recovery as unfinished setup work.",
    ].join("\n");

    expect(completionText.length).toBeGreaterThan(600);
    expect(isLongWorkerCompletionText(completionText)).toBe(true);
    expect(workerTurnRecheckDelayMs({
      responseText: completionText,
      defaultDelayMs: 5_000,
    })).toBe(0);
  });
});
