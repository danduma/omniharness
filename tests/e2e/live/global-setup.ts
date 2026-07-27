import { createLiveAuthState, resolveLiveAuthConfiguration } from "./auth";

export default async function globalSetup(): Promise<void> {
  await createLiveAuthState(resolveLiveAuthConfiguration(process.env));
}

