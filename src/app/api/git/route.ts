import { adaptOmniHandlerToNext } from "@/runtime/http/adapters/next";
import { handleGitRequest } from "@/runtime/http/routes/git";

export const POST = adaptOmniHandlerToNext(handleGitRequest, { surface: "web" });
