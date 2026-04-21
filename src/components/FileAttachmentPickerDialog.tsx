"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";

export interface AttachmentItem {
  kind: "file";
  name: string;
  path: string;
  relativePath: string;
}

interface ProjectFilesResponse {
  root: string;
  files: string[];
}

function toAbsolutePath(root: string, filePath: string) {
  return `${root.replace(/\/$/, "")}/${filePath}`;
}

export function FileAttachmentPickerDialog({
  open,
  onOpenChange,
  rootPath,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rootPath?: string | null;
  onSelect: (attachments: AttachmentItem[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  const { data } = useQuery<ProjectFilesResponse>({
    queryKey: ["attachable-files", rootPath],
    queryFn: async () => {
      const url = rootPath ? `/api/fs/files?root=${encodeURIComponent(rootPath)}` : "/api/fs/files";
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Failed to load files");
      }
      return res.json();
    },
    enabled: open,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelectedFiles([]);
    }
  }, [open]);

  const filteredFiles = useMemo(() => {
    const files = data?.files ?? [];
    const term = search.trim().toLowerCase();
    if (!term) {
      return files;
    }

    return files.filter((filePath) => filePath.toLowerCase().includes(term));
  }, [data?.files, search]);

  const toggleFile = (filePath: string) => {
    setSelectedFiles((current) =>
      current.includes(filePath)
        ? current.filter((candidate) => candidate !== filePath)
        : [...current, filePath]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[540px] max-w-2xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 gap-3 border-b bg-muted/20 p-4">
          <div>
            <DialogTitle>Attach Files</DialogTitle>
            <div className="mt-1 truncate text-xs text-muted-foreground" title={data?.root || rootPath || "Loading..."}>
              {data?.root || rootPath || "Loading..."}
            </div>
          </div>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search files..."
            className="h-10"
          />
          <div className="text-[11px] text-muted-foreground">
            {filteredFiles.length} file{filteredFiles.length === 1 ? "" : "s"} shown
          </div>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1 p-2">
          <div className="space-y-1">
            {filteredFiles.map((filePath) => {
              const selected = selectedFiles.includes(filePath);
              return (
                <button
                  key={filePath}
                  type="button"
                  onClick={() => toggleFile(filePath)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                    selected ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted/60"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <FileText className="h-4 w-4 shrink-0 opacity-70" />
                    <span className="truncate">{filePath}</span>
                  </span>
                  <span className="ml-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border/70">
                    {selected ? <Check className="h-3 w-3" /> : null}
                  </span>
                </button>
              );
            })}
            {filteredFiles.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                No matching files found in this scope.
              </div>
            ) : null}
          </div>
        </ScrollArea>

        <div className="flex shrink-0 justify-end gap-2 border-t bg-muted/20 p-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={selectedFiles.length === 0 || !data?.root}
            onClick={() => {
              if (!data?.root) {
                return;
              }

              onSelect(selectedFiles.map((filePath) => ({
                kind: "file",
                name: filePath.split("/").pop() || filePath,
                path: toAbsolutePath(data.root, filePath),
                relativePath: filePath,
              })));
              onOpenChange(false);
            }}
          >
            Attach Selected Files
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
