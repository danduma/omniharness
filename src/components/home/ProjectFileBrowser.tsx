"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUp, ChevronRight, FileText, Folder, Link2Off, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  isProjectDraftDirty, projectDirectoryKey, projectDocumentKey, projectFilesManager,
} from "@/interface/home/ProjectFilesManager";
import { sideWindowManager } from "@/interface/home/SideWindowManager";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { useManagerSelector } from "@/lib/use-manager-snapshot";
import { cn } from "@/lib/utils";
import { useRuntimeAPIs } from "@/runtime-api/provider";

export function ProjectFileBrowser({ root, runnerId }: { root: string; runnerId: string }) {
  useI18nSnapshot();
  const { files } = useRuntimeAPIs();
  const key = projectDirectoryKey(runnerId, root);
  const { path, filter } = useManagerSelector(projectFilesManager, () => projectFilesManager.directory(key));
  const directory = useQuery({
    queryKey: ["project-directory", runnerId, root, path],
    queryFn: async ({ signal }) => {
      const result = await files.directory({ root, directory: path }, { signal });
      // Older runners return a flat file list for this route.
      if (!Array.isArray(result?.entries)) throw new Error("Project directory response is unavailable");
      return result;
    },
    staleTime: 5_000,
    retry: false,
  });
  const parts = path ? path.split("/") : [];
  const rootName = root.split(/[\\/]/).filter(Boolean).at(-1) ?? root;
  const needle = filter.trim().toLowerCase();
  const entries = directory.data?.entries.filter((entry) => entry.name.toLowerCase().includes(needle)) ?? [];

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label={t("projectFiles.tab")}>
      <div className="space-y-2 border-b border-border/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            disabled={!path}
            aria-label={t("projectFiles.parent")}
            title={t("projectFiles.parent")}
            onClick={() => projectFilesManager.navigate(key, parts.slice(0, -1).join("/"))}
          >
            <ArrowUp />
          </Button>
          <nav aria-label={t("projectFiles.location")} className="flex min-w-0 flex-1 items-center overflow-x-auto text-xs">
            {[rootName, ...parts].map((name, index) => (
              <div key={index} className="flex shrink-0 items-center">
                {index > 0 && <ChevronRight className="size-3 text-muted-foreground" aria-hidden="true" />}
                <Button
                  size="sm"
                  variant="ghost"
                  title={index === 0 ? root : name}
                  aria-current={index === parts.length ? "page" : undefined}
                  className={cn("h-8 max-w-44 px-2", index < parts.length && "text-muted-foreground")}
                  onClick={() => projectFilesManager.navigate(key, parts.slice(0, index).join("/"))}
                >
                  <span className="truncate">{name}</span>
                </Button>
              </div>
            ))}
          </nav>
          <Button
            size="icon"
            variant="ghost"
            className="size-8 shrink-0"
            aria-label={t("fileViewer.menu.refresh")}
            title={t("fileViewer.menu.refresh")}
            disabled={directory.isFetching}
            onClick={() => void directory.refetch()}
          >
            <RefreshCw className={cn(directory.isFetching && "animate-spin")} />
          </Button>
        </div>
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            className="pl-8"
            aria-label={t("projectFiles.filter")}
            placeholder={t("projectFiles.filter")}
            value={filter}
            onChange={(event) => projectFilesManager.filter(key, event.currentTarget.value)}
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2" aria-busy={directory.isPending}>
        {directory.isPending ? (
          <p role="status" className="px-2 py-4 text-sm text-muted-foreground">{t("projectFiles.loading")}</p>
        ) : directory.isError && !directory.data ? (
          <div className="px-2 py-4">
            <p role="alert" className="mb-2 text-sm text-destructive">{t("projectFiles.folderError")}</p>
            <Button size="sm" variant="outline" onClick={() => void directory.refetch()}>{t("common.retry")}</Button>
          </div>
        ) : entries.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">{t(needle ? "projectFiles.noMatches" : "projectFiles.empty")}</p>
        ) : (
          <ul>
            {entries.map((entry) => (
              <ProjectFileRow
                key={entry.path}
                entry={entry}
                runnerId={runnerId}
                root={root}
                openDirectory={() => projectFilesManager.navigate(key, entry.path)}
              />
            ))}
          </ul>
        )}
        {directory.isError && directory.data && (
          <p role="alert" className="px-2 py-2 text-xs text-destructive">{t("projectFiles.folderError")}</p>
        )}
      </div>
    </section>
  );
}

function ProjectFileRow({ root, runnerId, entry, openDirectory }: {
  root: string;
  runnerId: string;
  entry: { kind: "directory" | "file" | "unavailable"; path: string; name: string };
  openDirectory: () => void;
}) {
  const dirty = useManagerSelector(projectFilesManager, (state) =>
    isProjectDraftDirty(state.drafts[projectDocumentKey(runnerId, root, entry.path)]),
  );
  const isFolder = entry.kind === "directory";
  const isUnavailable = entry.kind === "unavailable";
  const Icon = isFolder ? Folder : isUnavailable ? Link2Off : FileText;
  return (
    <li>
      <Button
        variant="ghost"
        className="h-10 w-full justify-start gap-2.5 rounded-md px-2.5 text-sm font-normal lg:h-8"
        title={isUnavailable ? t("projectFiles.unavailable", { name: entry.name }) : entry.name}
        aria-disabled={isUnavailable || undefined}
        onClick={() => {
          if (isFolder) openDirectory();
          if (entry.kind === "file") sideWindowManager.openFile({ root, relativePath: entry.path });
        }}
      >
        <Icon className={cn("size-4 shrink-0", isFolder ? "text-primary" : "text-muted-foreground")} />
        <span className="min-w-0 flex-1 truncate text-left">{entry.name}</span>
        {isUnavailable && <span className="sr-only">{t("projectFiles.unavailable", { name: entry.name })}</span>}
        {dirty && <span className="size-2 rounded-full bg-primary" role="img" aria-label={t("projectFiles.unsaved")} />}
        {isFolder && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
      </Button>
    </li>
  );
}
