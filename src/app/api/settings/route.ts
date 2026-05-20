import { adaptOmniHandlerToNext } from "@/runtime/http/adapters/next";
import { handleSettingsRequest } from "@/runtime/http/routes/settings";

export const GET = adaptOmniHandlerToNext(handleSettingsRequest, { surface: "web" });
export const POST = adaptOmniHandlerToNext(handleSettingsRequest, { surface: "web" });
