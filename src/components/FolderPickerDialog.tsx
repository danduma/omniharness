"use client";

import { useMemo, useRef, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Folder, ArrowUpCircle, FolderPlus, HardDrive, Loader2 } from "lucide-react";
import { normalizeAppError } from "@/lib/app-errors";
import { folderPickerManager } from "@/components/component-state-managers";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { useRuntimeAPIs } from "@/runtime-api/provider";

export function FolderPickerDialog({ 
  open, 
  onOpenChange, 
  onSelect 
}: { 
  open: boolean; 
  onOpenChange: (o: boolean) => void; 
  onSelect: (path: string) => void; 
}) {
  useI18nSnapshot();
  const runtimeApis = useRuntimeAPIs();
  const queryClient = useQueryClient();
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const {
    currentPath,
    search,
    isCreatingDirectory,
    creationParentPath,
    creationOperationId,
    newFolderName,
  } = useManagerSnapshot(folderPickerManager);

  const { data, error } = useQuery({
    queryKey: ["fs", currentPath],
    queryFn: ({ signal }) => (
      runtimeApis.files.browse({ path: currentPath }, { signal }) as Promise<{
        current: string;
        parent: string;
        root: string | null;
        roots: Array<{ path: string; available: boolean }>;
        directories: Array<{ name: string; path: string }>;
      }>
    ),
    enabled: open,
    staleTime: 30_000,
  });

  const createDirectory = useMutation({
    mutationFn: (input: { creationOperationId: number; parentPath: string; name: string }) => (
      runtimeApis.files.createDirectory({ parentPath: input.parentPath, name: input.name })
    ),
    onSuccess: ({ path: createdPath }, input) => {
      void queryClient.invalidateQueries({ queryKey: ["fs"] });
      folderPickerManager.completeDirectoryCreation(
        input.creationOperationId,
        input.parentPath,
        createdPath,
      );
    },
  });

  const roots = data?.roots ?? [];

  const directories = useMemo(() => {
    const items = data?.directories ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((dir: { name: string }) => dir.name.toLowerCase().includes(term));
  }, [data?.directories, search]);

  const handleNavigate = (path: string) => {
    createDirectory.reset();
    folderPickerManager.navigate(path);
  };

  const handleStartDirectoryCreation = () => {
    if (!data?.current) return;
    createDirectory.reset();
    folderPickerManager.startDirectoryCreation(data.current);
    requestAnimationFrame(() => newFolderInputRef.current?.focus());
  };

  const handleCancelDirectoryCreation = () => {
    createDirectory.reset();
    folderPickerManager.cancelDirectoryCreation();
  };

  const handleCreateDirectory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newFolderName.trim();
    if (creationOperationId === null || !creationParentPath || !name || createDirectory.isPending) return;
    createDirectory.mutate({ creationOperationId, parentPath: creationParentPath, name });
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      createDirectory.reset();
      folderPickerManager.cancelDirectoryCreation();
    }
    onOpenChange(nextOpen);
  };

  const handleSelect = () => {
    if (!data?.current) return;
    onSelect(data.current);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[min(500px,calc(100dvh-2rem))] w-[calc(100vw-2rem)] max-w-md flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 gap-3 border-b bg-muted/20 p-4">
          <div className="min-w-0">
            <DialogTitle>{t("folder.picker.title")}</DialogTitle>
            <div
              className="mt-1 truncate text-xs text-muted-foreground"
              data-testid="folder-picker-current-path"
              data-parent-path={data?.parent || ""}
              title={data?.current || t("folder.picker.loading")}
            >
              {data?.current || t("folder.picker.loading")}
            </div>
          </div>
          <Input
            value={search}
            onChange={(event) => folderPickerManager.setSearch(event.target.value)}
            placeholder={t("folder.picker.searchPlaceholder")}
            className="h-9"
          />
          <div className="text-[11px] text-muted-foreground">
            {t(
              directories.length === 1 ? "folder.picker.count.one" : "folder.picker.count.other",
              { count: directories.length },
            )}
          </div>
        </DialogHeader>
        
        <ScrollArea className="min-h-0 flex-1 p-2">
          {isCreatingDirectory ? (
            <form onSubmit={handleCreateDirectory} className="mb-2 space-y-2 border-b px-2 pb-3 pt-1">
              <Label htmlFor="folder-picker-new-folder-name" className="text-xs">
                {t("folder.picker.nameLabel")}
              </Label>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                <Input
                  ref={newFolderInputRef}
                  id="folder-picker-new-folder-name"
                  value={newFolderName}
                  onChange={(event) => folderPickerManager.setNewFolderName(event.target.value)}
                  placeholder={t("folder.picker.namePlaceholder")}
                  aria-invalid={createDirectory.isError}
                  aria-describedby={createDirectory.isError ? "folder-picker-create-error" : undefined}
                  disabled={createDirectory.isPending}
                  className="col-span-2 h-9 min-w-0 sm:flex-1"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!newFolderName.trim() || createDirectory.isPending}
                  className="shrink-0"
                >
                  {createDirectory.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  {t(createDirectory.isPending ? "folder.picker.creating" : "folder.picker.create")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelDirectoryCreation}
                  disabled={createDirectory.isPending}
                >
                  {t("folder.picker.cancel")}
                </Button>
              </div>
              {createDirectory.error ? (
                <div id="folder-picker-create-error" role="alert" className="text-xs text-destructive">
                  {normalizeAppError(createDirectory.error).message}
                </div>
              ) : null}
            </form>
          ) : null}
          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <div className="font-semibold text-destructive">{t("folder.picker.errorTitle")}</div>
              <div className="mt-1 text-xs text-foreground">{normalizeAppError(error).message}</div>
            </div>
          ) : null}
          {roots.length > 1 && (
            <div className="mb-2 space-y-1 border-b pb-2">
              <div className="px-2 pb-1 text-[11px] font-medium text-muted-foreground">
                {t("folder.picker.rootsLabel")}
              </div>
              {roots.map((root) => (
                <Button
                  key={root.path}
                  data-root-path={root.path}
                  variant={root.path === data?.root ? "secondary" : "ghost"}
                  className="h-8 w-full justify-start px-2 text-sm"
                  disabled={!root.available}
                  title={root.available ? root.path : t("folder.picker.rootUnavailable")}
                  onClick={() => handleNavigate(root.path)}
                >
                  <HardDrive className="mr-2 h-4 w-4 shrink-0 text-primary/70" aria-hidden="true" />
                  <span className="truncate">{root.path}</span>
                  {!root.available && (
                    <span className="ml-auto shrink-0 pl-2 text-[11px] text-muted-foreground">
                      {t("folder.picker.rootUnavailable")}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          )}
          {data && (
            <div className="space-y-1">
              {data.parent && data.parent !== data.current && (
                <Button
                  variant="ghost"
                  className="w-full justify-start h-8 px-2 text-sm text-muted-foreground"
                  onClick={() => handleNavigate(data.parent)}
                  >
                  <ArrowUpCircle className="h-4 w-4 mr-2" /> ..
                </Button>
              )}
              {directories.map((dir) => (
                 <Button
                   key={dir.path}
                   data-folder-path={dir.path}
                  variant="ghost"
                  className="w-full justify-start h-8 px-2 text-sm truncate"
                  onClick={() => handleNavigate(dir.path)}
                >
                  <Folder className="h-4 w-4 mr-2 text-primary/70" /> {dir.name}
                </Button>
              ))}
            </div>
          )}
        </ScrollArea>
        
        <div className="flex shrink-0 flex-col items-stretch gap-2 border-t bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartDirectoryCreation}
            disabled={!data?.current || isCreatingDirectory}
          >
            <FolderPlus className="h-4 w-4" aria-hidden="true" />
            {t("folder.picker.newFolder")}
          </Button>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>{t("folder.picker.cancel")}</Button>
            <Button
              size="sm"
              onClick={handleSelect}
              disabled={!data?.current || createDirectory.isPending}
            >
              {t("folder.picker.select")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
