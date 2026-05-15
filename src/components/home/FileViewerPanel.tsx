"use client";

import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BookOpen, Ellipsis, FileText, LoaderCircle, RefreshCw, WrapText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MarkdownContent } from "@/components/MarkdownContent";
import { fileViewerPanelManager } from "@/components/component-state-managers";
import { requestJson } from "@/lib/app-errors";
import { formatBytes } from "@/lib/chat-attachments";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { detectSyntaxLanguage, highlightCodeLine } from "@/lib/syntax-highlighting";
import { cn } from "@/lib/utils";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import type { ProjectFileContentResponse } from "@/app/home/types";

export function FileViewerPanel({
  root,
  relativePath,
  line,
  className,
}: {
  root: string;
  relativePath: string;
  line?: number;
  className?: string;
}) {
  const targetLineRef = useRef<HTMLDivElement | null>(null);
  const { wordWrap, renderMarkdown } = useManagerSnapshot(fileViewerPanelManager);
  const isMarkdown = /\.(md|mdx|markdown)$/i.test(relativePath);
  const renderAsMarkdown = isMarkdown && renderMarkdown;
  useI18nSnapshot();
  const fileQuery = useQuery<ProjectFileContentResponse>({
    queryKey: ["project-file", root, relativePath],
    queryFn: async () => requestJson<ProjectFileContentResponse>(
      `/api/fs/files?root=${encodeURIComponent(root)}&file=${encodeURIComponent(relativePath)}`,
      undefined,
      {
        source: t("fileViewer.errorSource"),
        action: t("fileViewer.readProjectFile"),
      },
    ),
    enabled: Boolean(root && relativePath),
    staleTime: 30_000,
  });

  useEffect(() => {
    targetLineRef.current?.scrollIntoView({ block: "center" });
  }, [fileQuery.data?.content, line]);

  const content = fileQuery.data?.content ?? "";
  const lines = useMemo(() => (
    content.length > 0 ? content.split("\n") : [""]
  ), [content]);
  const syntaxLanguage = useMemo(() => detectSyntaxLanguage(relativePath), [relativePath]);
  const highlightedLines = useMemo(
    () => lines.map((text) => highlightCodeLine(text, syntaxLanguage)),
    [lines, syntaxLanguage],
  );

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-background", className)}>
      <div className="shrink-0 border-b border-border/60 px-3 py-2.5">
        <div className="flex min-w-0 items-start gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <div className="truncate font-mono text-xs font-semibold text-foreground" title={relativePath}>
                {relativePath}
              </div>
              <div className="truncate font-mono text-[10px] text-muted-foreground" title={root}>
                {root}
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground" />}
              aria-label={t("fileViewer.menu.label")}
              title={t("fileViewer.menu.label")}
            >
              <Ellipsis className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              {isMarkdown ? (
                <DropdownMenuCheckboxItem
                  checked={renderMarkdown}
                  onCheckedChange={() => fileViewerPanelManager.toggleRenderMarkdown()}
                >
                  <BookOpen className="h-4 w-4" />
                  <span>{t("fileViewer.menu.renderMarkdown")}</span>
                </DropdownMenuCheckboxItem>
              ) : null}
              <DropdownMenuCheckboxItem
                checked={wordWrap}
                onCheckedChange={() => fileViewerPanelManager.toggleWordWrap()}
              >
                <WrapText className="h-4 w-4" />
                <span>{t("fileViewer.menu.wordWrap")}</span>
              </DropdownMenuCheckboxItem>
              <DropdownMenuItem
                onClick={() => {
                  void fileQuery.refetch();
                }}
              >
                <RefreshCw className={cn("h-4 w-4", fileQuery.isFetching && "animate-spin")} />
                <span>{t("fileViewer.menu.refresh")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {fileQuery.data ? (
          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>{formatBytes(fileQuery.data.size)}</span>
            {line ? <span>{t("fileViewer.metadata.line", { line })}</span> : null}
            {syntaxLanguage ? <span className="uppercase">{syntaxLanguage}</span> : null}
            {fileQuery.data.truncated ? (
              <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-700">
                {t("fileViewer.metadata.truncated")}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {fileQuery.isLoading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          {t("fileViewer.loading")}
        </div>
      ) : fileQuery.error ? (
        <div className="m-3 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            {t("fileViewer.errorTitle")}
          </div>
          <p className="mt-1 break-words text-xs leading-5">
            {fileQuery.error instanceof Error ? fileQuery.error.message : String(fileQuery.error)}
          </p>
        </div>
      ) : renderAsMarkdown ? (
        <div className="omni-conversation-text-scale min-h-0 flex-1 overflow-auto bg-background [scrollbar-width:thin]">
          <MarkdownContent content={content} className="px-4 py-3" projectRoot={root} />
        </div>
      ) : (
        <div className="omni-conversation-text-scale min-h-0 flex-1 overflow-auto bg-muted/15 [scrollbar-width:thin]">
          <pre className={cn("syntax-highlight py-3 font-mono text-[length:var(--omni-conversation-font-size)] leading-[var(--omni-conversation-line-height)]", wordWrap ? "min-w-0" : "min-w-max")}>
            {lines.map((text, index) => {
              const lineNumber = index + 1;
              const highlighted = lineNumber === line;
              return (
                <div
                  key={lineNumber}
                  ref={highlighted ? targetLineRef : undefined}
                  className={cn(
                    wordWrap ? "grid grid-cols-[4rem_minmax(0,1fr)] px-3" : "grid min-w-max grid-cols-[4rem_max-content] px-3",
                    highlighted && "bg-primary/10 text-primary",
                  )}
                >
                  <span className="select-none pr-4 text-right text-muted-foreground/70">{lineNumber}</span>
                  <code
                    className={cn(
                      "pr-4 text-foreground",
                      wordWrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
                    )}
                    dangerouslySetInnerHTML={{ __html: highlightedLines[index] ?? " " }}
                  />
                </div>
              );
            })}
          </pre>
        </div>
      )}
    </div>
  );
}
