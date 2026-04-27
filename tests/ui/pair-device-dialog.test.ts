import fs from "fs";
import path from "path";
import { test, expect } from "vitest";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/PairDeviceDialog.tsx"),
  "utf8",
);

test("pair device dialog renders qr, copy-link, and refresh states", () => {
  expect(source).toContain("Connect phone");
  expect(source).toContain("QRCode.toDataURL");
  expect(source).toContain("availabilityError");
  expect(source).toContain("{availabilityError}");
  expect(source).not.toContain("Device label");
  expect(source).toContain("Secure pairing");
  expect(source).toContain("Scan window");
  expect(source).toContain("Copy link");
  expect(source).toContain("Refresh code");
  expect(source).toContain('pairingStatus === "redeemed"');
});
