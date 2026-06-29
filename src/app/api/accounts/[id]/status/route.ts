import { adaptOmniHandlerToNext } from "@/runtime/http/adapters/next";
import { handleAccountStatusRequest } from "@/runtime/http/routes/accounts";

export const dynamic = "force-dynamic";

export const POST = adaptOmniHandlerToNext(handleAccountStatusRequest, { surface: "web" });
