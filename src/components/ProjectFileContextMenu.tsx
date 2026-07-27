"use client";

import type { ReactNode } from "react";
import { Copy, FolderOpen } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { buildProjectFileFullPath, type ProjectFileReference } from "@/lib/project-file-links";
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
