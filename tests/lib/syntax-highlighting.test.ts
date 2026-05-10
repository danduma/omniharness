import { describe, expect, it } from "vitest";
import { detectSyntaxLanguage, highlightCodeLine } from "@/lib/syntax-highlighting";

describe("syntax highlighting", () => {
  it("detects common code and markup languages from project file paths", () => {
    expect(detectSyntaxLanguage("src/components/home/FileViewerPanel.tsx")).toBe("tsx");
    expect(detectSyntaxLanguage("app/template.html")).toBe("xml");
    expect(detectSyntaxLanguage("styles/app.css")).toBe("css");
    expect(detectSyntaxLanguage("package.json")).toBe("json");
    expect(detectSyntaxLanguage("README.md")).toBe("markdown");
  });

  it("adds token spans for code lines", () => {
    const html = highlightCodeLine("const answer = 42;", "ts");

    expect(html).toContain("hljs-keyword");
    expect(html).toContain("const");
    expect(html).toContain("answer");
  });

  it("highlights HTML without rendering raw tags", () => {
    const html = highlightCodeLine("<section class=\"hero\">Hello</section>", "xml");

    expect(html).toContain("hljs-tag");
    expect(html).toContain("&lt;");
    expect(html).not.toContain("<section");
  });
});
