import { SquareTerminal } from "lucide-react";
import Image from "next/image";
import Codex from "@lobehub/icons/es/Codex";
import { siClaude, siGooglegemini, type SimpleIcon } from "simple-icons";
import { cn } from "@/lib/utils";

type CliBrandIconProps = {
  workerType?: string | null;
  className?: string;
};

const OPENCODE_ICON_SRC = "/brand-icons/opencode.png";

function SimpleIconsGlyph({
  icon,
  className,
}: {
  icon: SimpleIcon;
  className?: string;
}) {
  return (
    <svg
      role="img"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d={icon.path} />
    </svg>
  );
}

function OpenCodeGlyph({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden", className)}>
      <Image
        src={OPENCODE_ICON_SRC}
        alt=""
        aria-hidden="true"
        fill
        sizes="14px"
        className="object-cover"
      />
    </span>
  );
}

export function CliBrandIcon({ workerType, className }: CliBrandIconProps) {
  switch (workerType) {
    case "codex":
      return <Codex size={14} className={className} />;
    case "claude":
      return <SimpleIconsGlyph icon={siClaude} className={className} />;
    case "gemini":
      return <SimpleIconsGlyph icon={siGooglegemini} className={className} />;
    case "opencode":
      return <OpenCodeGlyph className={className} />;
    default:
      return <SquareTerminal className={className} aria-hidden="true" />;
  }
}
