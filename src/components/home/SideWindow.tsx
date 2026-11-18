"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, FileText, FolderOpen, PanelRightClose, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sideWindowManager, type SideWindowFileTab } from "@/interface/home/SideWindowManager";
import { cn } from "@/lib/utils";
import { useManagerSelector, useManagerSnapshot } from "@/lib/use-manager-snapshot";
import { isProjectDraftDirty, projectDocumentKey, projectFilesManager } from "@/interface/home/ProjectFilesManager";
import { ProjectFileBrowser } from "./ProjectFileBrowser";
import { FileViewerPanel } from "./FileViewerPanel";
import { t, useI18nSnapshot } from "@/lib/i18n";

export function SideWindow({
  projectRoot,
  runnerId,
  visible = true,
  onCloseWindow,
  closeButtonVariant = "collapse",
}: {
  projectRoot: string | null;
  runnerId: string;
  visible?: boolean;
  onCloseWindow?: () => void;
  closeButtonVariant?: "collapse" | "back";
}) {
  useI18nSnapshot();
  const { tabs, activeTabId } = useManagerSnapshot(sideWindowManager);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const activeTabElement = useRef<HTMLDivElement | null>(null);
  const selectedId = activeTab?.id;
  useEffect(() => {
    if (visible) activeTabElement.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selectedId, visible]);
  useEffect(() => {
    if (!onCloseWindow || !visible) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        onCloseWindow();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCloseWindow, visible]);
  const filesTabLabel = t("projectFiles.tab");
  const closeButtonLabel = closeButtonVariant === "back" ? t("common.back") : t("side.window.collapseAria");
  const CloseButtonIcon = closeButtonVariant === "back" ? ArrowLeft : PanelRightClose;
  const closeButton = onCloseWindow ? (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
      aria-label={closeButtonLabel}
      title={closeButtonLabel}
      onClick={onCloseWindow}
    >
      <CloseButtonIcon className="h-4 w-4" />
    </Button>
  ) : null;

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-center gap-1 border-b border-border/70 bg-muted/25 px-2 pt-2">
        {closeButtonVariant === "back" ? closeButton : null}
        <div className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto [scrollbar-width:none]">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              ref={tab.id === selectedId ? activeTabElement : undefined}
              className={cn(
                "inline-flex h-8 max-w-44 shrink-0 items-center overflow-hidden rounded-t-md border px-0 text-xs font-medium transition-colors",
                tab.id === activeTab?.id
                  ? "-mb-px border-foreground/15 border-b-background bg-background text-foreground shadow-sm dark:border-foreground/20 dark:border-b-background"
                  : "border-border/80 bg-muted/35 text-muted-foreground hover:border-foreground/15 hover:bg-muted/65 hover:text-foreground dark:border-foreground/10 dark:bg-muted/25 dark:hover:border-foreground/18 dark:hover:bg-muted/45",
              )}
              title={tab.kind === "file" ? tab.relativePath : filesTabLabel}
            >
              {tab.kind === "file" ? (
                <button
                  type="button"
                  aria-label={t("projectFiles.closeTab", { path: tab.relativePath })}
                  title={t("projectFiles.closeTab", { path: tab.relativePath })}
                  className="ml-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    projectFilesManager.close(projectDocumentKey(runnerId, tab.root, tab.relativePath));
                    sideWindowManager.closeTab(tab.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => sideWindowManager.selectTab(tab.id)}
                aria-label={tab.kind === "file" ? tab.relativePath : filesTabLabel}
                aria-pressed={tab.id === activeTab?.id}
                className="inline-flex min-w-0 flex-1 items-center gap-1.5 px-2"
              >
                {tab.kind === "file" ? <FileTabIcon tab={tab} runnerId={runnerId} />
                  : <FolderOpen className="size-3.5 shrink-0" />}
                <span className="truncate">{tab.kind === "file" ? tab.title : filesTabLabel}</span>
              </button>
            </div>
          ))}
        </div>
        {closeButtonVariant === "collapse" ? closeButton : null}
      </div>
      <div className="min-h-0 flex-1">
        {activeTab?.kind === "files" && projectRoot && visible ? (
          <ProjectFileBrowser root={projectRoot} runnerId={runnerId} />
        ) : activeTab?.kind === "file" && visible ? (
          <FileViewerPanel
            key={projectDocumentKey(runnerId, activeTab.root, activeTab.relativePath)}
            runnerId={runnerId}
            root={activeTab.root}
            relativePath={activeTab.relativePath}
            line={activeTab.line}
          />
        ) : null}
      </div>
    </div>
  );
}

function FileTabIcon({ tab, runnerId }: { tab: SideWindowFileTab; runnerId: string }) {
  useI18nSnapshot();
  const dirty = useManagerSelector(projectFilesManager, (state) =>
    isProjectDraftDirty(state.drafts[projectDocumentKey(runnerId, tab.root, tab.relativePath)]),
  );
  return dirty
    ? <span title={t("projectFiles.unsaved")} className="size-2 shrink-0 rounded-full bg-primary" />
    : <FileText className="size-3.5 shrink-0" />;
}
