// Deterministic pixel avatars for the office view. Same seed, same avatar,
// on every client and across reloads. No external art, so no licensing risk.
// Agent type is encoded as an accessory *shape* (never color alone).

export type AvatarPixelRole = "hair" | "skin" | "eye" | "mouth" | "shirt" | "accent" | "lens";

export type AvatarPixel = { x: number; y: number; role: AvatarPixelRole };

export type AvatarAccessory = "glasses" | "headphones" | "cap" | "bandana" | "none";

export type ProceduralAvatar = {
  width: number;
  height: number;
  pixels: AvatarPixel[];
  colors: Record<Exclude<AvatarPixelRole, "eye" | "lens">, string>;
  accessory: AvatarAccessory;
};

export const AVATAR_WIDTH = 10;
export const AVATAR_HEIGHT = 12;

// H hair, S skin, E eye, M mouth, C shirt, . empty
const BODY = [
  "..........",
  "..........",
  ".SSSSSSSS.",
  ".SSESSESS.",
  ".SSSSSSSS.",
  "..SSMMSS..",
  "...SSSS...",
  ".CCCCCCCC.",
  "CCCCCCCCCC",
  "SCCCCCCCCS",
  "SCCCCCCCCS",
  ".CCCCCCCC.",
];

const HAIR_STYLES = [
  ["..HHHHHH..", ".HHHHHHHH.", ".H......H."],
  ["...HHHH...", ".HHHHHHHH.", ".HH....HH."],
  [".HHHHHHHH.", "HHHHHHHHHH", "HH......HH"],
  ["..........", "..HHHHHH..", ".H......H."],
  ["H.HHHHHH.H", ".HHHHHHHH.", ".H......H."],
];

const SKIN_TONES = ["#f6d7b0", "#e8b98a", "#c98e5f", "#a46a3f", "#7a4a2a", "#5a3520"];

const ACCESSORY_BY_TYPE: Record<string, AvatarAccessory> = {
  codex: "glasses",
  claude: "headphones",
  gemini: "cap",
  opencode: "bandana",
};

function hashSeed(seed: string) {
  // FNV-1a, 32-bit.
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function createRandom(seed: number) {
  // mulberry32
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(random: () => number, values: readonly T[]): T {
  return values[Math.floor(random() * values.length) % values.length]!;
}

export function accessoryForAgentType(agentType: string | null | undefined): AvatarAccessory {
  return ACCESSORY_BY_TYPE[(agentType ?? "").trim().toLowerCase()] ?? "none";
}

export function buildProceduralAvatar(seed: string, agentType?: string | null): ProceduralAvatar {
  const random = createRandom(hashSeed(seed));
  const hairStyle = pick(random, HAIR_STYLES);
  const hairHue = Math.floor(random() * 360);
  const shirtHue = Math.floor(random() * 360);
  const accentHue = (shirtHue + 150 + Math.floor(random() * 60)) % 360;
  const skin = pick(random, SKIN_TONES);
  const accessory = accessoryForAgentType(agentType);

  const grid = BODY.map((row) => row.split(""));
  hairStyle.forEach((row, y) => {
    row.split("").forEach((cell, x) => {
      if (cell === "H") grid[y]![x] = "H";
    });
  });

  const overlay = (y: number, x: number, cell: string) => {
    if (grid[y]?.[x] !== undefined) grid[y]![x] = cell;
  };
  if (accessory === "glasses") {
    for (const x of [2, 3, 5, 6]) overlay(3, x, "G");
    overlay(3, 4, "A");
  } else if (accessory === "headphones") {
    for (let x = 1; x <= 8; x += 1) overlay(0, x, "A");
    for (const y of [1, 2, 3, 4]) {
      overlay(y, 0, "A");
      overlay(y, 9, "A");
    }
  } else if (accessory === "cap") {
    for (let x = 1; x <= 8; x += 1) overlay(0, x, "A");
    for (let x = 1; x <= 9; x += 1) overlay(1, x, "A");
  } else if (accessory === "bandana") {
    for (let x = 1; x <= 8; x += 1) overlay(2, x, "A");
  }

  const roleByCell: Record<string, AvatarPixelRole> = {
    H: "hair",
    S: "skin",
    E: "eye",
    M: "mouth",
    C: "shirt",
    A: "accent",
    G: "lens",
  };
  const pixels: AvatarPixel[] = [];
  grid.forEach((row, y) => {
    row.forEach((cell, x) => {
      const role = roleByCell[cell];
      if (role) pixels.push({ x, y, role });
    });
  });

  return {
    width: AVATAR_WIDTH,
    height: AVATAR_HEIGHT,
    pixels,
    colors: {
      hair: `hsl(${hairHue} 45% 32%)`,
      skin,
      mouth: "#9c4a3c",
      shirt: `hsl(${shirtHue} 55% 48%)`,
      accent: `hsl(${accentHue} 60% 42%)`,
    },
    accessory,
  };
}
