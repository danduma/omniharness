import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { plans, runs, clarifications } from "@/server/db/schema";
import { POST } from "@/app/api/runs/[id]/answer/route";

describe("POST /api/runs/[id]/answer", () => {
  it("stores the answer, marks the clarification answered, and resumes the run", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const clarificationId = randomUUID();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/test-plan.md",
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      status: "awaiting_user",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(clarifications).values({
      id: clarificationId,
      runId,
      question: "What should be implemented?",
      answer: null,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = new NextRequest(`http://localhost/api/runs/${runId}/answer`, {
      method: "POST",
      body: JSON.stringify({
        clarificationId,
        answer: "Implement the onboarding flow and add tests.",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: runId }) });
    expect(response.status).toBe(200);

    const updatedClarification = await db.select().from(clarifications).where(eq(clarifications.id, clarificationId)).get();
    const updatedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();

    expect(updatedClarification?.answer).toBe("Implement the onboarding flow and add tests.");
    expect(updatedClarification?.status).toBe("answered");
    expect(updatedRun?.status).toBe("running");
  });
});
