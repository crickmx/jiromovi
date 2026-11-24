import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, CircleAlert, X } from 'lucide-react';
import { cnSistema as cn } from '@/lib/utils';

// Avisos breves del módulo de correo, con "Deshacer" para lo destructivo.
// Una acción con deshacer NO se ejecuta hasta que el aviso se cierra solo: si
// la persona pulsa Deshacer, nunca llegó al servidor. Al salir del módulo, lo
// pendiente se ejecuta para no perderlo.

interface Aviso {
  id: number;
  texto: string;
  tipo: 'ok' | 'error';
  deshacer?: () => void;
}

interface Ctx {
  avisar: (texto: string, tipo?: 'ok' | 'error') => void;
  /** Ejecuta `accion` en unos segundos, salvo que se pulse Deshacer. */
  conDeshacer: (texto: string, accion: () => Promise<void> | void, alDeshacer: () => void) => void;
}

const AvisosCtx = createContext<Ctx | null>(null);
export const useAvisos = () => {
  const c = useContext(AvisosCtx);
  if (!c) throw new Error('useAvisos fuera de <AvisosProvider>');
  return c;
};

const ESPERA_MS = 5000;

export function AvisosProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const pendientes = useRef(new Map<number, { accion: () => Promise<void> | void; timer: ReturnType<typeof setTimeout> }>());
  const seq = useRef(0);

  const quitar = useCallback((id: number) => setAvisos(a => a.filter(x => x.id !== id)), []);

  const avisar = useCallback((texto: string, tipo: 'ok' | 'error' = 'ok') => {
    const id = ++seq.current;
    setAvisos(a => [...a.slice(-2), { id, texto, tipo }]);
    setTimeout(() => quitar(id), tipo === 'error' ? 7000 : 3500);
  }, [quitar]);

  const conDeshacer = useCallback((texto: string, accion: () => Promise<void> | void, alDeshacer: () => void) => {
    const id = ++seq.current;
    const timer = setTimeout(() => {
      pendientes.current.delete(id);
      quitar(id);
      void accion();
    }, ESPERA_MS);
    pendientes.current.set(id, { accion, timer });
    setAvisos(a => [...a.slice(-2), {
      id, texto, tipo: 'ok',
      deshacer: () => {
        const p = pendientes.current.get(id);
        if (p) clearTimeout(p.timer);
        pendientes.current.delete(id);
        quitar(id);
        alDeshacer();
      },
    }]);
  }, [quitar]);

  // Al desmontar (salir del módulo), ejecutar lo que quedó pendiente.
  useEffect(() => {
    const mapa = pendientes.current;
    const flush = () => {
      for (const [, p] of mapa) { clearTimeout(p.timer); void p.accion(); }
      mapa.clear();
    };
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, []);

  return (
    <AvisosCtx.Provider value={{ avisar, conDeshacer }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6"
      >
        {avisos.map(a => (
          <div
            key={a.id}
            role={a.tipo === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex items-center gap-3 max-w-[min(32rem,100%)] rounded-[var(--radius-md)] pl-4 pr-2 py-2 shadow-e3 animate-rise',
              'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900',
            )}
          >
            {a.tipo === 'error'
              ? <CircleAlert className="w-4 h-4 text-red-400 dark:text-red-600 flex-shrink-0" aria-hidden />
              : <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 flex-shrink-0" aria-hidden />}
            <span className="text-body-sm flex-1 min-w-0 break-words">{a.texto}</span>
            {a.deshacer && (
              <button
                type="button"
                onClick={a.deshacer}
                className="min-h-[36px] px-3 rounded-[var(--radius-xs)] text-body-sm font-bold text-sky-300 dark:text-accent-ink hover:bg-white/10 dark:hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white dark:focus-visible:ring-accent"
              >
                Deshacer
              </button>
            )}
            <button
              type="button"
              onClick={() => quitar(a.id)}
              aria-label="Cerrar aviso"
              className="w-9 h-9 flex items-center justify-center rounded-full opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white dark:focus-visible:ring-accent"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </AvisosCtx.Provider>
  );
}
