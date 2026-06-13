import { db } from "@/server/db";
import { accounts } from "@/server/db/schema";
import { requireApiSession } from "@/server/auth/guards";
import { toAccountDto } from "@/server/accounts/dto";
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

  const rows = await db.select().from(accounts);
  return Response.json(rows.map(toAccountDto));
};
