import { test, expect, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import { unlockApp } from "./helpers";

const generatedFiles = ["hello.txt", "hi.txt", "greetings.txt"];
const generatedDirs = ["tests/vibes"];

type E2ERunRecord = {
  id: string;
  title?: string | null;
  status?: string | null;
};

type E2EClarificationRecord = {
  id: string;
  runId: string;
  status: string;
};

async function readSnapshot(page: Page, runId?: string): Promise<{ runs: E2ERunRecord[]; clarifications: E2EClarificationRecord[] }> {
  const query = runId
    ? `/api/events?snapshot=1&persisted=1&runId=${encodeURIComponent(runId)}`
    : "/api/events?snapshot=1&persisted=1";
  const response = await page.request.get(query);
  expect(response.ok()).toBe(true);
  const payload = await response.json() as { runs?: E2ERunRecord[]; clarifications?: E2EClarificationRecord[] };
  return {
    runs: payload.runs ?? [],
    clarifications: payload.clarifications ?? [],
  };
}

async function readRuns(page: Page): Promise<E2ERunRecord[]> {
  return (await readSnapshot(page)).runs;
}

function cleanupGeneratedFiles() {
  for (const file of generatedFiles) {
    try {
      fs.rmSync(path.resolve(process.cwd(), file));
    } catch {
      // ignore missing files
    }
  }
  for (const dir of generatedDirs) {
    try {
      fs.rmSync(path.resolve(process.cwd(), dir), { recursive: true, force: true });
    } catch {
      // ignore missing directories
    }
  }
}

test.afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 5000));
  cleanupGeneratedFiles();
});

test("run pauses for clarifications then completes after validation", async ({ page }) => {
  test.setTimeout(300000);
  cleanupGeneratedFiles();

  await unlockApp(page);
  const createResponse = await page.request.post("/api/conversations", {
    data: {
      mode: "implementation",
      command: "vibes/test-plan.md",
      projectPath: process.cwd(),
      preferredWorkerType: "codex",
      allowedWorkerTypes: ["codex"],
    },
  });
  expect(createResponse.ok()).toBe(true);
  const created = await createResponse.json() as { runId: string };
  const createdRunId = created.runId;

  let createdRunStatus: string | null = null;
  await expect.poll(async () => {
    const createdRun = (await readRuns(page)).find((run) => run.id === createdRunId);
    createdRunStatus = createdRun?.status ?? createdRunStatus;
    return createdRun?.status ?? null;
  }, { timeout: 120000 }).toMatch(/^(awaiting_user|running|done)$/);

  const answerClarification = async () => {
    const snapshot = await readSnapshot(page, createdRunId);
    const clarification = snapshot.clarifications.find((item) => item.runId === createdRunId && item.status === "pending");
    expect(clarification?.id).toBeTruthy();
    const answerResponse = await page.request.post(`/api/runs/${createdRunId}/answer`, {
      data: { clarificationId: clarification!.id, answer: "Confirmed, proceed." },
    });
    expect(answerResponse.ok()).toBe(true);
  };

  if (createdRunStatus === "awaiting_user") {
    await answerClarification();
  }

  let answeredDeferredClarification = createdRunStatus === "awaiting_user";
  await expect.poll(async () => {
    const createdRun = (await readRuns(page)).find((run) => run.id === createdRunId);
    if (createdRun?.status === "awaiting_user" && !answeredDeferredClarification) {
      answeredDeferredClarification = true;
      await answerClarification();
    }
    return (
      fs.existsSync(path.resolve(process.cwd(), "hello.txt"))
      && fs.existsSync(path.resolve(process.cwd(), "hi.txt"))
      && fs.existsSync(path.resolve(process.cwd(), "greetings.txt"))
    );
  }, { timeout: 240000 }).toBe(true);


  expect(fs.readFileSync(path.resolve(process.cwd(), "hello.txt"), "utf8").trim()).toBe("Hello World");
  expect(fs.readFileSync(path.resolve(process.cwd(), "hi.txt"), "utf8").trim()).toBe("Hi World");
  expect(fs.readFileSync(path.resolve(process.cwd(), "greetings.txt"), "utf8").trim()).toBe("Greetings");

  await expect.poll(async () => {
    const createdRun = (await readRuns(page)).find((run) => run.id === createdRunId);
    return createdRun?.status ?? null;
  }, { timeout: 240000 }).toBe("done");

  cleanupGeneratedFiles();
});
