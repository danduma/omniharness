import type React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ThemeModeToggleProps {
  themeMode: "day" | "night";
  setThemeMode: React.Dispatch<React.SetStateAction<"day" | "night">>;
}

export function ThemeModeToggle({ themeMode, setThemeMode }: ThemeModeToggleProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground hover:text-foreground"
      aria-label={themeMode === "night" ? "Switch to day mode" : "Switch to night mode"}
      title={themeMode === "night" ? "Switch to day mode" : "Switch to night mode"}
      onClick={() => setThemeMode((current) => (current === "day" ? "night" : "day"))}
    >
      {themeMode === "night" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
