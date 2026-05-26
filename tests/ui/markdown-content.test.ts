import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React from "react";
import { MarkdownContent } from "@/components/MarkdownContent";

// Helper to inspect the rendered virtual DOM tree of a React element
function findReactNodes(node: any, predicate: (n: any) => boolean): any[] {
  if (!node) return [];
  const results: any[] = [];
  if (predicate(node)) {
    results.push(node);
  }
  if (node.props && node.props.children) {
    const children = Array.isArray(node.props.children)
      ? node.props.children
      : [node.props.children];
    for (const child of children) {
      results.push(...findReactNodes(child, predicate));
    }
  }
  return results;
}

describe("MarkdownContent - Horizontal Rule rendering", () => {
  it("renders a horizontal rule for three or more dashes, asterisks, or underscores", () => {
    const hrDashes = MarkdownContent({ content: "---" });
    const hrAsterisks = MarkdownContent({ content: "***" });
    const hrUnderscores = MarkdownContent({ content: "___" });

    const hrNodesDashes = findReactNodes(hrDashes, (n) => n.type === "hr");
    const hrNodesAsterisks = findReactNodes(hrAsterisks, (n) => n.type === "hr");
    const hrNodesUnderscores = findReactNodes(hrUnderscores, (n) => n.type === "hr");

    expect(hrNodesDashes.length).toBe(1);
    expect(hrNodesAsterisks.length).toBe(1);
    expect(hrNodesUnderscores.length).toBe(1);

    expect(hrNodesDashes[0].props.className).toContain("border-t");
  });

  it("horizontal rule breaks paragraphs correctly", () => {
    const content = "Paragraph before\n---\nParagraph after";
    const tree = MarkdownContent({ content });

    const pNodes = findReactNodes(tree, (n) => n.type === "p");
    const hrNodes = findReactNodes(tree, (n) => n.type === "hr");

    expect(pNodes.length).toBe(2);
    expect(hrNodes.length).toBe(1);
  });
});

describe("MarkdownContent - Table rendering", () => {
  it("renders a standard markdown table with headers, borders and correct values", () => {
    const content = [
      "| Col A | Col B |",
      "| --- | --- |",
      "| Value 1 | Value 2 |",
      "| Value 3 | Value 4 |",
    ].join("\n");

    const tree = MarkdownContent({ content });
    const tableNodes = findReactNodes(tree, (n) => n.type === "table");
    expect(tableNodes.length).toBe(1);

    const thNodes = findReactNodes(tree, (n) => n.type === "th");
    expect(thNodes.length).toBe(2);

    const tdNodes = findReactNodes(tree, (n) => n.type === "td");
    expect(tdNodes.length).toBe(4);
  });

  it("applies column alignments correctly based on colons", () => {
    const content = [
      "| Left | Center | Right |",
      "| :--- | :---: | ---: |",
      "| L1 | C1 | R1 |",
    ].join("\n");

    const tree = MarkdownContent({ content });

    const thNodes = findReactNodes(tree, (n) => n.type === "th");
    expect(thNodes[0].props.className).toContain("text-left");
    expect(thNodes[1].props.className).toContain("text-center");
    expect(thNodes[2].props.className).toContain("text-right");

    const tdNodes = findReactNodes(tree, (n) => n.type === "td");
    expect(tdNodes[0].props.className).toContain("text-left");
    expect(tdNodes[1].props.className).toContain("text-center");
    expect(tdNodes[2].props.className).toContain("text-right");
  });

  it("renders inline formatted styling (like backticks or strong) inside table cells", () => {
    const content = [
      "| Styled Header |",
      "| --- |",
      "| **Bold** cell with `code` |",
    ].join("\n");

    const tree = MarkdownContent({ content });

    const codeNodes = findReactNodes(tree, (n) => n.type === "code");
    const strongNodes = findReactNodes(tree, (n) => n.type === "strong");

    expect(codeNodes.length).toBe(1);
    expect(strongNodes.length).toBe(1);
  });

  it("handles empty or mismatched cell values gracefully", () => {
    const content = [
      "| Col A | Col B |",
      "| --- | --- |",
      "| Value 1 |", // missing second cell
    ].join("\n");

    const tree = MarkdownContent({ content });
    const tdNodes = findReactNodes(tree, (n) => n.type === "td");
    expect(tdNodes.length).toBe(2); // should still render 2 columns corresponding to the 2 headers
  });

  it("tables interrupt paragraphs correctly", () => {
    const content = [
      "Some paragraph writing",
      "| Col A | Col B |",
      "| --- | --- |",
      "| Val A | Val B |",
      "Continuing normal writing",
    ].join("\n");

    const tree = MarkdownContent({ content });
    const pNodes = findReactNodes(tree, (n) => n.type === "p");
    const tableNodes = findReactNodes(tree, (n) => n.type === "table");

    expect(pNodes.length).toBe(2);
    expect(tableNodes.length).toBe(1);
  });
});
