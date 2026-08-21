import { describe, expect, it } from "vitest";
import { redactHandoffText, sanitizeProjectRelativePath } from "@/server/handoff/redaction";

describe("handoff redaction", () => {
  it("redacts credentials, authorization headers, and environment assignments", () => {
    const input = [
      "Authorization: Bearer secret-token-value",
      "ANTHROPIC_API_KEY=sk-ant-api03-super-secret",
      "OPENAI_API_KEY=sk-proj-super-secret",
    ].join("\n");

    const result = redactHandoffText(input);

    expect(result).not.toContain("secret-token-value");
    expect(result).not.toContain("sk-ant-api03");
    expect(result).not.toContain("sk-proj");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts generic credentials, private keys, cookies, and machine-local paths", () => {
    const value = redactHandoffText([
      "DATABASE_URL=postgres://user:password@localhost/db",
      "NPM_TOKEN=secret-value",
      "Cookie: session=very-secret",
      "-----BEGIN PRIVATE KEY-----\nabc123\n-----END PRIVATE KEY-----",
      "/Users/alice/private/project/file.ts",
    ].join("\n"));
    expect(value).not.toContain("password");
    expect(value).not.toContain("secret-value");
    expect(value).not.toContain("very-secret");
    expect(value).not.toContain("abc123");
    expect(value).not.toContain("alice");
    expect(value).toContain("[REDACTED]");
    expect(value).toContain("[REDACTED_PATH]");
  });

  it("removes control characters and bounds output", () => {
    const result = redactHandoffText(`ok\u0000${"x".repeat(100)}`, 20);
    expect(result).toBe("okxxxxxxxxxxxxxxxxxx");
  });

  it("keeps only normalized project-relative paths", () => {
    expect(sanitizeProjectRelativePath("./src/../src/app.ts")).toBe("src/app.ts");
    expect(sanitizeProjectRelativePath("/Users/person/project/.env")).toBeNull();
    expect(sanitizeProjectRelativePath("../../secret.txt")).toBeNull();
  });
});
