import { removeLiveAuthState } from "./auth";

export default function globalTeardown(): void {
  if (process.env.OMNIHARNESS_LIVE_E2E_AUTHENTICATED !== "1") {
    removeLiveAuthState();
  }
}
