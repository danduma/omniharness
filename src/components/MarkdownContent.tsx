import React, { memo, useMemo } from "react";
import { ProjectFileContextMenu } from "@/components/ProjectFileContextMenu";
import { parseProjectFileReference, type ProjectFileReference } from "@/lib/project-file-links";
import { cn } from "@/lib/utils";

function isSafeHref(href: string) {
  return /^(https?:\/\/|mailto:|\/|#)/.test(href);
}

type Alignment = "left" | "center" | "right" | null;

function isTableDelimiter(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return false;
  let content = trimmed;
  if (content.startsWith("|")) content = content.slice(1);
  if (content.endsWith("|")) content = content.slice(0, -1);

  const columns = content.split("|");
  if (columns.length === 0) return false;

  for (const col of columns) {
    const colTrim = col.trim();
    if (!/^[:-]+$/.test(colTrim) || !colTrim.includes("-")) {
      return false;
    }
  }
  return true;
}

function splitTableRow(line: string): string[] {
  let content = line.trim();
  if (content.startsWith("|")) content = content.slice(1);
  if (content.endsWith("|")) content = content.slice(0, -1);
  return content.split(/(?<!\\)\|/).map((col) => col.replace(/\\\|/g, "|").trim());
}

function parseAlignments(delimiterLine: string): Alignment[] {
  const cols = splitTableRow(delimiterLine);
  return cols.map((col) => {
    const starts = col.startsWith(":");
    const ends = col.endsWith(":");
    if (starts && ends) return "center";
    if (ends) return "right";
    if (starts) return "left";
    return null;
  });
}

interface MarkdownContentProps {
  content: string;
  className?: string;
  inheritTextColor?: boolean;
  projectRoot?: string | null;
  onOpenProjectFile?: (file: ProjectFileReference) => void;
}

function linkClassName(inheritTextColor: boolean) {
  return cn(
    "font-medium underline underline-offset-4 transition-colors",
    inheritTextColor
      ? "text-current decoration-current/35 hover:text-current dark:text-current dark:hover:text-current"
      : "text-emerald-700 decoration-emerald-700/30 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-100",
  );
}

function renderLink({
  href,
  label,
  keyValue,
  inheritTextColor,
  projectRoot,
  onOpenProjectFile,
}: {
  href: string;
  label: string;
  keyValue: string;
  inheritTextColor: boolean;
  projectRoot?: string | null;
  onOpenProjectFile?: (file: ProjectFileReference) => void;
}) {
  const reference = projectRoot ? parseProjectFileReference(href, projectRoot) : null;
  if (reference && onOpenProjectFile) {
    return (
      <ProjectFileContextMenu
        key={keyValue}
        reference={reference}
        onOpen={onOpenProjectFile}
      >
        <button
          type="button"
          className={cn("inline text-left", linkClassName(inheritTextColor))}
          onClick={() => onOpenProjectFile(reference)}
        >
          {label}
        </button>
      </ProjectFileContextMenu>
    );
  }

  return isSafeHref(href) ? (
    <a
      key={keyValue}
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
      className={linkClassName(inheritTextColor)}
    >
      {label}
    </a>
  ) : label;
}

function renderCodeSpan({
  text,
  keyValue,
  inheritTextColor,
  projectRoot,
  onOpenProjectFile,
}: {
  text: string;
  keyValue: string;
  inheritTextColor: boolean;
  projectRoot?: string | null;
  onOpenProjectFile?: (file: ProjectFileReference) => void;
}) {
  const className = cn(
    "rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]",
    inheritTextColor ? "text-current" : "text-foreground",
  );
  const reference = projectRoot ? parseProjectFileReference(text, projectRoot) : null;

  if (reference && onOpenProjectFile) {
    return (
      <ProjectFileContextMenu
        key={keyValue}
        reference={reference}
        onOpen={onOpenProjectFile}
      >
        <button
          type="button"
          className={cn(
            "inline text-left underline decoration-current/35 underline-offset-4 transition-colors hover:decoration-current",
            className,
          )}
          onClick={() => onOpenProjectFile(reference)}
        >
          {text}
        </button>
      </ProjectFileContextMenu>
    );
  }

  return (
    <code
      key={keyValue}
      className={className}
    >
      {text}
    </code>
  );
}

function renderInlineMarkdown(
  text: string,
  keyPrefix: string,
  inheritTextColor = false,
  projectRoot?: string | null,
  onOpenProjectFile?: (file: ProjectFileReference) => void,
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|(https?:\/\/[^\s<>()]+))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[2] && match[3]) {
      const href = match[3];
      nodes.push(renderLink({
        href,
        label: match[2],
        keyValue: `${keyPrefix}-link-${match.index}`,
        inheritTextColor,
        projectRoot,
        onOpenProjectFile,
      }));
    } else if (match[4]) {
      nodes.push(renderCodeSpan({
        text: match[4],
        keyValue: `${keyPrefix}-code-${match.index}`,
        inheritTextColor,
        projectRoot,
        onOpenProjectFile,
      }));
    } else if (match[5]) {
      nodes.push(
        <strong
          key={`${keyPrefix}-strong-${match.index}`}
          className={cn("font-semibold", inheritTextColor ? "text-current" : "text-foreground")}
        >
          {renderInlineMarkdown(
            match[5],
            `${keyPrefix}-strong-${match.index}`,
            inheritTextColor,
            projectRoot,
            onOpenProjectFile,
          )}
        </strong>,
      );
    } else if (match[6]) {
      nodes.push(<em key={`${keyPrefix}-em-${match.index}`} className="italic">{match[6]}</em>);
    } else if (match[7]) {
      const href = match[7];
      nodes.push(renderLink({
        href,
        label: href,
        keyValue: `${keyPrefix}-raw-link-${match.index}`,
        inheritTextColor,
        projectRoot,
        onOpenProjectFile,
      }));
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

type MarkdownListMarker = {
  indent: number;
  ordered: boolean;
  ordinal: number | null;
  content: string;
};

type MarkdownListTextBlock = {
  type: "text";
  lines: string[];
};

type MarkdownListBlock = MarkdownListTextBlock | {
  type: "list";
  list: MarkdownList;
};

type MarkdownList = {
  ordered: boolean;
  start: number | null;
  items: MarkdownListBlock[][];
};

function indentationWidth(value: string): number {
  let width = 0;
  for (const character of value) {
    width += character === "\t" ? 4 - (width % 4) : 1;
  }
  return width;
}

function parseListMarker(line: string): MarkdownListMarker | null {
  const match = line.match(/^([ \t]*)(?:(\d+)\.|([-*]))[ \t]+(.+)$/);
  if (!match) return null;

  return {
    indent: indentationWidth(match[1]),
    ordered: Boolean(match[2]),
    ordinal: match[2] ? Number(match[2]) : null,
    content: match[4],
  };
}

function appendListText(blocks: MarkdownListBlock[], text: string) {
  const lastBlock = blocks.at(-1);
  if (lastBlock?.type === "text") {
    lastBlock.lines.push(text);
    return;
  }
  blocks.push({ type: "text", lines: [text] });
}

function nextNonBlankLine(lines: string[], start: number): number {
  let index = start;
  while (index < lines.length && !lines[index].trim()) index += 1;
  return index;
}

function parseMarkdownList(
  lines: string[],
  startIndex: number,
  baseIndent: number,
  ordered: boolean,
): { list: MarkdownList; nextIndex: number } {
  const firstMarker = parseListMarker(lines[startIndex]);
  const list: MarkdownList = {
    ordered,
    start: ordered ? firstMarker?.ordinal ?? 1 : null,
    items: [],
  };
  let index = startIndex;

  while (index < lines.length) {
    const marker = parseListMarker(lines[index]);
    if (!marker || marker.indent !== baseIndent || marker.ordered !== ordered) break;

    const blocks: MarkdownListBlock[] = [];
    appendListText(blocks, marker.content);
    index += 1;

    while (index < lines.length) {
      if (!lines[index].trim()) {
        const nextIndex = nextNonBlankLine(lines, index + 1);
        if (nextIndex >= lines.length) {
          index = nextIndex;
          break;
        }

        const nextMarker = parseListMarker(lines[nextIndex]);
        const nextIndent = indentationWidth(lines[nextIndex].match(/^[ \t]*/)?.[0] ?? "");
        if (
          (nextMarker && nextMarker.indent >= baseIndent)
          || (!nextMarker && nextIndent > baseIndent)
        ) {
          index = nextIndex;
          if (nextMarker?.indent === baseIndent && nextMarker.ordered === ordered) break;
          continue;
        }

        index = nextIndex;
        break;
      }

      const nextMarker = parseListMarker(lines[index]);
      if (nextMarker) {
        if (nextMarker.indent === baseIndent && nextMarker.ordered === ordered) break;
        if (nextMarker.indent > baseIndent) {
          const nested = parseMarkdownList(lines, index, nextMarker.indent, nextMarker.ordered);
          blocks.push({ type: "list", list: nested.list });
          index = nested.nextIndex;
          continue;
        }
        break;
      }

      const lineIndent = indentationWidth(lines[index].match(/^[ \t]*/)?.[0] ?? "");
      if (lineIndent <= baseIndent) break;
      appendListText(blocks, lines[index].trim());
      index += 1;
    }

    list.items.push(blocks);
  }

  return { list, nextIndex: index };
}

function renderMarkdownList(
  list: MarkdownList,
  keyPrefix: string,
  inheritTextColor: boolean,
  projectRoot?: string | null,
  onOpenProjectFile?: (file: ProjectFileReference) => void,
  nested = false,
): React.ReactElement {
  const ListTag = list.ordered ? "ol" : "ul";
  return (
    <ListTag
      key={keyPrefix}
      start={list.ordered && list.start !== 1 ? list.start ?? undefined : undefined}
      className={cn(
        "space-y-1 pl-5",
        list.ordered ? "list-decimal" : "list-disc",
        nested && "mt-1",
      )}
    >
      {list.items.map((blocks, itemIndex) => (
        <li key={`${keyPrefix}-item-${itemIndex}`} className="pl-1">
          {blocks.map((block, blockIndex) => (
            block.type === "text"
              ? (
                  <React.Fragment key={`${keyPrefix}-text-${itemIndex}-${blockIndex}`}>
                    {renderInlineMarkdown(
                      block.lines.join(" "),
                      `${keyPrefix}-text-${itemIndex}-${blockIndex}`,
                      inheritTextColor,
                      projectRoot,
                      onOpenProjectFile,
                    )}
                  </React.Fragment>
                )
              : renderMarkdownList(
                  block.list,
                  `${keyPrefix}-nested-${itemIndex}-${blockIndex}`,
                  inheritTextColor,
                  projectRoot,
                  onOpenProjectFile,
                  true,
                )
          ))}
        </li>
      ))}
    </ListTag>
  );
}

/**
 * Pure block parser. Kept separate from the component so the result can be
 * memoized: this walks every line running 6-8 regexes per line, recurses for
 * inline emphasis, and re-tokenizes tables and lists. It used to run in the
 * component body with no cache, so a single streamed entry re-parsed every
 * message in the transcript — hundreds of KB of text re-tokenized
 * synchronously on the main thread per render pass.
 */
function parseMarkdownBlocks({ content, inheritTextColor, projectRoot, onOpenProjectFile }: {
  content: string;
  inheritTextColor: boolean;
  projectRoot?: MarkdownContentProps["projectRoot"];
  onOpenProjectFile?: MarkdownContentProps["onOpenProjectFile"];
}): React.ReactNode[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let index = 0;

  const readParagraph = () => {
    const start = index;
    const paragraph: string[] = [];

    while (index < lines.length) {
      const line = lines[index];
      if (
        !line.trim() ||
        /^```/.test(line) ||
        /^(#{1,4})\s+/.test(line) ||
        /^\s*[-*]\s+/.test(line) ||
        /^\s*\d+\.\s+/.test(line) ||
        /^\s*>\s?/.test(line) ||
        /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)
      ) {
        break;
      }
      if (index + 1 < lines.length && isTableDelimiter(lines[index + 1])) {
        break;
      }
      paragraph.push(line.trim());
      index += 1;
    }

    return { start, text: paragraph.join(" ") };
  };

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)) {
      blocks.push(
        <hr
          key={`hr-${index}`}
          className="my-4 border-t border-border/60"
        />,
      );
      index += 1;
      continue;
    }

    if (index + 1 < lines.length && isTableDelimiter(lines[index + 1])) {
      const start = index;
      const headerLine = lines[index];
      const delimiterLine = lines[index + 1];
      const alignments = parseAlignments(delimiterLine);
      const headers = splitTableRow(headerLine);

      const rows: string[][] = [];
      index += 2; // skip header and delimiter

      while (index < lines.length) {
        const rowLine = lines[index];
        const trimmedRow = rowLine.trim();
        if (
          !trimmedRow ||
          !trimmedRow.includes("|") ||
          /^```/.test(trimmedRow) ||
          /^(#{1,4})\s+/.test(trimmedRow) ||
          /^\s*[-*]\s+/.test(trimmedRow) ||
          /^\s*\d+\.\s+/.test(trimmedRow) ||
          /^\s*>\s?/.test(trimmedRow) ||
          /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(trimmedRow)
        ) {
          break;
        }
        rows.push(splitTableRow(rowLine));
        index += 1;
      }

      blocks.push(
        <div key={`table-${start}`} className="my-4 overflow-x-auto rounded-md border border-border/60">
          <table className={cn(
            "min-w-full divide-y divide-border/60 text-xs text-left",
            inheritTextColor ? "text-current" : "text-foreground"
          )}>
            <thead className="bg-muted/50">
              <tr className="divide-x divide-border/40">
                {headers.map((header, colIdx) => {
                  const align = alignments[colIdx] || "left";
                  return (
                    <th
                      key={`th-${start}-${colIdx}`}
                      className={cn(
                        "px-3 py-2 font-semibold",
                        align === "center" && "text-center",
                        align === "right" && "text-right",
                        align === "left" && "text-left"
                      )}
                    >
                      {renderInlineMarkdown(header, `th-${start}-${colIdx}`, inheritTextColor, projectRoot, onOpenProjectFile)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 bg-card/20">
              {rows.map((row, rowIdx) => (
                <tr key={`tr-${start}-${rowIdx}`} className="divide-x divide-border/30 hover:bg-muted/10 transition-colors">
                  {headers.map((_, colIdx) => {
                    const cellValue = row[colIdx] || "";
                    const align = alignments[colIdx] || "left";
                    return (
                      <td
                        key={`td-${start}-${rowIdx}-${colIdx}`}
                        className={cn(
                          "px-3 py-1.5",
                          align === "center" && "text-center",
                          align === "right" && "text-right",
                          align === "left" && "text-left"
                        )}
                      >
                        {renderInlineMarkdown(cellValue, `td-${start}-${rowIdx}-${colIdx}`, inheritTextColor, projectRoot, onOpenProjectFile)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (/^```/.test(trimmed)) {
      const start = index;
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !/^```/.test(lines[index].trim())) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      blocks.push(
        <pre
          key={`code-${start}`}
          className={cn(
            "overflow-x-auto rounded-md border border-border/60 bg-muted/40 p-3 text-xs leading-5",
            inheritTextColor ? "text-current" : "text-foreground",
          )}
        >
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const Tag = headingMatch[1].length <= 2 ? "h3" : "h4";
      blocks.push(
        <Tag
          key={`heading-${index}`}
          className={cn("pt-1 text-sm font-semibold leading-5", inheritTextColor ? "text-current" : "text-foreground")}
        >
          {renderInlineMarkdown(headingMatch[2], `heading-${index}`, inheritTextColor, projectRoot, onOpenProjectFile)}
        </Tag>,
      );
      index += 1;
      continue;
    }

    const listMarker = parseListMarker(line);
    if (listMarker) {
      const start = index;
      const parsed = parseMarkdownList(lines, start, listMarker.indent, listMarker.ordered);
      blocks.push(renderMarkdownList(
        parsed.list,
        `list-${start}`,
        inheritTextColor,
        projectRoot,
        onOpenProjectFile,
      ));
      index = parsed.nextIndex;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const start = index;
      const quoteLines: string[] = [];

      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s*>\s?/, "").trim());
        index += 1;
      }

      blocks.push(
        <blockquote
          key={`quote-${start}`}
          className={cn(
            "rounded-md border border-border/60 bg-muted/30 px-3 py-2",
            inheritTextColor ? "text-current" : "text-muted-foreground",
          )}
        >
          {renderInlineMarkdown(quoteLines.join(" "), `quote-${start}`, inheritTextColor, projectRoot, onOpenProjectFile)}
        </blockquote>,
      );
      continue;
    }

    const paragraph = readParagraph();
    if (paragraph.text) {
      blocks.push(
        <p key={`paragraph-${paragraph.start}`}>
          {renderInlineMarkdown(paragraph.text, `paragraph-${paragraph.start}`, inheritTextColor, projectRoot, onOpenProjectFile)}
        </p>,
      );
    }
  }

  return blocks;
}

/**
 * Hook-free renderer. Kept exported and directly callable so the block-structure
 * tests can inspect the tree without a DOM renderer.
 */
export function renderMarkdownContent({
  content,
  className,
  inheritTextColor = false,
  projectRoot,
  onOpenProjectFile,
}: MarkdownContentProps) {
  return (
    <div className={cn("max-w-none space-y-2 break-words [overflow-wrap:anywhere] text-sm leading-6", className)}>
      {parseMarkdownBlocks({ content, inheritTextColor, projectRoot, onOpenProjectFile })}
    </div>
  );
}

/**
 * Memoized on both axes: `React.memo` stops a sibling entry's update from
 * re-entering this subtree at all, and `useMemo` stops an unavoidable re-render
 * from re-parsing text that has not changed. Streaming transcripts re-render
 * constantly, and this component sits under every assistant message.
 */
export const MarkdownContent = memo(function MarkdownContent(props: MarkdownContentProps) {
  const { content, className, inheritTextColor = false, projectRoot, onOpenProjectFile } = props;
  const blocks = useMemo(
    () => parseMarkdownBlocks({ content, inheritTextColor, projectRoot, onOpenProjectFile }),
    [content, inheritTextColor, projectRoot, onOpenProjectFile],
  );

  return (
    <div className={cn("max-w-none space-y-2 break-words [overflow-wrap:anywhere] text-sm leading-6", className)}>
      {blocks}
    </div>
  );
});
