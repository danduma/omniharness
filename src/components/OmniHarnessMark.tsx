import { cn } from "@/lib/utils";

interface OmniHarnessMarkProps {
  className?: string;
  imageClassName?: string;
}

export function OmniHarnessMark({ className, imageClassName }: OmniHarnessMarkProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#fffdf8] p-[3px] shadow-sm ring-1 ring-black/10 dark:ring-white/15",
        className,
      )}
      aria-hidden="true"
    >
      {/*
        No `scale`: the parent clips (`overflow-hidden rounded-full`), so any
        zoom crops the outermost geometry first — which here is the two arcs of
        the ring. At the old 1.75x only x,y in [13.7, 50.3] of the viewBox
        survived, and both arcs live entirely outside that window, so the mark
        rendered as a bare "H". Fill the badge with a tighter viewBox instead,
        which crops nothing: the artwork spans 4.5-59.5 including stroke width.
      */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="2 2 60 60"
        className={cn("h-full w-full", imageClassName)}
        aria-hidden="true"
      >
        <g fill="none" stroke="#e86b20" strokeWidth="4" strokeLinecap="butt" strokeLinejoin="miter">
          <path d="M6.5 28A25.8 25.8 0 0 1 57.5 28" />
          <path d="M57.5 36A25.8 25.8 0 0 1 6.5 36" />
          <path d="M23 24v16" />
          <path d="M41 24v16" />
          <path d="M 26.417 32 L 37.466 32" />
        </g>
      </svg>
    </span>
  );
}
