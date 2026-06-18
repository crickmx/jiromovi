import { createContext, useContext, useRef, useState, useCallback, type ReactNode } from 'react';

interface LoadingContextValue {
  isLoading: boolean;
  show: () => void;
  hide: () => void;
  wrap: <T>(promise: Promise<T>) => Promise<T>;
}

const LoadingContext = createContext<LoadingContextValue | null>(null);

export const useLoading = (): LoadingContextValue => {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error('useLoading must be used within LoadingProvider');
  return ctx;
};

export const LoadingProvider = ({ children }: { children: ReactNode }) => {
  const [isLoading, setIsLoading] = useState(false);
  const depthRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    depthRef.current += 1;
    setIsLoading(true);
  }, []);

  const hide = useCallback(() => {
    depthRef.current = Math.max(0, depthRef.current - 1);
    if (depthRef.current === 0) {
      hideTimerRef.current = setTimeout(() => {
        setIsLoading(false);
        hideTimerRef.current = null;
      }, 300);
    }
  }, []);

  const wrap = useCallback(<T,>(promise: Promise<T>): Promise<T> => {
    let shown = false;
    const showTimer = setTimeout(() => { show(); shown = true; }, 500);
    return promise.then(
      (result) => { clearTimeout(showTimer); if (shown) hide(); return result; },
      (err: unknown) => { clearTimeout(showTimer); if (shown) hide(); throw err; }
    );
  }, [show, hide]);

  return (
    <LoadingContext.Provider value={{ isLoading, show, hide, wrap }}>
      {children}
    </LoadingContext.Provider>
  );
};
