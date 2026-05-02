"use client";

import { useMemo } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { useMediaQuery } from "@base-ui/react/unstable-use-media-query";
import { Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { composerModelPickerManager } from "@/components/component-state-managers";
import { cn } from "@/lib/utils";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import type { WorkerModelOption } from "@/app/home/types";

type ComposerModelPickerProps = {
  value: string;
  options: WorkerModelOption[];
  onChange: (value: string) => void;
  themeMode: "day" | "night";
};

export function ComposerModelPicker({
  value,
  options,
  onChange,
  themeMode,
}: ComposerModelPickerProps) {
  const { open, query } = useManagerSnapshot(composerModelPickerManager);
  const isDesktop = useMediaQuery("(min-width: 640px)", {
    defaultMatches: false,
    noSsr: true,
  });
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) =>
      option.label.toLowerCase().includes(normalizedQuery) ||
      option.value.toLowerCase().includes(normalizedQuery)
    );
  }, [options, query]);
  const buttonClassName = cn(
    "h-8 max-w-[6.8rem] shrink truncate px-1 text-xs font-normal sm:h-9 sm:max-w-none sm:px-2 sm:text-sm",
    themeMode === "night"
      ? "text-muted-foreground hover:bg-background/45 hover:text-foreground"
      : "text-[#8f8f8f] hover:bg-black/[0.04] hover:text-[#5e5e5e]",
  );
  const panel = (
    <ModelPickerPanel
      filteredOptions={filteredOptions}
      query={query}
      value={value}
      onChange={onChange}
    />
  );

  if (isDesktop) {
    return (
      <PopoverPrimitive.Root open={open} onOpenChange={composerModelPickerManager.setOpen}>
        <PopoverPrimitive.Trigger
          render={
            <Button
              type="button"
              variant="ghost"
              aria-label="Worker model"
              className={buttonClassName}
            />
          }
        >
          <span className="truncate">{selectedLabel}</span>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Positioner
            side="top"
            align="end"
            sideOffset={10}
            className="isolate z-50 outline-none"
          >
            <PopoverPrimitive.Popup className="w-[min(22rem,calc(100vw-2rem))] origin-(--transform-origin) overflow-hidden rounded-2xl border border-border bg-background text-popover-foreground shadow-[0_18px_70px_rgba(24,24,27,0.18)] outline-none duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
              <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
                <PopoverPrimitive.Title className="font-heading text-base font-medium text-foreground">
                  Choose model
                </PopoverPrimitive.Title>
              </div>
              {panel}
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        aria-label="Worker model"
        onClick={() => composerModelPickerManager.setOpen(true)}
        className={buttonClassName}
      >
        <span className="truncate">{selectedLabel}</span>
      </Button>
      <Sheet open={open} onOpenChange={composerModelPickerManager.setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[76vh] rounded-t-2xl border-t border-border bg-background p-0 shadow-[0_-22px_70px_rgba(24,24,27,0.22)]"
          showCloseButton
        >
          <SheetHeader className="border-b border-border/60 bg-muted/30 p-4 pb-3">
            <SheetTitle>Choose model</SheetTitle>
          </SheetHeader>
          {panel}
        </SheetContent>
      </Sheet>
    </>
  );
}

type ModelPickerPanelProps = {
  filteredOptions: WorkerModelOption[];
  query: string;
  value: string;
  onChange: (value: string) => void;
};

function ModelPickerPanel({
  filteredOptions,
  query,
  value,
  onChange,
}: ModelPickerPanelProps) {
  return (
    <div className="space-y-3 p-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => composerModelPickerManager.setQuery(event.target.value)}
          placeholder="Search models"
          className="h-10 pl-9"
        />
      </div>
      <div className="max-h-[min(42vh,22rem)] space-y-1 overflow-y-auto">
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  composerModelPickerManager.closeAndReset();
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  selected
                    ? "bg-muted text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {selected ? <Check className="h-4 w-4 shrink-0" /> : null}
              </button>
            );
          })
        ) : (
          <div className="rounded-lg border border-dashed border-border/70 px-3 py-6 text-center text-sm text-muted-foreground">
            No models match.
          </div>
        )}
      </div>
    </div>
  );
}
