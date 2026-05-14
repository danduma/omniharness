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

async function readRuns(page: Page): Promise<E2ERunRecord[]> {
  const response = await page.request.get("/api/events?snapshot=1&persisted=1");
  expect(response.ok()).toBe(true);
  const payload = await response.json() as { runs?: E2ERunRecord[] };
  return payload.runs ?? [];
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
  test.setTimeout(180000);
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

  if (createdRunStatus === "awaiting_user") {
    const answerResponse = await page.request.post(`/api/conversations/${createdRunId}/messages`, {
      data: { content: "Confirmed, proceed." },
    });
    expect(answerResponse.ok()).toBe(true);
  }

  await expect.poll(() => (
    fs.existsSync(path.resolve(process.cwd(), "hello.txt"))
    && fs.existsSync(path.resolve(process.cwd(), "hi.txt"))
    && fs.existsSync(path.resolve(process.cwd(), "greetings.txt"))
  ), { timeout: 120000 }).toBe(true);

  expect(fs.readFileSync(path.resolve(process.cwd(), "hello.txt"), "utf8").trim()).toBe("Hello World");
  expect(fs.readFileSync(path.resolve(process.cwd(), "hi.txt"), "utf8").trim()).toBe("Hi World");
  expect(fs.readFileSync(path.resolve(process.cwd(), "greetings.txt"), "utf8").trim()).toBe("Greetings");

  await expect.poll(() => (
    fs.existsSync(path.resolve(process.cwd(), "tests/vibes/test-plan.test.ts"))
  ), { timeout: 120000 }).toBe(true);

  await expect.poll(async () => {
    const createdRun = (await readRuns(page)).find((run) => run.id === createdRunId);
    return createdRun?.status ?? null;
  }, { timeout: 120000 }).toBe("done");

  cleanupGeneratedFiles();
});
