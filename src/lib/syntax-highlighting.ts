import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import go from "highlight.js/lib/languages/go";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import swift from "highlight.js/lib/languages/swift";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  bash: "bash",
  cjs: "javascript",
  css: "css",
  diff: "diff",
  go: "go",
  htm: "xml",
  html: "xml",
  js: "javascript",
  json: "json",
  jsx: "jsx",
  mjs: "javascript",
  md: "markdown",
  mdx: "markdown",
  py: "python",
  rs: "rust",
  sh: "bash",
  sql: "sql",
  swift: "swift",
  ts: "ts",
  tsx: "tsx",
  txt: "plaintext",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
};

const LANGUAGE_BY_BASENAME: Record<string, string> = {
  ".env": "bash",
  Dockerfile: "bash",
  Makefile: "bash",
};

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("css", css);
hljs.registerLanguage("diff", diff);
hljs.registerLanguage("go", go);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("python", python);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("swift", swift);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("yaml", yaml);
hljs.registerAliases(["js", "jsx"], { languageName: "javascript" });
hljs.registerAliases(["ts", "tsx"], { languageName: "typescript" });
hljs.registerAliases(["html", "htm"], { languageName: "xml" });
hljs.registerAliases(["yml"], { languageName: "yaml" });
hljs.configure({ ignoreUnescapedHTML: true });

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function detectSyntaxLanguage(relativePath: string) {
  const normalized = relativePath.trim().replace(/\\/g, "/");
  const basename = normalized.split("/").filter(Boolean).at(-1) ?? normalized;
  const basenameLanguage = LANGUAGE_BY_BASENAME[basename];
  if (basenameLanguage) {
    return basenameLanguage;
  }

  const extension = basename.includes(".")
    ? basename.split(".").at(-1)?.toLowerCase()
    : "";

  return extension ? LANGUAGE_BY_EXTENSION[extension] ?? null : null;
}

export function highlightCodeLine(line: string, language: string | null | undefined) {
  const source = line || " ";
  if (!language || language === "plaintext" || !hljs.getLanguage(language)) {
    return escapeHtml(source);
  }

  try {
    return hljs.highlight(source, { language, ignoreIllegals: true }).value;
  } catch {
    return escapeHtml(source);
  }
}
