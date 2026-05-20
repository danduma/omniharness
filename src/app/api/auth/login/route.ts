import { adaptOmniHandlerToNext } from "@/runtime/http/adapters/next";
import { handleAuthLoginRequest } from "@/runtime/http/routes/auth-login";

export const POST = adaptOmniHandlerToNext(handleAuthLoginRequest, { surface: "web" });
