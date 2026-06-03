import {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoadingContextValue {
  isLoading: boolean;
  label: string | null;
  show: (label?: string) => void;
  hide: () => void;
  wrap: <T>(promise: Promise<T>, label?: string) => Promise<T>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const LoadingContext = createContext<LoadingContextValue | null>(null);

// ─── Inner provider (must be inside BrowserRouter) ───────────────────────────

function LoadingInner({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  // Tracks how many concurrent operations are in-flight
  const depthRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  const show = useCallback((lbl?: string) => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    depthRef.current += 1;
    setLabel(lbl ?? null);
    setIsLoading(true);
  }, []);

  const hide = useCallback(() => {
    depthRef.current = Math.max(0, depthRef.current - 1);
    if (depthRef.current > 0) return;
    // Small delay so the fade-out transition can play
    hideTimerRef.current = setTimeout(() => {
      setIsLoading(false);
      setLabel(null);
      hideTimerRef.current = null;
    }, 250);
  }, []);

  // Wraps a promise: shows loader after 500ms debounce, hides when promise settles
  const wrap = useCallback(
    <T,>(promise: Promise<T>, lbl?: string): Promise<T> => {
      let shown = false;
      const showTimer = setTimeout(() => {
        shown = true;
        show(lbl);
      }, 500);

      return promise.finally(() => {
        clearTimeout(showTimer);
        if (shown) hide();
      }) as Promise<T>;
    },
    [show, hide]
  );

  // Auto-detect route changes
  useEffect(() => {
    if (location.pathname !== prevPathRef.current) {
      prevPathRef.current = location.pathname;
      show('Cargando...');
      const t = setTimeout(() => hide(), 600);
      return () => clearTimeout(t);
    }
  }, [location.pathname, show, hide]);

  return (
    <LoadingContext.Provider value={{ isLoading, label, show, hide, wrap }}>
      {children}
    </LoadingContext.Provider>
  );
}

// ─── Public provider ──────────────────────────────────────────────────────────
// NOTE: Must be placed INSIDE BrowserRouter so the inner component
//       can use useLocation for route-change detection.

export function LoadingProvider({ children }: { children: ReactNode }) {
  return <LoadingInner>{children}</LoadingInner>;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useLoading(): LoadingContextValue {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error('useLoading must be used inside LoadingProvider');
  return ctx;
}

export function useLoadingWrap() {
  return useLoading().wrap;
}
