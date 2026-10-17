import { AUTH_SESSION_COOKIE } from "@/server/auth/config";
import { getRequestNetworkIdentity } from "@/server/auth/trusted-proxy";

// Browsers drop Secure cookies set over plain HTTP, so only mark the cookie
// Secure when the request actually arrived over HTTPS.
function secureAttribute(request: Request) {
  return getRequestNetworkIdentity(request).protocol === "https" ? "; Secure" : "";
}

export function setSessionCookie(request: Request, response: Response, tokenValue: string, expires: Date) {
  response.headers.append(
    "set-cookie",
    `${AUTH_SESSION_COOKIE}=${tokenValue}; Expires=${expires.toUTCString()}; HttpOnly; SameSite=Lax; Path=/`
      + secureAttribute(request),
  );
}

export function clearSessionCookie(request: Request, response: Response) {
  response.headers.append(
    "set-cookie",
    `${AUTH_SESSION_COOKIE}=; Expires=${new Date(0).toUTCString()}; HttpOnly; SameSite=Lax; Path=/`
      + secureAttribute(request),
  );
}
