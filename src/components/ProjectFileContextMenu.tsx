"use client";

import type { ReactNode } from "react";
import { Copy, Download, FolderOpen, Globe } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { buildProjectFileFullPath, type ProjectFileReference } from "@/lib/project-file-links";
import { isVideoPath } from "@/lib/file-media";
import { isHtmlProjectFile } from "@/lib/project-file-links";
import { useOpenProjectHtml } from "@/lib/use-open-project-html";
import { t, useI18nSnapshot } from "@/lib/i18n";

export function ProjectFileContextMenu({
  children,
  reference,
  onOpen,
}: {
  children: ReactNode;
  reference: ProjectFileReference;
  onOpen: (reference: ProjectFileReference) => void;
}) {
  useI18nSnapshot();
  const openInBrowser = useOpenProjectHtml();

  return (
    <ContextMenu>
      <ContextMenuTrigger render={<span className="inline" />}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onOpen(reference)}>
          <FolderOpen />
          <span>{t("projectFile.menu.open")}</span>
        </ContextMenuItem>
        {(isHtmlProjectFile(reference) || isVideoPath(reference.relativePath)) && (
          <ContextMenuItem onClick={() => openInBrowser(reference)}>
            <Globe />
            <span>{t("projectFile.menu.openInBrowser")}</span>
          </ContextMenuItem>
        )}
        {isVideoPath(reference.relativePath) && (
          <ContextMenuItem onClick={() => openInBrowser(reference, true)}>
            <Download />
            <span>{t("fileViewer.video.download")}</span>
          </ContextMenuItem>
        )}
        <ContextMenuItem
          onClick={() => {
            void navigator.clipboard.writeText(buildProjectFileFullPath(reference));
          }}
        >
          <Copy />
          <span>{t("projectFile.menu.copyPath")}</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
