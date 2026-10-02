/**
 * Red de seguridad contra la pantalla en blanco.
 *
 * React desmonta TODO el árbol ante cualquier error no capturado durante el
 * renderizado, y lo que queda es una página vacía — sin mensaje ni rastro. Daba
 * igual si el error venía de un dato inesperado, de una condición de carrera o
 * de un fragmento de código que no cargó: el síntoma visible era siempre el
 * mismo, y por eso costaba diagnosticarlo.
 *
 * Dos casos, tratados distinto:
 *
 * 1. Falló la descarga de un fragmento (ruta cargada en diferido). Suele ser
 *    transitorio —un corte de red, o un fragmento que quedó de un despliegue
 *    anterior— y una recarga lo arregla. Se recarga SOLA, pero **una sola vez**:
 *    sin ese candado, un fallo permanente dejaría la página en bucle infinito,
 *    que es peor que el blanco.
 *
 * 2. Cualquier otro error. No se recarga —repetirlo daría el mismo resultado—
 *    y se muestra el mensaje real, para poder capturarlo y arreglar la causa.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

const CLAVE_RECARGA = 'movi_recarga_por_chunk';
/** Margen para distinguir "ya lo intenté hace un momento" de una sesión vieja. */
const VENTANA_MS = 30_000;

/** ¿El error es por un fragmento de código que no se pudo descargar? */
export function esErrorDeCarga(error: unknown): boolean {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(msg);
}

/** Recarga una vez y solo una. Devuelve false si ya se intentó hace poco. */
export function recargarUnaVez(): boolean {
  try {
    const previo = Number(sessionStorage.getItem(CLAVE_RECARGA) || 0);
    if (previo && Date.now() - previo < VENTANA_MS) return false;
    sessionStorage.setItem(CLAVE_RECARGA, String(Date.now()));
  } catch {
    // Sin sessionStorage (modo privado estricto) no hay forma de llevar la
    // cuenta, así que se prefiere no recargar antes que arriesgar un bucle.
    return false;
  }
  window.location.reload();
  return true;
}

interface Props { children: ReactNode }
interface State { error: Error | null; recargando: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, recargando: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidMount() {
    // Si la app llegó a montar, cualquier recarga previa cumplió su función.
    // Limpiar el candado permite que un fallo futuro vuelva a tener su intento.
    try { sessionStorage.removeItem(CLAVE_RECARGA); } catch { /* sin storage */ }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[MOVI] Error no capturado:', error, info.componentStack);
    if (esErrorDeCarga(error) && recargarUnaVez()) {
      this.setState({ recargando: true });
    }
  }

  render() {
    const { error, recargando } = this.state;
    if (!error) return this.props.children;

    if (recargando) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 text-center">
          <p className="text-sm text-neutral-500">Actualizando la aplicación…</p>
        </div>
      );
    }

    const deCarga = esErrorDeCarga(error);
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-surface-card border border-soft rounded-2xl p-6 space-y-3 shadow-card">
          <h1 className="text-lg font-bold text-neutral-900">
            {deCarga ? 'No se pudo cargar esta parte de MOVI' : 'Algo salió mal'}
          </h1>
          <p className="text-sm text-neutral-600">
            {deCarga
              ? 'Puede ser un problema momentáneo de conexión, o que haya una versión nueva. Vuelve a intentar.'
              : 'La pantalla no se pudo mostrar. Si vuelve a pasar, comparte el detalle de abajo para poder corregirlo.'}
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => { try { sessionStorage.removeItem(CLAVE_RECARGA); } catch { /* sin storage */ } window.location.reload(); }}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-foreground rounded-xl text-sm font-semibold"
            >
              Recargar
            </button>
            <button
              onClick={() => { window.location.href = '/'; }}
              className="px-4 py-2 border border-neutral-300 rounded-xl text-sm text-neutral-600 hover:bg-neutral-50"
            >
              Ir al inicio
            </button>
          </div>

          {/* El detalle va visible a propósito: antes no quedaba rastro de nada
              y había que adivinar qué había fallado. */}
          <details className="pt-1">
            <summary className="text-xs text-neutral-500 cursor-pointer">Ver detalle técnico</summary>
            <pre className="mt-2 text-[11px] text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-lg p-2 overflow-auto max-h-40 whitespace-pre-wrap">
              {error.name}: {error.message}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
