import fs from "fs";
import path from "path";
import { test, expect } from "vitest";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/PairDeviceDialog.tsx"),
  "utf8",
);

test("pair device dialog renders qr, copy-link, and refresh states", () => {
  expect(source).toContain("Connect phone");
  expect(source).toContain("createLocalPairingDraft");
  expect(source).toContain("resolvePairingOrigin");
  expect(source).toContain("QRCode.toDataURL");
  expect(source).toContain("pairToken: draft.pairToken");
  expect(source).toContain("Phone pairing needs a public or LAN URL");
  expect(source).toContain("Activating code");
  expect(source).toContain("availabilityError");
  expect(source).toContain("{availabilityError}");
  expect(source).not.toContain("Device label");
  expect(source).toContain("Secure pairing");
  expect(source).toContain("Scan window");
  expect(source).toContain("Copy link");
  expect(source).toContain("Refresh code");
  expect(source).toContain('pairingStatus === "redeemed"');
});
