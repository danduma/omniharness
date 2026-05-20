import { adaptOmniHandlerToNext } from "@/runtime/http/adapters/next";
import { handleCodexAuthStatusRequest } from "@/runtime/http/routes/codex-auth-status";

export const GET = adaptOmniHandlerToNext(handleCodexAuthStatusRequest, { surface: "web" });
