import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { messages, plans, runs, accounts, workers, clarifications, validationRuns, executionEvents } from "@/server/db/schema";
import { BRIDGE_URL } from "@/server/bridge-client";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sendEvent = (event: string, data: any) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch (_e) {
          // Stream might be closed
        }
      };

      let isClosed = false;
      req.signal.addEventListener("abort", () => {
        isClosed = true;
      });

      while (!isClosed) {
        try {
          // Fetch data
          const msgs = await db.select().from(messages).orderBy(messages.createdAt);
          const allPlans = await db.select().from(plans).orderBy(desc(plans.createdAt));
          const allRuns = await db.select().from(runs).orderBy(desc(runs.createdAt));
          const allAccounts = await db.select().from(accounts);
          const allWorkers = await db.select().from(workers);
          const allClarifications = await db.select().from(clarifications).orderBy(desc(clarifications.createdAt));
          const allValidationRuns = await db.select().from(validationRuns).orderBy(desc(validationRuns.createdAt));
          const allExecutionEvents = await db.select().from(executionEvents).orderBy(desc(executionEvents.createdAt));
          
          let agentsData = [];
          try {
            const res = await fetch(`${BRIDGE_URL}/agents`);
            if (res.ok) agentsData = await res.json();
          } catch (_e) {
            // bridge might be down
          }

          sendEvent("update", {
            messages: msgs,
            plans: allPlans,
            runs: allRuns,
            accounts: allAccounts,
            agents: agentsData,
            workers: allWorkers,
            clarifications: allClarifications,
            validationRuns: allValidationRuns,
            executionEvents: allExecutionEvents,
          });
        } catch (e) {
          console.error("SSE Poll Error", e);
        }

        // Wait before next poll
        if (!isClosed) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
