import { randomUUID } from "crypto";
import { db } from "../db";
import { clarifications } from "../db/schema";
import { eq } from "drizzle-orm";

export async function createClarifications(runId: string, questions: string[]) {
  const records = [];

  for (const question of questions) {
    const id = randomUUID();
    const record = {
      id,
      runId,
      question,
      answer: null,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as const;
    await db.insert(clarifications).values(record);
    records.push(record);
  }

  return records;
}

export async function listClarifications(runId: string) {
  return db.select().from(clarifications).where(eq(clarifications.runId, runId));
}

export async function answerClarification(clarificationId: string, answer: string) {
  await db
    .update(clarifications)
    .set({
      answer,
      status: "answered",
      updatedAt: new Date(),
    })
    .where(eq(clarifications.id, clarificationId));
}
