import { adaptOmniHandlerToNext } from "@/runtime/http/adapters/next";
import { handleAccountDetailRequest } from "@/runtime/http/routes/accounts";

export const dynamic = "force-dynamic";

export const PATCH = adaptOmniHandlerToNext(handleAccountDetailRequest, { surface: "web" });
