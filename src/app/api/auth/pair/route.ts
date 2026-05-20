import { adaptOmniHandlerToNext } from "@/runtime/http/adapters/next";
import { handleAuthPairRequest } from "@/runtime/http/routes/auth-pair";

export const GET = adaptOmniHandlerToNext(handleAuthPairRequest, { surface: "web" });
export const POST = adaptOmniHandlerToNext(handleAuthPairRequest, { surface: "web" });
