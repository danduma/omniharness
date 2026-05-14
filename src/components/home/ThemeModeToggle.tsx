import type React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t, useI18nSnapshot } from "@/lib/i18n";

interface ThemeModeToggleProps {
  themeMode: "day" | "night";
  setThemeMode: React.Dispatch<React.SetStateAction<"day" | "night">>;
}

export function ThemeModeToggle({ themeMode, setThemeMode }: ThemeModeToggleProps) {
  useI18nSnapshot();
  const label = t(themeMode === "night" ? "theme.mode.switchDay" : "theme.mode.switchNight");

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground hover:text-foreground"
      aria-label={label}
      title={label}
      onClick={() => setThemeMode((current) => (current === "day" ? "night" : "day"))}
    >
      {themeMode === "night" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
