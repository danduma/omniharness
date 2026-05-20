import { adaptOmniHandlerToNext } from "@/runtime/http/adapters/next";
import { handleAuthSessionRequest } from "@/runtime/http/routes/auth-session";

export const GET = adaptOmniHandlerToNext(handleAuthSessionRequest, { surface: "web" });
export const DELETE = adaptOmniHandlerToNext(handleAuthSessionRequest, { surface: "web" });
