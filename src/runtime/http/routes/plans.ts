import { desc } from "drizzle-orm";
import { db } from "@/server/db";
import { plans } from "@/server/db/schema";
import { requireApiSession } from "@/server/auth/guards";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { toNextRequest } from "./next-request";

export const handlePlansRequest: OmniHttpHandler = async (request) => {
  if (request.method !== "GET") {
    return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
      status: 405,
      headers: { allow: "GET" },
    });
  }

  const auth = await requireApiSession(toNextRequest(request), {
    source: "Plans",
    action: "Load plans",
  });
  if (auth.response) {
    return auth.response;
  }

  const allPlans = await db.select().from(plans).orderBy(desc(plans.createdAt));
  return Response.json(allPlans);
};
