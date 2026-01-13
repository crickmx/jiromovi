import { useState, useMemo, useRef, useEffect } from "react";
import { useThemeMode } from "@/hooks/useThemeMode";
import { Sun, Moon, Laptop } from "lucide-react";

export function ThemeToggle() {
  const { mode, updateMode, isDarkEffective } = useThemeMode();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const Icon = useMemo(() => {
    if (mode === "system") return Laptop;
    return isDarkEffective ? Moon : Sun;
  }, [mode, isDarkEffective]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center justify-center h-10 w-10 rounded-xl
                   border border-gray-200 bg-white hover:bg-gray-50
                   dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10
                   transition-all duration-200 ease-ios"
        aria-label="Cambiar tema"
        title="Tema"
      >
        <Icon className="h-5 w-5 text-gray-700 dark:text-white/85" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 mt-2 w-56 rounded-2xl border border-gray-200 bg-white shadow-ios-lg overflow-hidden z-50
                       dark:border-white/10 dark:bg-slate-900 animate-scale-in"
            role="menu"
          >
            <button
              className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center gap-3
                          ${mode === "light" ? "font-semibold text-gray-900 dark:text-white bg-gray-50 dark:bg-white/5" : "text-gray-700 dark:text-white/80"}`}
              onClick={() => { updateMode("light"); setOpen(false); }}
              role="menuitem"
            >
              <Sun className="h-4 w-4 flex-shrink-0" />
              <span>Claro</span>
              {mode === "light" && (
                <span className="ml-auto text-primary-500 dark:text-primary-400">✓</span>
              )}
            </button>

            <div className="h-px bg-gray-100 dark:bg-white/5" />

            <button
              className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center gap-3
                          ${mode === "dark" ? "font-semibold text-gray-900 dark:text-white bg-gray-50 dark:bg-white/5" : "text-gray-700 dark:text-white/80"}`}
              onClick={() => { updateMode("dark"); setOpen(false); }}
              role="menuitem"
            >
              <Moon className="h-4 w-4 flex-shrink-0" />
              <span>Oscuro</span>
              {mode === "dark" && (
                <span className="ml-auto text-primary-500 dark:text-primary-400">✓</span>
              )}
            </button>

            <div className="h-px bg-gray-100 dark:bg-white/5" />

            <button
              className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center gap-3
                          ${mode === "system" ? "font-semibold text-gray-900 dark:text-white bg-gray-50 dark:bg-white/5" : "text-gray-700 dark:text-white/80"}`}
              onClick={() => { updateMode("system"); setOpen(false); }}
              role="menuitem"
            >
              <Laptop className="h-4 w-4 flex-shrink-0" />
              <span>Automático</span>
              {mode === "system" && (
                <span className="ml-auto text-primary-500 dark:text-primary-400">✓</span>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
