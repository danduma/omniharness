"use client"

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"

const COLLAPSIBLE_PANEL_TRANSITION_CLASS = "grid overflow-hidden transition-[grid-template-rows,opacity,transform] duration-150 ease-out motion-reduce:transition-none"
const COLLAPSIBLE_PANEL_OPEN_CLASS = "grid-rows-[1fr] opacity-100 translate-y-0"
const COLLAPSIBLE_PANEL_CLOSED_CLASS = "grid-rows-[0fr] pointer-events-none -translate-y-1 opacity-0"

function Collapsible({ ...props }: CollapsiblePrimitive.Root.Props) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({ ...props }: CollapsiblePrimitive.Trigger.Props) {
  return (
    <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />
  )
}

function CollapsibleContent({ ...props }: CollapsiblePrimitive.Panel.Props) {
  return (
    <CollapsiblePrimitive.Panel data-slot="collapsible-content" {...props} />
  )
}

export {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  COLLAPSIBLE_PANEL_TRANSITION_CLASS,
  COLLAPSIBLE_PANEL_OPEN_CLASS,
  COLLAPSIBLE_PANEL_CLOSED_CLASS,
}
