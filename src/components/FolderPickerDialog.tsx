"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Folder, ArrowUpCircle } from "lucide-react";

export function FolderPickerDialog({ 
  open, 
  onOpenChange, 
  onSelect 
}: { 
  open: boolean; 
  onOpenChange: (o: boolean) => void; 
  onSelect: (path: string) => void; 
}) {
  const [currentPath, setCurrentPath] = useState("");

  const { data, refetch } = useQuery({
    queryKey: ["fs", currentPath],
    queryFn: async () => {
      const url = currentPath ? `/api/fs?path=${encodeURIComponent(currentPath)}` : "/api/fs";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch directory");
      return res.json();
    },
    enabled: open,
  });

  useEffect(() => {
    if (open) refetch();
  }, [open, currentPath, refetch]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden flex flex-col h-[500px]">
        <DialogHeader className="p-4 border-b bg-muted/20 shrink-0">
          <DialogTitle>Select Project Folder</DialogTitle>
          <div className="text-xs text-muted-foreground truncate mt-1" title={data?.current || "Loading..."}>
            {data?.current || "Loading..."}
          </div>
        </DialogHeader>
        
        <ScrollArea className="flex-1 p-2">
          {data && (
            <div className="space-y-1">
              {data.parent && data.parent !== data.current && (
                <Button 
                  variant="ghost" 
                  className="w-full justify-start h-8 px-2 text-sm text-muted-foreground"
                  onClick={() => setCurrentPath(data.parent)}
                >
                  <ArrowUpCircle className="h-4 w-4 mr-2" /> ..
                </Button>
              )}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {data.directories.map((dir: any) => (
                <Button 
                  key={dir.path}
                  variant="ghost" 
                  className="w-full justify-start h-8 px-2 text-sm truncate"
                  onClick={() => setCurrentPath(dir.path)}
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
