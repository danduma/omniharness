import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "dev.omniharness.app",
  appName: "OmniHarness",
  webDir: "../../dist/interface",
  server: {
    androidScheme: "https",
    iosScheme: "capacitor",
    allowNavigation: [],
  },
};

export default config;
