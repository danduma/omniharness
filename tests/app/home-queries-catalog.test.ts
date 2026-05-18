import { describe, expect, it } from "vitest";
import { shouldEnableWorkerCatalogQuery } from "@/app/home/useHomeQueries";

describe("shouldEnableWorkerCatalogQuery", () => {
  it("does not load worker catalog just because the app is unlocked", () => {
    expect(shouldEnableWorkerCatalogQuery({
      appUnlocked: true,
      loadWorkerCatalog: false,
    })).toBe(false);
  });

  it("loads worker catalog only for explicit catalog surfaces", () => {
    expect(shouldEnableWorkerCatalogQuery({
      appUnlocked: true,
      loadWorkerCatalog: true,
    })).toBe(true);
  });

  it("stays disabled while auth is locked", () => {
    expect(shouldEnableWorkerCatalogQuery({
      appUnlocked: false,
      loadWorkerCatalog: true,
    })).toBe(false);
  });
});
