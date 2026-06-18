export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "movi-theme-mode";

export function getStoredThemeMode(): ThemeMode {
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === "light" || v === "dark" || v === "system") return v;
  return "system";
}

export function storeThemeMode(mode: ThemeMode) {
  localStorage.setItem(STORAGE_KEY, mode);
}

export function getSystemPrefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
}

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  const shouldBeDark = mode === "dark" || (mode === "system" && getSystemPrefersDark());
  root.classList.toggle("dark", shouldBeDark);
}

// Apply theme synchronously on module load to prevent flash of wrong theme
applyTheme(getStoredThemeMode());
