import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("direct generated content ownership", () => {
  it("passes the primary worker id to the direct conversation Terminal", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/home/ConversationMain.tsx"),
      "utf8",
    );

    expect(source).toContain("workerId={primaryConversationWorkerId ?? undefined}");
  });
});
