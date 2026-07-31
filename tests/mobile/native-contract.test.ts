import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("mobile native host contract", () => {
  it("keeps one explicit mobile workspace and one shared interface artifact", () => {
    expect(read("pnpm-workspace.yaml")).toContain('  - "apps/mobile"');
    expect(read("pnpm-workspace.yaml")).not.toContain('  - "apps/*"');
    expect(read("apps/mobile/capacitor.config.ts")).toContain(
      'webDir: "../../dist/interface"',
    );
  });

  it("uses strict release transport security with loopback-only debug exceptions", () => {
    const info = read("apps/mobile/ios/App/App/Info.plist");
    const iosDebug = read("apps/mobile/ios/debug.xcconfig");
    const manifest = read("apps/mobile/android/app/src/main/AndroidManifest.xml");
    const androidMain = read(
      "apps/mobile/android/app/src/main/res/xml/network_security_config.xml",
    );
    const androidDebug = read(
      "apps/mobile/android/app/src/debug/res/xml/network_security_config.xml",
    );

    expect(info).toContain("NSLocalNetworkUsageDescription");
    expect(info).toContain("NSAllowsArbitraryLoads");
    expect(info).toContain("<false/>");
    expect(iosDebug).toContain("OMNI_LOOPBACK_HTTP_ALLOWED = YES");
    expect(manifest).toContain('android:usesCleartextTraffic="false"');
    expect(manifest).toContain('@xml/network_security_config');
    expect(androidMain).toContain('cleartextTrafficPermitted="false"');
    expect(androidDebug).toContain('cleartextTrafficPermitted="true"');
    expect(androidDebug).toContain('localhost');
    expect(androidDebug).toContain('127.0.0.1');
    expect(androidDebug).not.toContain('includeSubdomains="true"');
  });

  it("implements the same secure native bridge on iOS and Android", () => {
    const ios = read(
      "apps/mobile/ios/App/App/OmniNativeRuntimePlugin.swift",
    );
    const android = read(
      "apps/mobile/android/app/src/main/java/dev/omniharness/app/OmniNativeRuntimePlugin.java",
    );

    expect(ios).toContain("URLSession");
    expect(ios).toContain("SecItemAdd");
    expect(ios).toContain("SecTrustEvaluateWithError");
    expect(ios).toContain("SecCertificateCopyKey");
    expect(ios).toContain("maxQueuedFrames");
    expect(ios).toContain("Last-Event-ID");
    expect(ios).toContain("UIApplication.didEnterBackgroundNotification");
    expect(ios).toContain("UNUserNotificationCenter");

    expect(android).toContain("okhttp3.OkHttpClient");
    expect(android).toContain("AndroidKeyStore");
    expect(android).toContain("AES/GCM/NoPadding");
    expect(android).toContain("CertificatePinner");
    expect(android).toContain("MAX_QUEUED_FRAMES");
    expect(android).toContain("Last-Event-ID");
    expect(android).toContain("handleOnPause");
    expect(android).toContain("NotificationManager");
  });

  it("registers native plugins and never puts a bearer token in the WebView contract", () => {
    expect(read("apps/mobile/ios/App/App.xcodeproj/project.pbxproj")).toContain(
      "OmniNativeRuntimePlugin.swift in Sources",
    );
    expect(read("apps/mobile/android/app/src/main/java/dev/omniharness/app/MainActivity.java"))
      .toContain("registerPlugin(OmniNativeRuntimePlugin.class)");
    const adapter = read("src/runtime-api/capacitor.ts");
    const contract = read("apps/mobile/src/native-contract.ts");
    const mobilePackage = read("apps/mobile/package.json");
    expect(adapter).not.toMatch(/bearerToken/);
    expect(adapter).not.toMatch(/Authorization/);
    expect(contract).toContain("validateMobileRuntimeTarget");
    expect(contract).toContain("maxQueuedFrames: 256");
    expect(read("apps/interface/index.html")).not.toContain("connect-src 'self'");
    expect(read("apps/interface/app-shell.html")).not.toContain("connect-src 'self'");
    expect(mobilePackage).toContain("lock-native-csp.mjs");
    expect(read("apps/mobile/ios/App/App/public/index.html")).toContain(
      "connect-src 'self'",
    );
    expect(read("apps/mobile/android/app/src/main/assets/public/index.html")).toContain(
      "connect-src 'self'",
    );
  });
});
