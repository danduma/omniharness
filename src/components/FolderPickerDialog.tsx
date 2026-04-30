"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Folder, ArrowUpCircle } from "lucide-react";
import { normalizeAppError, requestJson } from "@/lib/app-errors";
import { folderPickerManager } from "@/components/component-state-managers";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";

export function FolderPickerDialog({ 
  open, 
  onOpenChange, 
  onSelect 
}: { 
  open: boolean; 
  onOpenChange: (o: boolean) => void; 
  onSelect: (path: string) => void; 
}) {
  const { currentPath, search } = useManagerSnapshot(folderPickerManager);

  const { data, error, refetch } = useQuery({
    queryKey: ["fs", currentPath],
    queryFn: async () => {
      const url = currentPath ? `/api/fs?path=${encodeURIComponent(currentPath)}` : "/api/fs";
      return requestJson<{
        current: string;
        parent: string;
        directories: Array<{ name: string; path: string }>;
      }>(url, undefined, {
        source: "Filesystem",
        action: "Browse directories",
      });
    },
    enabled: open,
  });

  useEffect(() => {
    if (open) refetch();
  }, [open, currentPath, refetch]);

  const directories = useMemo(() => {
    const items = data?.directories ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((dir: { name: string }) => dir.name.toLowerCase().includes(term));
  }, [data?.directories, search]);

  const canGoUp = Boolean(data && data.parent && data.parent !== data.current);
  const handleNavigate = (path: string) => {
    folderPickerManager.navigate(path);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[500px] max-w-md flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 gap-3 border-b bg-muted/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle>Select Project Folder</DialogTitle>
              <div className="mt-1 truncate text-xs text-muted-foreground" title={data?.current || "Loading..."}>
                {data?.current || "Loading..."}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              disabled={!canGoUp}
              onClick={() => {
                if (data?.parent && canGoUp) {
                  handleNavigate(data.parent);
                }
              }}
            >
              <ArrowUpCircle className="mr-2 h-4 w-4" />
              Up
            </Button>
          </div>
          <Input
            value={search}
            onChange={(event) => folderPickerManager.setSearch(event.target.value)}
            placeholder="Search folders..."
            className="h-9"
          />
          <div className="text-[11px] text-muted-foreground">
            {directories.length} folder{directories.length === 1 ? "" : "s"} shown
          </div>
        </DialogHeader>
        
        <ScrollArea className="min-h-0 flex-1 p-2">
          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <div className="font-semibold text-destructive">Browse directories</div>
              <div className="mt-1 text-xs text-foreground">{normalizeAppError(error).message}</div>
            </div>
          ) : null}
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
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {directories.map((dir: any) => (
                <Button 
                  key={dir.path}
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
        
        <div className="p-4 border-t bg-muted/20 shrink-0 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={() => {
            if (data?.current) onSelect(data.current);
            onOpenChange(false);
          }}>
            Select Current Folder
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
