import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useThemeMode } from "@/hooks/useThemeMode";
import { Sun, Moon, Laptop } from "lucide-react";

interface ThemeToggleProps {
  /** Render as a compact sidebar-rail style button (44×44 px, rounded-2xl) */
  compact?: boolean;
  /** Which side to open the dropdown. Defaults to 'right' (left-full) for sidebar, 'bottom' for inline. */
  dropdownSide?: 'right' | 'bottom';
  /** When true, the dropdown renders fixed to the viewport (use inside overlays/drawers). */
  fixedPanel?: boolean;
}

export function ThemeToggle({ compact, dropdownSide = 'right', fixedPanel }: ThemeToggleProps) {
  const { mode, updateMode, isDarkEffective } = useThemeMode();
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const Icon = useMemo(() => {
    if (mode === "system") return Laptop;
    return isDarkEffective ? Moon : Sun;
  }, [mode, isDarkEffective]);

  const calculatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const MARGIN = 8;
    const PANEL_WIDTH = 192; // w-48
    const PANEL_HEIGHT = 140; // ~3 options
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = rect.right + MARGIN;
    if (left + PANEL_WIDTH > viewportWidth - MARGIN) {
      left = rect.left - PANEL_WIDTH - MARGIN;
    }
    if (left < MARGIN) left = MARGIN;

    const spaceBelow = viewportHeight - rect.top - MARGIN;
    let top: number;
    if (spaceBelow >= PANEL_HEIGHT) {
      top = rect.top;
    } else {
      top = rect.bottom - PANEL_HEIGHT;
      if (top < MARGIN) top = MARGIN;
    }

    setPanelStyle({ position: 'fixed', top, left, width: PANEL_WIDTH, zIndex: 9999 });
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (fixedPanel) {
        if (
          panelRef.current && !panelRef.current.contains(target) &&
          buttonRef.current && !buttonRef.current.contains(target)
        ) {
          setOpen(false);
        }
      } else if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      if (fixedPanel) calculatePosition();
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open, fixedPanel, calculatePosition]);

  const buttonClass = compact
    ? "sidebar-rail-btn w-11 h-11 rounded-2xl flex items-center justify-center active:scale-90"
    : "inline-flex items-center justify-center h-10 w-10 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 transition-all duration-200 ease-ios";

  const dropdownPanel = (
    <div
      ref={panelRef}
      style={fixedPanel ? panelStyle : undefined}
      className={`w-48 rounded-2xl border border-gray-200 bg-white shadow-ios-lg overflow-hidden dark:border-white/10 dark:bg-slate-900 animate-scale-in ${
        fixedPanel
          ? ''
          : `absolute z-50 ${dropdownSide === 'right' ? 'left-full ml-2 top-0' : 'right-0 mt-2 top-full'}`
      }`}
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
        {mode === "light" && <span className="ml-auto text-accent dark:text-primary-400">✓</span>}
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
        {mode === "dark" && <span className="ml-auto text-accent dark:text-primary-400">✓</span>}
      </button>

      <div className="h-px bg-gray-100 dark:bg-white/5" />

      <button
        className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center gap-3
                    ${mode === "system" ? "font-semibold text-gray-900 dark:text-white bg-gray-50 dark:bg-white/5" : "text-gray-700 dark:text-white/80"}`}
        onClick={() => { updateMode("system"); setOpen(false); }}
        role="menuitem"
      >
        <Laptop className="h-4 w-4 flex-shrink-0" />
        <span>Automatico</span>
        {mode === "system" && <span className="ml-auto text-accent dark:text-primary-400">✓</span>}
      </button>
    </div>
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className={buttonClass}
        aria-label="Cambiar tema"
        title="Tema"
      >
        <Icon className={compact ? "w-[18px] h-[18px]" : "h-5 w-5 text-gray-700 dark:text-white/85"} />
      </button>

      {open && (
        <>
          {/* Backdrop for non-fixed mode */}
          {!fixedPanel && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
          {dropdownPanel}
        </>
      )}
    </div>
  );
}
