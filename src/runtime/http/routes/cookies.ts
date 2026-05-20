import { AUTH_SESSION_COOKIE } from "@/server/auth/config";

export function setSessionCookie(response: Response, tokenValue: string, expires: Date) {
  response.headers.append(
    "set-cookie",
    `${AUTH_SESSION_COOKIE}=${tokenValue}; Expires=${expires.toUTCString()}; HttpOnly; SameSite=Lax; Path=/`
      + (process.env.NODE_ENV === "production" ? "; Secure" : ""),
  );
}

export function clearSessionCookie(response: Response) {
  response.headers.append(
    "set-cookie",
    `${AUTH_SESSION_COOKIE}=; Expires=${new Date(0).toUTCString()}; HttpOnly; SameSite=Lax; Path=/`
      + (process.env.NODE_ENV === "production" ? "; Secure" : ""),
  );
}
