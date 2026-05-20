import { db } from "@/server/db";
import { accounts } from "@/server/db/schema";
import { requireApiSession } from "@/server/auth/guards";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { toNextRequest } from "./next-request";

export const handleAccountsRequest: OmniHttpHandler = async (request) => {
  const auth = await requireApiSession(toNextRequest(request), {
    source: "Accounts",
    action: "Load accounts",
  });
  if (auth.response) {
    return auth.response;
  }

  return Response.json(await db.select().from(accounts));
};
