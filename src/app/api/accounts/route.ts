import { adaptOmniHandlerToNext } from "@/runtime/http/adapters/next";
import { handleAccountsRequest } from "@/runtime/http/routes/accounts";

export const dynamic = "force-dynamic";

export const GET = adaptOmniHandlerToNext(handleAccountsRequest, { surface: "web" });
