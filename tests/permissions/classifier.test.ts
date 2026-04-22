import { describe, expect, it } from "vitest";
import { classifyPermissionRequest } from "@/server/permissions";

describe("classifyPermissionRequest", () => {
  it("approves routine file writes", () => {
    expect(classifyPermissionRequest("Create hello.txt and write the file contents")).toBe("approve");
  });

  it("approves routine local read-only inspection commands", () => {
    expect(
      classifyPermissionRequest(
        'Permission requested: execute command `cat /tmp/package.json | python3 -c "import sys,json; print(json.load(sys.stdin))"`',
      ),
    ).toBe("approve");
  });

  it("escalates shell installs and network requests", () => {
    expect(classifyPermissionRequest("Run npm install and then fetch remote data")).toBe("escalate");
  });
});
