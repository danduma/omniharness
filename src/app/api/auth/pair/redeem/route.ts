import { adaptOmniHandlerToNext } from "@/runtime/http/adapters/next";
import { handleAuthPairRedeemRequest } from "@/runtime/http/routes/auth-pair-redeem";

export const POST = adaptOmniHandlerToNext(handleAuthPairRedeemRequest, { surface: "web" });
