"use client";

import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BookOpen, Copy, Download, Ellipsis, FileText, Globe, Image as ImageIcon, LoaderCircle, Maximize2, Pencil, RefreshCw, Save, WrapText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { sideWindowManager } from "@/interface/home/SideWindowManager";
import { isProjectDraftDirty, projectDocumentKey, projectFilesManager } from "@/interface/home/ProjectFilesManager";
import { useOptionalRunnerRegistryContext } from "@/interface/runners/RunnerRegistryProvider";
import { MarkdownContent } from "@/components/MarkdownContent";
import { fileViewerPanelManager } from "@/components/component-state-managers";
import { formatBytes } from "@/lib/chat-attachments";
import { ProjectVideoViewer } from "./ProjectVideoViewer";
import { isImagePath, isVideoPath } from "@/lib/file-media";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { useOpenProjectHtml } from "@/lib/use-open-project-html";
import { buildProjectFileFullPath, isHtmlProjectFile } from "@/lib/project-file-links";
import { detectSyntaxLanguage, highlightCodeLine } from "@/lib/syntax-highlighting";
import { buildRuntimeQuery, runtimeErrorMessage } from "@/runtime-api/request";
import { cn } from "@/lib/utils";
import { useManagerSelector, useManagerSnapshot } from "@/lib/use-manager-snapshot";
import type { ProjectFileContentResponse } from "@/interface/home/types";
import { useRuntimeAPIs } from "@/runtime-api/provider";

