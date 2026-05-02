import type React from "react";
import { cn } from "@/lib/utils";

function isSafeHref(href: string) {
  return /^(https?:\/\/|mailto:|\/|#)/.test(href);
}

interface MarkdownContentProps {
  content: string;
  className?: string;
  inheritTextColor?: boolean;
}

function renderInlineMarkdown(text: string, keyPrefix: string, inheritTextColor = false): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[2] && match[3]) {
      const href = match[3];
      nodes.push(isSafeHref(href) ? (
        <a
          key={`${keyPrefix}-link-${match.index}`}
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noreferrer" : undefined}
          className={cn(
            "font-medium underline underline-offset-4 transition-colors",
            inheritTextColor
              ? "text-current decoration-current/35 hover:text-current dark:text-current dark:hover:text-current"
              : "text-emerald-700 decoration-emerald-700/30 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-100",
          )}
        >
          {match[2]}
        </a>
      ) : `[${match[2]}](${href})`);
    } else if (match[4]) {
      nodes.push(
        <code
          key={`${keyPrefix}-code-${match.index}`}
          className={cn(
            "rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]",
            inheritTextColor ? "text-current" : "text-foreground",
          )}
        >
          {match[4]}
        </code>,
      );
    } else if (match[5]) {
      nodes.push(
        <strong
          key={`${keyPrefix}-strong-${match.index}`}
          className={cn("font-semibold", inheritTextColor ? "text-current" : "text-foreground")}
        >
          {match[5]}
        </strong>,
      );
    } else if (match[6]) {
      nodes.push(<em key={`${keyPrefix}-em-${match.index}`} className="italic">{match[6]}</em>);
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export function MarkdownContent({ content, className, inheritTextColor = false }: MarkdownContentProps) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let index = 0;

  const readParagraph = () => {
    const start = index;
    const paragraph: string[] = [];

    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim() || /^```/.test(line) || /^(#{1,4})\s+/.test(line) || /^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line) || /^\s*>\s?/.test(line)) {
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
          {renderInlineMarkdown(headingMatch[2], `heading-${index}`, inheritTextColor)}
        </Tag>,
      );
      index += 1;
      continue;
    }

    const listMatch = line.match(/^\s*[-*]\s+(.+)$/);
    const orderedListMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    if (listMatch || orderedListMatch) {
      const start = index;
      const ordered = Boolean(orderedListMatch);
      const items: string[] = [];

      while (index < lines.length) {
        const itemMatch = ordered ? lines[index].match(/^\s*\d+\.\s+(.+)$/) : lines[index].match(/^\s*[-*]\s+(.+)$/);
        if (!itemMatch) {
          break;
        }
        items.push(itemMatch[1]);
        index += 1;
      }

      const ListTag = ordered ? "ol" : "ul";
      blocks.push(
        <ListTag
          key={`list-${start}`}
          className={cn("space-y-1 pl-5", ordered ? "list-decimal" : "list-disc")}
        >
          {items.map((item, itemIndex) => (
            <li key={`${start}-${itemIndex}`} className="pl-1">
              {renderInlineMarkdown(item, `list-${start}-${itemIndex}`, inheritTextColor)}
            </li>
          ))}
        </ListTag>,
      );
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
          {renderInlineMarkdown(quoteLines.join(" "), `quote-${start}`, inheritTextColor)}
        </blockquote>,
      );
      continue;
    }

    const paragraph = readParagraph();
    if (paragraph.text) {
      blocks.push(
        <p key={`paragraph-${paragraph.start}`}>
          {renderInlineMarkdown(paragraph.text, `paragraph-${paragraph.start}`, inheritTextColor)}
        </p>,
      );
    }
  }

  return (
    <div className={cn("max-w-none space-y-2 break-words text-sm leading-6", className)}>
      {blocks}
    </div>
  );
}
