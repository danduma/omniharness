import { randomBytes, randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  conversationReadMarkers,
  executionEvents,
  messages,
  plans,
  processSessions,
  queuedConversationMessages,
  recoveryIncidents,
  runs,
  workerCredentialAllocations,
  workers,
} from "@/server/db/schema";
import { annotateVerifiedDeadCredential } from "@/lib/provider-account-failures";
import { unlockApp } from "./helpers";

const REVOKED = "Internal error: Failed to authenticate. API Error: 401 OAuth access token has been revoked.";

test("a revoked Claude credential opens the in-app sign-in operation", async ({ page }) => {
  const runId = randomBytes(6).toString("hex");
  const planId = randomUUID();
  const workerId = `${runId}-worker-1`;
  const accountId = `claude-e2e-${runId}`;
  const now = new Date();

  const cleanup = async () => {
    await db.delete(executionEvents).where(eq(executionEvents.runId, runId));
    await db.delete(recoveryIncidents).where(eq(recoveryIncidents.runId, runId));
    await db.delete(queuedConversationMessages).where(eq(queuedConversationMessages.runId, runId));
    await db.delete(messages).where(eq(messages.runId, runId));
    await db.delete(processSessions).where(eq(processSessions.runId, runId));
    await db.delete(workerCredentialAllocations).where(eq(workerCredentialAllocations.runId, runId));
    await db.delete(workers).where(eq(workers.runId, runId));
    await db.delete(conversationReadMarkers).where(eq(conversationReadMarkers.runId, runId));
    await db.delete(runs).where(eq(runs.id, runId));
    await db.delete(plans).where(eq(plans.id, planId));
  };

  try {
    await db.insert(plans).values({
      id: planId,
      path: `vibes/e2e/credential-reauth-${runId}.md`,
      status: "failed",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "failed",
      title: "Revoked Claude credential",
      preferredWorkerType: "claude",
      lastError: annotateVerifiedDeadCredential(REVOKED, accountId),
      failedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "error",
      cwd: process.cwd(),
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: REVOKED,
      lastText: REVOKED,
      lastError: REVOKED,
      workerNumber: 1,
      createdAt: now,
      updatedAt: now,
    });

    let authOperationRequested = false;
    await page.route(`**/api/accounts/${accountId}/auth-operation`, async (route) => {
      authOperationRequested = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          account: { id: accountId, status: "authenticating" },
          operation: {
            id: `operation-${runId}`,
            accountId,
            phase: "authenticating",
            startedAt: now.toISOString(),
            deadlineAt: new Date(now.getTime() + 10 * 60_000).toISOString(),
            error: null,
            terminal: null,
          },
        }),
      });
    });

    await unlockApp(page, `/session/${runId}`);

    await expect(page.getByText("The provider rejected the credentials", { exact: false })).toBeVisible();
    await expect(page.getByText("inside OmniHarness", { exact: false })).toBeVisible();
    await expect(page.getByText("Send a message to reconnect", { exact: false })).toHaveCount(0);

    await page.getByRole("button", { name: "Sign in again" }).click();

    await expect(page.getByRole("dialog", { name: "Sign in to Claude" })).toBeVisible();
    await expect(page.getByText("Waiting for Claude sign-in", { exact: true })).toBeVisible();
    expect(authOperationRequested).toBe(true);
  } finally {
    await cleanup();
  }
});