export function FileViewerPanel({
  runnerId,
  root,
  relativePath,
  line,
  className,
}: {
  runnerId: string;
  root: string;
  relativePath: string;
  line?: number;
  className?: string;
}) {
  const openInBrowser = useOpenProjectHtml();
  const targetLineRef = useRef<HTMLDivElement | null>(null);
  const { wordWrap, renderMarkdown, actualSize, imageByKey } = useManagerSnapshot(fileViewerPanelManager);
  const documentKey = projectDocumentKey(runnerId, root, relativePath);
  const draft = useManagerSelector(projectFilesManager, (state) => state.drafts[documentKey]);
  const dirty = isProjectDraftDirty(draft);
  const isTextImage = /\.svg$/i.test(relativePath);
  const isImage = isImagePath(relativePath) && !draft;
  const isVideo = isVideoPath(relativePath);
  const isMarkdown = /\.(md|mdx|markdown)$/i.test(relativePath);
  const renderAsMarkdown = isMarkdown && (draft ? draft.mode === "preview" : renderMarkdown);
  const conflict = draft?.error != null && getErrorCode(draft.error) === "filesystem.file_changed";
  useI18nSnapshot();
  const runtimeApis = useRuntimeAPIs();
  const queryClient = useQueryClient();
  const registry = useOptionalRunnerRegistryContext();
  const imageKey = documentKey;
  const fileQueryKey = ["project-file", runnerId, root, relativePath];
  const imageQueryKey = ["project-file-image", runnerId, root, relativePath];
  const target = { root, file: relativePath };
  const imageState = imageByKey[imageKey];
  const fileQuery = useQuery<ProjectFileContentResponse>({
    queryKey: fileQueryKey,
    queryFn: ({ signal }) => runtimeApis.files.list(target, { signal }) as Promise<ProjectFileContentResponse>,
    enabled: Boolean(root && relativePath) && (!isImage || isTextImage) && !isVideo,
    staleTime: 30_000,
    retry: false,
  });
  const imageQuery = useQuery<Blob>({
    queryKey: imageQueryKey,
    queryFn: ({ signal }) => runtimeApis.files.image(target, { signal }),
    enabled: Boolean(root && relativePath) && isImage,
    staleTime: 30_000,
  });
  const download = useMutation({
    mutationFn: async () => {
      const snapshot = registry?.profileStore.getSnapshot();
      const profile = snapshot?.profiles.find((item) => item.id === snapshot.activeRunnerId);
      const url = new URL(`/api/fs/files${buildRuntimeQuery({ root, file: relativePath, download: "1" })}`,
        profile?.baseUrl ?? window.location.origin);
      if (runtimeApis.runtime.surface === "web" && url.origin === window.location.origin && profile?.authTransport !== "bearer") {
        triggerDownload(url.toString(), relativePath);
        return;
      }
      const blobUrl = URL.createObjectURL(await runtimeApis.files.download(target));
      triggerDownload(blobUrl, relativePath);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
    },
  });
  async function save() {
    await queryClient.cancelQueries({ queryKey: fileQueryKey });
    const result = await projectFilesManager.save(documentKey, target, runtimeApis.files.save);
    if (result) {
      await queryClient.cancelQueries({ queryKey: fileQueryKey });
      queryClient.setQueryData(fileQueryKey, result);
      void queryClient.invalidateQueries({ queryKey: imageQueryKey });
    }
  }
  function handleEditorKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key.toLowerCase() === "s" && (event.metaKey || event.ctrlKey) && draft) {
      event.preventDefault();
      if (dirty && !conflict && draft.mode !== "disk") void save();
    }
  }
  const activeQuery = isImage ? imageQuery : fileQuery;

  const imageBlob = imageQuery.data;
  const imageUrl = useMemo(
    () => imageBlob ? URL.createObjectURL(imageBlob) : null,
    [imageBlob],
  );
  // Each blob gets its own object URL, so the previous one is unreachable the
  // moment a refetch replaces it — release it rather than leaking the bytes for
  // the lifetime of the document.
  useEffect(() => () => {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
  }, [imageUrl]);

  useEffect(() => {
    targetLineRef.current?.scrollIntoView({ block: "center" });
  }, [fileQuery.data?.content, line]);

  const content = draft?.mode === "disk" ? fileQuery.data?.content ?? "" : draft?.content ?? fileQuery.data?.content ?? "";
  const showSource = !isImage && !isVideo && !renderAsMarkdown && (!draft || draft.mode === "disk");
  const editableFile = fileQuery.data?.revision && !fileQuery.isError ? fileQuery.data : undefined;
  const reviewedFile = !fileQuery.isFetching && !fileQuery.isError && fileQuery.data?.revision ? fileQuery.data : undefined;
  const lines = useMemo(() => (
    showSource ? content.split("\n") : []
  ), [content, showSource]);
  const syntaxLanguage = useMemo(() => detectSyntaxLanguage(relativePath), [relativePath]);
  const highlightedLines = useMemo(
    () => lines.length <= 5_000 ? lines.map((text) => highlightCodeLine(text, syntaxLanguage)) : [],
    [lines, syntaxLanguage],
  );

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-background", className)} onKeyDown={handleEditorKeys}>
      <div className="shrink-0 border-b border-border/60 px-3 py-2.5">
        <div className="flex min-w-0 items-start gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {isImage
              ? <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              : <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <div className="min-w-0">
              <div className="truncate font-mono text-xs font-semibold text-foreground" title={relativePath}>
                {relativePath}
              </div>
              <div className="truncate font-mono text-[10px] text-muted-foreground" title={root}>
                {root}
              </div>
            </div>
          </div>
          {!draft && editableFile && (
            <Button size="sm" variant="outline" className="h-7" onClick={() => projectFilesManager.startEditing(documentKey, editableFile)}>
              <Pencil className="size-3.5" />
              {t("projectFiles.edit")}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground" />}
              aria-label={t("fileViewer.menu.label")}
              title={t("fileViewer.menu.label")}
            >
              <Ellipsis className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              {isImage ? (
                <DropdownMenuCheckboxItem
                  checked={actualSize}
                  onCheckedChange={() => fileViewerPanelManager.toggleActualSize()}
                >
                  <Maximize2 className="h-4 w-4" />
                  <span>{t("fileViewer.menu.actualSize")}</span>
                </DropdownMenuCheckboxItem>
              ) : !isVideo ? (
                <>
                  {isMarkdown && !draft ? (
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
                </>
              ) : null}
              {(isHtmlProjectFile({ relativePath }) || isVideo) && (
                <DropdownMenuItem onClick={() => openInBrowser({ root, relativePath })}>
                  <Globe className="h-4 w-4" />
                  <span>{t("projectFile.menu.openInBrowser")}</span>
                </DropdownMenuItem>
              )}
              {isVideo && (
                <DropdownMenuItem onClick={() => openInBrowser({ root, relativePath }, true)}>
                  <Download className="h-4 w-4" />
                  <span>{t("fileViewer.video.download")}</span>
                </DropdownMenuItem>
              )}
              {!isVideo && (
                <DropdownMenuItem disabled={download.isPending} onClick={() => download.mutate()}>
                  <Download className="size-4" />
                  <span>{t("projectFiles.download")}</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  void navigator.clipboard.writeText(buildProjectFileFullPath({ root, relativePath }));
                }}
              >
                <Copy className="h-4 w-4" />
                <span>{t("fileViewer.menu.copyFullPath")}</span>
              </DropdownMenuItem>
              {isImage || isVideo ? null : (
                <DropdownMenuItem
                  disabled={!fileQuery.data}
                  onClick={() => {
                    void navigator.clipboard.writeText(content);
                  }}
                >
                  <Copy className="h-4 w-4" />
                  <span>{t("fileViewer.menu.copyContents")}</span>
                </DropdownMenuItem>
              )}
              {!isVideo && !draft && <DropdownMenuItem
                onClick={() => {
                  if (isImage) {
                    fileViewerPanelManager.forgetImage(imageKey);
                  }
                  void activeQuery.refetch();
                }}
              >
                <RefreshCw className={cn("h-4 w-4", activeQuery.isFetching && "animate-spin")} />
                <span>{t("fileViewer.menu.refresh")}</span>
              </DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {draft ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" variant={draft.mode === "edit" ? "secondary" : "ghost"} className="h-7"
              aria-pressed={draft.mode === "edit"} onClick={() => projectFilesManager.setMode(documentKey, "edit")}>
              {t("projectFiles.edit")}
            </Button>
            {isMarkdown && (
              <Button size="sm" variant={draft.mode === "preview" ? "secondary" : "ghost"} className="h-7"
                aria-pressed={draft.mode === "preview"} onClick={() => projectFilesManager.setMode(documentKey, "preview")}>
                {t("projectFiles.preview")}
              </Button>
            )}
            <span className="ml-auto text-xs text-muted-foreground" role="status">
              {t(draft.saving ? "projectFiles.saving" : dirty ? "projectFiles.unsaved" : "common.saved")}
            </span>
            <Button size="sm" className="h-7" disabled={!dirty || draft.saving || conflict || draft.mode === "disk"} onClick={() => void save()}>
              <Save className="size-3.5" />{t("common.save")}
            </Button>
            {dirty ? (
              <Dialog>
                <DialogTrigger render={<Button size="sm" variant="ghost" className="h-7" disabled={draft.saving} />}>
                  {t("projectFiles.discard")}
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("projectFiles.discard")}</DialogTitle>
                    <DialogDescription>{t("projectFiles.discardPrompt", { path: relativePath })}</DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
                    <DialogClose render={<Button variant="destructive" onClick={() => projectFilesManager.discard(documentKey)} />}>
                      {t("projectFiles.discard")}
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : (
              <Button size="sm" variant="ghost" className="h-7" disabled={draft.saving} onClick={() => projectFilesManager.discard(documentKey)}>
                {t("projectFiles.done")}
              </Button>
            )}
          </div>
        ) : isImage && imageBlob ? (
          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>{formatBytes(imageBlob.size)}</span>
            {imageState && !imageState.failed ? (
              <span>
                {t("fileViewer.metadata.dimensions", {
                  width: imageState.width,
                  height: imageState.height,
                })}
              </span>
            ) : null}
          </div>
        ) : fileQuery.data ? (
          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>{formatBytes(fileQuery.data.size)}</span>
            {line ? <span>{t("fileViewer.metadata.line", { line })}</span> : null}
            {syntaxLanguage ? <span className="uppercase">{syntaxLanguage}</span> : null}
            {fileQuery.data.truncated ? (
              <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-700">
                {t("projectFiles.tooLarge")}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {download.isError && <p role="alert" className="border-b px-3 py-2 text-xs text-destructive">{t("projectFiles.downloadError")}</p>}
      {draft?.error != null && (
        <div role="alert" className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 text-xs text-destructive">
          <span>{t(conflict ? "projectFiles.conflict" : getErrorCode(draft.error) === "filesystem.file_too_large"
            ? "projectFiles.tooLarge" : "projectFiles.saveError")}</span>
          {conflict && (
            <Button size="sm" variant="outline" className="h-7" onClick={() => {
              projectFilesManager.setMode(documentKey, "disk");
              void fileQuery.refetch();
            }}>
              {t("projectFiles.reviewDisk")}
            </Button>
          )}
          {draft.mode === "disk" && reviewedFile && (
            <Button size="sm" variant="outline" className="h-7" onClick={() => projectFilesManager.useDiskRevision(documentKey, reviewedFile)}>
              {t("projectFiles.keepDraft")}
            </Button>
          )}
        </div>
      )}
      {draft && (
        <FileEditor
          className={draft.mode === "edit" ? undefined : "hidden"}
          documentKey={documentKey}
          content={draft.content}
          relativePath={relativePath}
          line={line}
          wordWrap={wordWrap}
        />
      )}
      {draft?.mode === "edit" ? null : draft?.mode === "disk" && fileQuery.isFetching ? (
        <p role="status" className="p-3 text-sm text-muted-foreground">{t("fileViewer.loading")}</p>
      ) : isVideo ? (
        <ProjectVideoViewer key={`${root}:${relativePath}`} root={root} relativePath={relativePath} />
      ) : activeQuery.isLoading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          {t("fileViewer.loading")}
        </div>
      ) : activeQuery.error && draft?.mode !== "preview" ? (
        <div className="m-3 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            {t("fileViewer.errorTitle")}
          </div>
          <p className="mt-1 text-xs leading-5 [overflow-wrap:anywhere]">
            {getErrorCode(activeQuery.error) === "filesystem.binary_file"
              ? t("projectFiles.binary") : runtimeErrorMessage(activeQuery.error)}
          </p>
          {draft?.mode !== "disk" && (
            <Button size="sm" variant="outline" className="mt-2" disabled={download.isPending} onClick={() => download.mutate()}>
              <Download className="size-3.5" />{t("projectFiles.download")}
            </Button>
          )}
        </div>
      ) : isImage ? (
        <div className={cn(
          "omni-image-canvas min-h-0 flex-1 overflow-auto [scrollbar-width:thin]",
          actualSize ? "" : "flex items-center justify-center p-4",
        )}>
          {imageState?.failed ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              {t("fileViewer.image.decodeFailed")}
            </div>
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt={t("fileViewer.image.alt", { path: relativePath })}
              className={cn(actualSize ? "max-w-none" : "max-h-full max-w-full object-contain")}
              onLoad={(event) => fileViewerPanelManager.markImageLoaded(
                imageKey,
                event.currentTarget.naturalWidth,
                event.currentTarget.naturalHeight,
              )}
              onError={() => fileViewerPanelManager.markImageFailed(imageKey)}
            />
          ) : null}
        </div>
      ) : renderAsMarkdown ? (
        <div className="omni-conversation-text-scale min-h-0 flex-1 overflow-auto bg-background [scrollbar-width:thin]">
          <MarkdownContent content={content} className="px-4 py-3" projectRoot={root} onOpenProjectFile={openProjectFile} />
        </div>
      ) : (
        <div className="omni-conversation-text-scale min-h-0 flex-1 overflow-auto bg-muted/15 [scrollbar-width:thin]">
          <pre className={cn("syntax-highlight py-3 font-mono text-[length:var(--omni-conversation-font-size)] leading-[var(--omni-conversation-line-height)]", wordWrap ? "min-w-0" : "min-w-max")}>
            {highlightedLines.length === 0 && !line ? (
              <code className={cn("block px-4", wordWrap ? "whitespace-pre-wrap break-words" : "whitespace-pre")}>{content}</code>
            ) : lines.map((text, index) => {
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
                    {...(highlightedLines[index] !== undefined
                      ? { dangerouslySetInnerHTML: { __html: highlightedLines[index] } }
                      : { children: text || " " })}
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

function openProjectFile(file: Parameters<typeof sideWindowManager.openFile>[0]) {
  sideWindowManager.openFile(file);
}

function getErrorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error ? error.code : null;
}

function triggerDownload(url: string, relativePath: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = relativePath.split("/").at(-1) ?? relativePath;
  link.click();
}

function FileEditor({ className, content, documentKey, line, relativePath, wordWrap }: {
  className?: string;
  content: string;
  documentKey: string;
  line?: number;
  relativePath: string;
  wordWrap: boolean;
}) {
  useI18nSnapshot();
  const editor = useRef<HTMLTextAreaElement | null>(null);
  const placedCursor = useRef(false);
  useEffect(() => {
    if (className === "hidden" || placedCursor.current) return;
    const node = editor.current;
    if (!node) return;
    placedCursor.current = true;
    node.focus();
    if (line && line > 1) {
      const start = node.value.split("\n", line - 1).join("\n").length + 1;
      node.setSelectionRange(start, start);
    }
  }, [className, line]);

  return (
    <Textarea
      ref={editor}
      wrap={wordWrap ? "soft" : "off"}
      spellCheck={/\.(md|mdx|markdown)$/i.test(relativePath)}
      aria-label={t("projectFiles.editor", { path: relativePath })}
      className={cn("field-sizing-fixed min-h-0 flex-1 resize-none rounded-none border-0 bg-muted/15 p-4 font-mono leading-relaxed focus-visible:ring-inset", className)}
      value={content}
      onChange={(event) => projectFilesManager.change(documentKey, event.currentTarget.value)}
    />
  );
}
