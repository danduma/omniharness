import Image from "next/image";
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
      <Image
        src="/icons/oh1-split-2.svg"
        alt=""
        width={64}
        height={64}
        unoptimized
        className={cn("h-full w-full object-contain", imageClassName)}
      />
    </span>
  );
}
