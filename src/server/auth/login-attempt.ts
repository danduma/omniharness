import { insertAuthEvent } from "@/server/auth/audit";
import { verifyConfiguredAuthPassword } from "@/server/auth/password";
import {
  getLoginRateLimitStatus,
  recordFailedLoginAttempt,
  recordSuccessfulLoginAttempt,
} from "@/server/auth/rate-limit";
import { getRequestNetworkIdentity } from "@/server/auth/trusted-proxy";

export type PasswordLoginAttemptResult =
  | {
      ok: true;
      ipAddress: string;
      userAgent: string | null;
    }
  | {
      ok: false;
      status: 401 | 429;
      message: string;
      retryAfterSeconds: number;
    };

export async function verifyPasswordLoginAttempt(args: {
  request: Request;
  password: string;
  purpose: "password_login" | "browser_authorization";
}): Promise<PasswordLoginAttemptResult> {
  const networkIdentity = getRequestNetworkIdentity(args.request);
  const ipAddress = networkIdentity.clientAddress;
  const userAgent = args.request.headers.get("user-agent") ?? null;
  const rateLimitStatus = getLoginRateLimitStatus(ipAddress);
  if (rateLimitStatus.locked) {
    await insertAuthEvent({
      eventType: "auth.login_rate_limited",
      details: {
        ipAddress,
        userAgent,
        purpose: args.purpose,
        retryAfterSeconds: rateLimitStatus.retryAfterSeconds,
      },
    });
    return {
      ok: false,
      status: 429,
      message: "Too many login attempts. Try again later.",
      retryAfterSeconds: rateLimitStatus.retryAfterSeconds,
    };
  }

  const valid = await verifyConfiguredAuthPassword(args.password);
  if (!valid) {
    recordFailedLoginAttempt(ipAddress);
    await insertAuthEvent({
      eventType: "auth.login_failed",
      details: {
        ipAddress,
        userAgent,
        purpose: args.purpose,
      },
    });
    return {
      ok: false,
      status: 401,
      message: "Incorrect password.",
      retryAfterSeconds: 0,
    };
  }

  recordSuccessfulLoginAttempt(ipAddress);
  return {
    ok: true,
    ipAddress,
    userAgent,
  };
}
