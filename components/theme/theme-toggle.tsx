"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/lib/theme";
import { useHotkeys } from "react-hotkeys-hook";
import { Sun, Moon, MonitorPlay } from "@/lib/ui/icons";
import { Button } from "@/components/ui/button";

const subscribeHydration = () => () => {};
const clientHydrated = () => true;
const serverHydrated = () => false;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // A preferência do storage só pode alterar o HTML depois da hidratação.
  const hydrated = useSyncExternalStore(subscribeHydration, clientHydrated, serverHydrated);
  const displayedTheme = hydrated ? theme : "system";

  const cycle = () => {
    setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light");
  };

  useHotkeys("mod+shift+l", cycle, { preventDefault: true }, [theme]);

  const Icon = displayedTheme === "dark" ? Moon : displayedTheme === "system" ? MonitorPlay : Sun;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycle}
      aria-label={`Tema: ${displayedTheme}. Cmd+Shift+L para alternar.`}
    >
      <Icon size={16} aria-hidden />
    </Button>
  );
}
