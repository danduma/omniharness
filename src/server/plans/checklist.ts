import { randomUUID } from "crypto";
import { db } from "../db";
import { planItems } from "../db/schema";
import { eq } from "drizzle-orm";
import type { ParsedPlanItem } from "./parser";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function planItemId(planId: string, item: ParsedPlanItem) {
  return `${planId}:${item.sourceLine}:${slugify(item.title) || randomUUID()}`;
}

export async function syncPlanItems(planId: string, items: ParsedPlanItem[]) {
  for (const item of items) {
    const id = planItemId(planId, item);
    const existing = await db.select().from(planItems).where(eq(planItems.id, id)).get();

    if (!existing) {
      await db.insert(planItems).values({
        id,
        planId,
        phase: item.phase,
        title: item.title,
        status: "pending",
        sourceLine: item.sourceLine,
        dependsOn: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      continue;
    }

    await db
      .update(planItems)
      .set({
        planId,
        phase: item.phase,
        title: item.title,
        sourceLine: item.sourceLine,
        updatedAt: new Date(),
      })
      .where(eq(planItems.id, id));
  }
}

export async function getPlanItems(planId: string) {
  return db.select().from(planItems).where(eq(planItems.planId, planId));
}
