import { useEffect, useState } from "react";
import { ThemeMode, applyTheme, getStoredThemeMode, getSystemPrefersDark, storeThemeMode } from "@/lib/theme";

export function useThemeMode() {
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    const saved = getStoredThemeMode();
    setMode(saved);
    applyTheme(saved);
  }, []);

  useEffect(() => {
    if (mode !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");

    if (mq.addEventListener) {
      mq.addEventListener("change", handler);
    } else {
      mq.addListener(handler);
    }

    return () => {
      if (mq.removeEventListener) {
        mq.removeEventListener("change", handler);
      } else {
        mq.removeListener(handler);
      }
    };
  }, [mode]);

  const updateMode = (next: ThemeMode) => {
    setMode(next);
    storeThemeMode(next);
    applyTheme(next);
  };

  const isDarkEffective = mode === "dark" || (mode === "system" && getSystemPrefersDark());

  return { mode, updateMode, isDarkEffective };
}
