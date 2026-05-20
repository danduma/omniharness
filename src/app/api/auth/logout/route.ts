import { adaptOmniHandlerToNext } from "@/runtime/http/adapters/next";
import { handleAuthLogoutRequest } from "@/runtime/http/routes/auth-logout";

export const POST = adaptOmniHandlerToNext(handleAuthLogoutRequest, { surface: "web" });
