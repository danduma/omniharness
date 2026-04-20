import { describe, expect, it } from "vitest";
import { classifyPermissionRequest } from "@/server/permissions";

describe("classifyPermissionRequest", () => {
  it("approves routine file writes", () => {
    expect(classifyPermissionRequest("Create hello.txt and write the file contents")).toBe("approve");
  });

  it("escalates shell installs and network requests", () => {
    expect(classifyPermissionRequest("Run npm install and then fetch remote data")).toBe("escalate");
  });
});
