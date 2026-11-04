import React, { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { buildProceduralAvatar, type AvatarPixelRole } from "./procedural-avatar";

const FIXED_COLORS: Partial<Record<AvatarPixelRole, string>> = {
  eye: "#1f2328",
  lens: "#1f2328",
};

export interface AgentAvatarProps {
  seed: string;
  agentType?: string | null;
  className?: string;
}

/** Decorative pixel avatar; the surrounding control carries the accessible name. */
export const AgentAvatar = memo(function AgentAvatar({ seed, agentType, className }: AgentAvatarProps) {
  const avatar = useMemo(() => buildProceduralAvatar(seed, agentType), [seed, agentType]);
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${avatar.width} ${avatar.height}`}
      shapeRendering="crispEdges"
      className={cn("office-avatar", className)}
      data-accessory={avatar.accessory}
    >
      {avatar.pixels.map((pixel) => (
        <rect
          key={`${pixel.x}-${pixel.y}`}
          x={pixel.x}
          y={pixel.y}
          width={1}
          height={1}
          fill={FIXED_COLORS[pixel.role] ?? avatar.colors[pixel.role as keyof typeof avatar.colors]}
        />
      ))}
    </svg>
  );
});
