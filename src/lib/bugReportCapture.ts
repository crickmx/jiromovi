// Buffer en memoria de diagnostico tecnico para el boton de "Reportar un problema".
// Se inicializa una sola vez en main.tsx, antes de montar la app, para no perderse
// errores que ocurran en los primeros segundos de carga.

const MAX_CONSOLE_ERRORS = 20;
const MAX_NETWORK_ERRORS = 20;
const MAX_BREADCRUMBS = 15;

interface ConsoleErrorEntry {
  nivel: 'error' | 'warn';
  mensaje: string;
  timestamp: string;
}

interface NetworkErrorEntry {
  metodo: string;
  ruta: string;
  status: number | null;
  timestamp: string;
}

interface BreadcrumbEntry {
  ruta: string;
  timestamp: string;
}

const consoleErrors: ConsoleErrorEntry[] = [];
const networkErrors: NetworkErrorEntry[] = [];
const breadcrumbs: BreadcrumbEntry[] = [];

let initialized = false;

function pushCapped<T>(arr: T[], entry: T, max: number) {
  arr.push(entry);
  if (arr.length > max) arr.shift();
}

function safeStringify(args: unknown[]): string {
  try {
    return args
      .map(a => (typeof a === 'string' ? a : a instanceof Error ? a.message : JSON.stringify(a)))
      .join(' ')
      .slice(0, 500);
  } catch {
    return '[No se pudo serializar el mensaje]';
  }
}

// Solo la ruta (sin dominio/query) para no capturar tokens o llaves en la URL.
function rutaSegura(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.pathname;
  } catch {
    return url.slice(0, 200);
  }
}

function registrarBreadcrumb(pathname: string) {
  const last = breadcrumbs[breadcrumbs.length - 1];
  if (last?.ruta === pathname) return;
  pushCapped(breadcrumbs, { ruta: pathname, timestamp: new Date().toISOString() }, MAX_BREADCRUMBS);
}

export function initBugReportCapture() {
  if (initialized) return;
  initialized = true;

  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    pushCapped(consoleErrors, { nivel: 'error', mensaje: safeStringify(args), timestamp: new Date().toISOString() }, MAX_CONSOLE_ERRORS);
    originalError(...args);
  };

  const originalWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    pushCapped(consoleErrors, { nivel: 'warn', mensaje: safeStringify(args), timestamp: new Date().toISOString() }, MAX_CONSOLE_ERRORS);
    originalWarn(...args);
  };

  window.addEventListener('error', (event) => {
    pushCapped(consoleErrors, { nivel: 'error', mensaje: `Excepción no controlada: ${event.message}`, timestamp: new Date().toISOString() }, MAX_CONSOLE_ERRORS);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const mensaje = event.reason instanceof Error ? event.reason.message : safeStringify([event.reason]);
    pushCapped(consoleErrors, { nivel: 'error', mensaje: `Promesa rechazada sin atrapar: ${mensaje}`, timestamp: new Date().toISOString() }, MAX_CONSOLE_ERRORS);
  });

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
    const metodo = (args[1]?.method || (args[0] as Request)?.method || 'GET').toUpperCase();
    try {
      const response = await originalFetch(...args);
      if (!response.ok) {
        pushCapped(networkErrors, { metodo, ruta: rutaSegura(url), status: response.status, timestamp: new Date().toISOString() }, MAX_NETWORK_ERRORS);
      }
      return response;
    } catch (err) {
      pushCapped(networkErrors, { metodo, ruta: rutaSegura(url), status: null, timestamp: new Date().toISOString() }, MAX_NETWORK_ERRORS);
      throw err;
    }
  };

  registrarBreadcrumb(window.location.pathname);
  const originalPushState = history.pushState.bind(history);
  history.pushState = (...args: Parameters<typeof history.pushState>) => {
    originalPushState(...args);
    registrarBreadcrumb(window.location.pathname);
  };
  const originalReplaceState = history.replaceState.bind(history);
  history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
    originalReplaceState(...args);
    registrarBreadcrumb(window.location.pathname);
  };
  window.addEventListener('popstate', () => registrarBreadcrumb(window.location.pathname));
}

export function getBugReportSnapshot() {
  return {
    url_actual: window.location.pathname,
    user_agent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    errores_consola: [...consoleErrors],
    peticiones_fallidas: [...networkErrors],
    rutas_visitadas: [...breadcrumbs],
    capturado_en: new Date().toISOString(),
  };
}

export type BugReportSnapshot = ReturnType<typeof getBugReportSnapshot>;
