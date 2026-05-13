"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function ScrollArea({
  className,
  children,
  ref,
  ...props
}: React.ComponentPropsWithRef<"div">) {
  return (
    <div
      data-slot="scroll-area"
      ref={ref}
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <div
        data-slot="scroll-area-viewport"
        className="size-full overflow-auto rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 [scrollbar-width:thin]"
        tabIndex={props.tabIndex ?? 0}
      >
        {children}
      </div>
    </div>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<"div"> & { orientation?: "horizontal" | "vertical" }) {
  return (
    <div
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      className={cn(
        "flex touch-none p-px transition-colors select-none data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:h-full data-vertical:w-2.5 data-vertical:border-l data-vertical:border-l-transparent",
        className
      )}
      {...props}
    >
      <div
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-border"
      />
    </div>
  )
}

export { ScrollArea, ScrollBar }
