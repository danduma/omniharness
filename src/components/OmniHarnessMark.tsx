import { cn } from "@/lib/utils";

interface OmniHarnessMarkProps {
  className?: string;
  imageClassName?: string;
}

export function OmniHarnessMark({ className, imageClassName }: OmniHarnessMarkProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-[#fffdf8] p-[3px] shadow-sm ring-1 ring-black/10 dark:ring-white/15",
        className,
      )}
      aria-hidden="true"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 64 64"
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
