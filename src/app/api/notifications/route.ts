import { adaptOmniHandlerToNext } from "@/runtime/http/adapters/next";
import { handleNotificationsRequest } from "@/runtime/http/routes/notifications";

export const GET = adaptOmniHandlerToNext(handleNotificationsRequest, { surface: "web" });
export const POST = adaptOmniHandlerToNext(handleNotificationsRequest, { surface: "web" });
export const DELETE = adaptOmniHandlerToNext(handleNotificationsRequest, { surface: "web" });
